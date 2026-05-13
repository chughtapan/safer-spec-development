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
import { Project, type ExportDeclaration } from "ts-morph";
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

const isRuntimeNamed = (e: DeclaredExport): boolean => {
  if (e.name === "default") return false;
  if (!IDENT_RE.test(e.name)) return false;
  if (RESERVED_WORDS.has(e.name)) return false;
  if (e.kind === "type" || e.kind === "interface") return false;
  if (e.kind === "enum" && CONST_ENUM_PREFIX_RE.test(e.signature)) return false;
  return true;
};

const firstRuntimeExport = (
  entries: ReadonlyArray<DeclaredExport>,
): string | null => {
  for (const e of entries) {
    if (isRuntimeNamed(e)) return e.name;
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

const specifiersFromSource = (
  filePath: string,
  source: string,
): ReadonlyArray<string> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  return sf
    .getExportDeclarations()
    .map((d: ExportDeclaration) => d.getModuleSpecifierValue())
    .filter((s): s is string => s !== undefined);
};

interface CollectSiblingsCtx {
  readonly picker: PickerCtx;
  readonly out: SourceFile[];
  readonly seen: Set<string>;
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
    for (const spec of specifiersFromSource(rootFile, rootSource)) {
      yield* visitOneSpecifier(ctx, rootFile, spec, depth);
    }
  });

const buildSiblings = (
  picker: PickerCtx,
  rootFile: string,
  rootSource: string,
): Effect.Effect<ReadonlyArray<SourceFile>, never> =>
  Effect.gen(function* () {
    const ctx: CollectSiblingsCtx = { picker, out: [], seen: new Set() };
    yield* collectSiblings(ctx, rootFile, rootSource, 0);
    return ctx.out;
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
    const siblings = yield* buildSiblings({ fs, path }, absIndex, source);
    const entries = collectExports(absIndex, source, { siblings });
    return firstRuntimeExport(entries);
  }).pipe(Effect.withSpan("commands/init-export-picker/readFirstExport"));
