/**
 * @spec.purpose "First runtime-named export" resolver for `commands/init`.
 *   Delegates the in-file scan to `collectExports` from `spec/source-exports`
 *   — the same ts-morph-based resolver `generate` and `validate` use — so
 *   comments, string literals, namespace declarations, generators,
 *   `abstract class`, `const enum`, default re-exports, and aliased
 *   re-exports are all handled correctly without bespoke regex.
 *
 *   `collectExports` silently drops re-exports whose target file isn't
 *   registered as a sibling; init has no project context loaded, so the
 *   bare star variants (`export * from "./x.js"`, `export * as ns from
 *   "./x.js"`) need a separate walk. That walk also uses ts-morph
 *   (`SourceFile.getExportDeclarations`) — not regex — so commented or
 *   string-quoted star syntax is structurally ignored. For each parsed
 *   star statement, this module reads the target file off disk and
 *   re-invokes `collectExports`. Recursion is bounded by STAR_MAX_DEPTH
 *   so cyclic chains terminate.
 *
 *   `isRuntimeNamed` filters the collectExports result to entries that
 *   can back a `import { name } from "../index.js"` line: skips
 *   `default`, `type` / `interface` (erased), `const enum` (erased
 *   under default TS config), and names that aren't valid JS
 *   identifiers (`export { x as "x-y" }` — the public name is a string
 *   literal and can't be interpolated into the import template).
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import { Project, type ExportDeclaration } from "ts-morph";
import { collectExports, type DeclaredExport } from "@safer/spec/source-exports.js";

const STAR_MAX_DEPTH = 4;

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const CONST_ENUM_PREFIX_RE = /^\s*(?:export\s+)?const\s+enum\b/;

const isRuntimeNamed = (e: DeclaredExport): boolean => {
  if (e.name === "default") return false;
  // Filters string-literal export aliases (`export { x as "x-y" }`):
  // collectExports returns the public name `x-y`, which is not a valid
  // identifier and would emit `import { x-y } from ...` (syntax error).
  if (!IDENT_RE.test(e.name)) return false;
  if (e.kind === "type" || e.kind === "interface") return false;
  // ts-morph reports both `enum` and `const enum` as kind: "enum"; only
  // the former emits a runtime named binding. Recognize the const-enum
  // prefix from the captured signature so a const-enum-first barrel
  // falls through to the next runtime export (or to the
  // no-named-export refusal).
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

interface StarReExport {
  /** Present for `export * as ns from "..."`; null for bare `export * from`. */
  readonly nsAlias: string | null;
  readonly specifier: string;
}

// `null` if the declaration is not a star re-export — either it has no
// `from` clause (`export { ... }` is a local re-export, not a star) or
// it's a named-clause re-export (`export { a, b } from "..."`), which
// `collectExports` already resolves when given siblings.
const asStarReExport = (decl: ExportDeclaration): StarReExport | null => {
  const specifier = decl.getModuleSpecifierValue();
  if (specifier === undefined) return null;
  if (decl.getNamedExports().length > 0) return null;
  const ns = decl.getNamespaceExport();
  return { nsAlias: ns === undefined ? null : ns.getName(), specifier };
};

// Use ts-morph to find star re-exports — the parser ignores comments and
// string literals structurally, so commented or quoted star syntax cannot
// produce a match.
const findStarReExports = (
  filePath: string,
  source: string,
): ReadonlyArray<StarReExport> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  return sf
    .getExportDeclarations()
    .map(asStarReExport)
    .filter((x): x is StarReExport => x !== null);
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

const followStarTarget = (
  ctx: PickerCtx,
  sourceFile: string,
  specifier: string,
  depth: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    const target = yield* resolveTarget(ctx, ctx.path.dirname(sourceFile), specifier);
    if (target === null) return null;
    const direct = firstRuntimeExport(collectExports(target.path, target.source));
    if (direct !== null) return direct;
    return yield* resolveStarReExport(ctx, target.path, target.source, depth + 1);
  });

const tryOneStar = (
  ctx: PickerCtx,
  sourceFile: string,
  star: StarReExport,
  depth: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    if (star.nsAlias !== null && star.nsAlias !== "default") {
      const target = yield* resolveTarget(
        ctx,
        ctx.path.dirname(sourceFile),
        star.specifier,
      );
      return target === null ? null : star.nsAlias;
    }
    return yield* followStarTarget(ctx, sourceFile, star.specifier, depth);
  });

const resolveStarReExport = (
  ctx: PickerCtx,
  sourceFile: string,
  source: string,
  depth: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    if (depth >= STAR_MAX_DEPTH) return null;
    for (const star of findStarReExports(sourceFile, source)) {
      const resolved = yield* tryOneStar(ctx, sourceFile, star, depth);
      if (resolved !== null) return resolved;
    }
    return null;
  });

/**
 * @spec.assume "target file is encoded UTF-8 text; binary files yield `null` instead of crashing"
 *   reason: FileSystem.readFileString decodes to a string; non-UTF-8
 *           input would already throw at the FS layer and the caller
 *           treats that as `null`.
 * @spec.guarantee "returns the first runtime-named export resolvable from `indexPath` (direct declaration, in-file re-export clause, or a recursively-resolved star re-export); returns `null` if none exists"
 *   reason: contract; `init` uses this to decide between scaffold-as-stub
 *           (placeholder) and bind-to-existing (the returned symbol).
 *           Delegating to `collectExports` + `getExportDeclarations`
 *           aligns init with the same ts-morph-based resolution
 *           `generate` and `validate` use.
 * @spec.residual-contract "star recursion is depth-bounded by STAR_MAX_DEPTH (=4); cyclic star chains return `null` past that depth"
 *   reason: ts-morph's star walk follows specifiers one hop at a time
 *           without cycle detection; the depth bound is the termination
 *           guarantee.
 */
export const readFirstExport = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  indexPath: string,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    const source = yield* readSourceOrNull(fs, indexPath);
    if (source === null) return null;
    const direct = firstRuntimeExport(collectExports(indexPath, source));
    if (direct !== null) return direct;
    return yield* resolveStarReExport({ fs, path }, indexPath, source, 0);
  }).pipe(Effect.withSpan("commands/init-export-picker/readFirstExport"));
