/**
 * @spec.purpose "First runtime-named export" resolver for `commands/init`.
 *   Delegates the in-file scan to `collectExports` from `spec/source-exports`
 *   — the same ts-morph-based resolver `generate` and `validate` use.
 *
 *   `collectExports` resolves re-exports only when the target file is
 *   registered as a sibling on its in-memory ts-morph project. `init`
 *   has no project context loaded, so before invoking `collectExports`
 *   this module walks every `export ... from "..."` specifier in the
 *   barrel (via `getExportDeclarations` — ts-morph ignores comments and
 *   string literals structurally, so commented / quoted re-export
 *   syntax cannot trigger a sibling read), reads each target file off
 *   disk, and adds it to the siblings array. The walk is transitive
 *   (a sibling's own `from` specifiers are registered too) and bounded
 *   by REEXPORT_MAX_DEPTH for cyclic chains; a `seen` set keeps each
 *   physical file registered at most once.
 *
 *   With the sibling graph registered, a single `collectExports` call
 *   returns the same declarations `generate` and `validate` see —
 *   covering bare star re-exports, namespace-alias star re-exports,
 *   and named clause re-exports under one mechanism.
 *
 *   `isRuntimeNamed` filters the result to entries that can back a
 *   `import { name } from "../index.js"` line:
 *     - `name === "default"` (not a named import target)
 *     - non-identifier names (`export { x as "x-y" }` — syntax error
 *       when interpolated)
 *     - ECMAScript reserved words (`export { x as class }` — also
 *       rejected by tsc)
 *     - kind `type` / `interface` (type-erased)
 *     - `const enum` (also type-erased under default TS config)
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import {
  Node,
  Project,
  type ExportDeclaration,
  type ExportSpecifier,
} from "ts-morph";
import {
  collectExports,
  type DeclaredExport,
  type SourceFile,
} from "@safer/spec/source-exports.js";

const REEXPORT_MAX_DEPTH = 4;

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const CONST_ENUM_PREFIX_RE = /^\s*(?:export\s+)?const\s+enum\b/;

// ES module strict context — both always-reserved and future-reserved-
// strict words are illegal as a bare named import binding. Listed
// explicitly because a regex / TS keyword lookup wouldn't distinguish
// strict-mode reservations.
const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export",
  "extends", "false", "finally", "for", "function", "if", "implements",
  "import", "in", "instanceof", "interface", "let", "new", "null",
  "package", "private", "protected", "public", "return", "static",
  "super", "switch", "this", "throw", "true", "try", "typeof", "var",
  "void", "while", "with", "yield",
]);

const isImportableName = (name: string): boolean => {
  if (name === "default") return false;
  if (!IDENT_RE.test(name)) return false;
  return !RESERVED_WORDS.has(name);
};

// `export declare const x` / `export declare function f()` are ambient
// — TypeScript emits no runtime binding, so the scaffolded stub would
// fail at runtime. Detect via signature prefix; collectExports doesn't
// flag ambient-ness in its kind taxonomy.
const AMBIENT_DECLARE_PREFIX_RE = /^\s*export\s+declare\b/;

const isErasingKind = (e: DeclaredExport): boolean => {
  if (e.kind === "type" || e.kind === "interface") return true;
  if (e.kind === "enum" && CONST_ENUM_PREFIX_RE.test(e.signature)) return true;
  return AMBIENT_DECLARE_PREFIX_RE.test(e.signature);
};

// `export type { Foo } from "./x"` (or per-entry `export { type Foo }`)
// re-binds `Foo` as a type-only export on this barrel even when the
// target's underlying declaration is a value. collectExports follows the
// alias and reports the value kind, so this filter catches the type-only
// erasure separately by name.
const isRuntimeNamed = (
  e: DeclaredExport,
  typeOnlyPublicNames: ReadonlySet<string>,
): boolean => {
  if (!isImportableName(e.name)) return false;
  if (isErasingKind(e)) return false;
  return !typeOnlyPublicNames.has(e.name);
};

const firstRuntimeExport = (
  entries: ReadonlyArray<DeclaredExport>,
  typeOnlyPublicNames: ReadonlySet<string>,
): string | null => {
  for (const e of entries) {
    if (isRuntimeNamed(e, typeOnlyPublicNames)) return e.name;
  }
  return null;
};

const tsCandidatesFor = (specifier: string): ReadonlyArray<string> => {
  if (specifier.endsWith(".js")) {
    const stem = specifier.slice(0, -3);
    return [`${stem}.ts`, `${stem}.tsx`];
  }
  if (specifier.endsWith(".ts") || specifier.endsWith(".tsx")) return [specifier];
  return [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`];
};

const readSourceOrNull = (
  fs: FileSystem.FileSystem,
  candPath: string,
): Effect.Effect<string | null, never> =>
  fs.readFileString(candPath).pipe(
    Effect.map((s) => s as string | null),
    Effect.catchAll(() => Effect.succeed(null as string | null)),
  );

interface PickerCtx {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
}

interface ResolvedTarget {
  readonly path: string;
  readonly source: string;
}

const resolveTarget = (
  ctx: PickerCtx,
  baseDir: string,
  specifier: string,
): Effect.Effect<ResolvedTarget | null, never> =>
  Effect.gen(function* () {
    for (const cand of tsCandidatesFor(specifier)) {
      const candPath = ctx.path.resolve(baseDir, cand);
      const candSource = yield* readSourceOrNull(ctx.fs, candPath);
      if (candSource !== null) return { path: candPath, source: candSource };
    }
    return null;
  });

// SourceScan: specifiers feed the sibling pre-walk; typeOnlyPublicNames
// catches `export type { Foo }` / `export { type Foo }` re-exports that
// collectExports would otherwise resolve to a value declaration upstream.
interface SourceScan {
  readonly specifiers: ReadonlyArray<string>;
  readonly typeOnlyPublicNames: ReadonlySet<string>;
}

// For `export { x as "Bar" }` the alias is a StringLiteral node — its
// `getText()` returns the quoted form `"Bar"` while collectExports
// reports the unquoted name `Bar`. Use `getLiteralValue()` for string
// aliases so the filter sets share the same canonical name.
const publicNameOf = (ne: ExportSpecifier): string => {
  const alias = ne.getAliasNode();
  if (alias === undefined) return ne.getName();
  if (Node.isStringLiteral(alias)) return alias.getLiteralValue();
  return alias.getText();
};

// Handle a whole-clause type-only declaration: don't register the
// target as a collectExports sibling (otherwise its value names leak
// through), and mark whichever public names this clause introduces
// (named entries, or the namespace alias for `export type * as ns`)
// as type-only so they're filtered if collectExports surfaces them.
const recordTypeOnlyDecl = (
  decl: ExportDeclaration,
  typeOnly: Set<string>,
): void => {
  const ns = decl.getNamespaceExport();
  if (ns !== undefined) typeOnly.add(ns.getName());
  for (const ne of decl.getNamedExports()) typeOnly.add(publicNameOf(ne));
};

const scanOneDeclaration = (
  decl: ExportDeclaration,
  specifiers: string[],
  typeOnly: Set<string>,
): void => {
  if (decl.isTypeOnly()) {
    recordTypeOnlyDecl(decl, typeOnly);
    return;
  }
  const moduleSpec = decl.getModuleSpecifierValue();
  if (moduleSpec !== undefined) specifiers.push(moduleSpec);
  for (const ne of decl.getNamedExports()) {
    if (ne.isTypeOnly()) typeOnly.add(publicNameOf(ne));
  }
};

const scanExportDeclarations = (filePath: string, source: string): SourceScan => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  const specifiers: string[] = [];
  const typeOnly = new Set<string>();
  for (const decl of sf.getExportDeclarations()) {
    scanOneDeclaration(decl, specifiers, typeOnly);
  }
  // `import { Foo } from "./foo.js"; export { Foo };` — the export
  // declaration has no `from`, so it lacks a specifier of its own.
  // Register every imported module's specifier as well, so collectExports
  // can resolve the locally-rebound name through the imported file.
  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (spec !== undefined && spec !== "") specifiers.push(spec);
  }
  return { specifiers, typeOnlyPublicNames: typeOnly };
};

interface CollectSiblingsCtx {
  readonly picker: PickerCtx;
  readonly out: SourceFile[];
  readonly seen: Set<string>;
  // Type-only public names from intermediate barrels — `export *` chains
  // preserve type-only-ness per the ES spec, but ts-morph's resolution
  // lifts the names back into the value namespace. Merging each sibling's
  // own type-only set into this ensures the root filter blocks them.
  readonly typeOnly: Set<string>;
}

const visitOneSpecifier = (
  ctx: CollectSiblingsCtx,
  rootFile: string,
  specifier: string,
  depth: number,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const target = yield* resolveTarget(
      ctx.picker,
      ctx.picker.path.dirname(rootFile),
      specifier,
    );
    if (target === null) return;
    if (ctx.seen.has(target.path)) return;
    ctx.seen.add(target.path);
    ctx.out.push({ path: target.path, source: target.source });
    const subScan = scanExportDeclarations(target.path, target.source);
    for (const n of subScan.typeOnlyPublicNames) ctx.typeOnly.add(n);
    yield* collectSiblings(ctx, target.path, target.source, depth + 1);
  });

const collectSiblings = (
  ctx: CollectSiblingsCtx,
  rootFile: string,
  rootSource: string,
  depth: number,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (depth >= REEXPORT_MAX_DEPTH) return;
    for (const spec of scanExportDeclarations(rootFile, rootSource).specifiers) {
      yield* visitOneSpecifier(ctx, rootFile, spec, depth);
    }
  });

interface SiblingsResult {
  readonly siblings: ReadonlyArray<SourceFile>;
  readonly typeOnly: ReadonlySet<string>;
}

const buildSiblings = (
  picker: PickerCtx,
  rootFile: string,
  rootSource: string,
): Effect.Effect<SiblingsResult, never> =>
  Effect.gen(function* () {
    const ctx: CollectSiblingsCtx = {
      picker, out: [], seen: new Set(), typeOnly: new Set(),
    };
    yield* collectSiblings(ctx, rootFile, rootSource, 0);
    return { siblings: ctx.out, typeOnly: ctx.typeOnly };
  });

/**
 * @spec.assume "target file is UTF-8 text; binary files yield `null`"
 *   reason: readFileString decodes to string; non-UTF-8 throws at FS
 *           layer and the caller treats that as `null`.
 * @spec.guarantee "returns the first runtime-named export from `indexPath` (direct, named-from, or star re-export); `null` if none exists"
 *   reason: contract; `init` uses this to decide between scaffold-as-stub
 *           and bind-to-existing. Sibling pre-walk registers reachable
 *           re-export targets so collectExports resolves the graph.
 * @spec.residual-contract "sibling walk depth-bounded by REEXPORT_MAX_DEPTH=4 with per-file `seen`; cyclic chains stop at the bound"
 *   reason: ts-morph's walk has no structural cycle detection; the
 *           depth bound + seen-set are the termination guarantees.
 */
export const readFirstExport = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  indexPath: string,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    // Normalize to an absolute path so it matches the absolute sibling
    // paths the recursive walker produces via `path.resolve(baseDir, cand)`.
    // ts-morph's in-memory module resolution needs root + siblings to
    // share a path scheme; mixing relative root with absolute siblings
    // makes `from "./x.js"` resolve to nothing.
    const absIndex = path.resolve(indexPath);
    const source = yield* readSourceOrNull(fs, absIndex);
    if (source === null) return null;
    const scan = scanExportDeclarations(absIndex, source);
    const built = yield* buildSiblings({ fs, path }, absIndex, source);
    const entries = collectExports(absIndex, source, { siblings: built.siblings });
    // Merge root and transitive type-only filters.
    const typeOnly = new Set<string>(scan.typeOnlyPublicNames);
    for (const n of built.typeOnly) typeOnly.add(n);
    return firstRuntimeExport(entries, typeOnly);
  }).pipe(Effect.withSpan("commands/init-export-picker/readFirstExport"));
