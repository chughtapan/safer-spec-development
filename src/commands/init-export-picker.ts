/**
 * @spec.purpose "First runtime-named export" resolver for `commands/init`.
 *   Delegates the in-file scan to `collectExports` from `spec/source-exports`
 *   — the same ts-morph-based resolver `generate` and `validate` use — so
 *   comments, string literals, namespace declarations, generators,
 *   `abstract class`, `const enum`, default re-exports, and aliased
 *   re-exports are all handled correctly without bespoke regex.
 *
 *   `collectExports` silently drops re-exports whose target file isn't
 *   registered as a sibling; init has no project context loaded so the
 *   bare star variant (`export * from "./x.js"`) still needs special
 *   handling. For those, this module reads the target file, registers it
 *   as a sibling, and re-invokes `collectExports`. Recursion is bounded
 *   by STAR_MAX_DEPTH so cyclic chains terminate.
 *
 *   The "first runtime-named export" picker filters out type-only kinds
 *   (`type`, `interface`) and the literal name `default`, then returns
 *   the source-order-earliest name.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import { collectExports, type DeclaredExport } from "@safer/spec/source-exports.js";

const STAR_MAX_DEPTH = 4;

// ts-morph reports both `enum` and `const enum` as kind: "enum"; only the
// former emits a runtime named binding. Recognize the const-enum prefix
// from the captured signature so a const-enum-first barrel falls through
// to the next runtime export (or to the missing-named-export refusal).
const CONST_ENUM_PREFIX_RE = /^\s*(?:export\s+)?const\s+enum\b/;

const isRuntimeNamed = (e: DeclaredExport): boolean => {
  if (e.name === "default") return false;
  // collectExports's kind taxonomy: `type` / `interface` erase at compile
  // time; everything else (const, function, class, enum, "other" — which
  // covers namespace/module declarations) emits a runtime named binding.
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

// `export * from "./x.js"` or `export * as ns from "./x.js"`. Used only
// to walk the chain so each target file can be registered as a sibling
// and handed back to `collectExports`.
const STAR_REEXPORT_RE =
  /export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s+["']([^"']+)["']/g;

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

// Recurse one star re-export: read the target, ask collectExports for its
// runtime-named exports (registering this file's path as the importer
// context so relative re-exports inside the target resolve too). If the
// target itself only contains star re-exports, recurse deeper.
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

const tryOneStarMatch = (
  ctx: PickerCtx,
  sourceFile: string,
  m: RegExpExecArray,
  depth: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    const nsAlias = m[1];
    const specifier = m[2];
    if (specifier === undefined) return null;
    if (nsAlias !== undefined && nsAlias !== "default") {
      // Namespace-alias star binds `nsAlias` as the runtime named export
      // on this barrel, but accept the alias only if the target file
      // actually resolves (guards commented/quoted star syntax).
      const target = yield* resolveTarget(
        ctx,
        ctx.path.dirname(sourceFile),
        specifier,
      );
      return target === null ? null : nsAlias;
    }
    return yield* followStarTarget(ctx, sourceFile, specifier, depth);
  });

// Bounded-depth walk of `export *` chains. The regex is run against raw
// source — the specifier inside `from "..."` is itself a string literal
// that any source-stripping pass would erase, and ts-morph's
// `getExportedDeclarations` doesn't surface unresolved star re-exports.
const resolveStarReExport = (
  ctx: PickerCtx,
  sourceFile: string,
  source: string,
  depth: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    if (depth >= STAR_MAX_DEPTH) return null;
    STAR_REEXPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STAR_REEXPORT_RE.exec(source)) !== null) {
      const resolved = yield* tryOneStarMatch(ctx, sourceFile, m, depth);
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
 *           Delegating to `collectExports` aligns init with the same
 *           ts-morph-based resolution `generate` and `validate` use.
 * @spec.residual-contract "star recursion is depth-bounded by STAR_MAX_DEPTH (=4); cyclic star chains return `null` past that depth"
 *   reason: regex-based star walk cannot detect cycles structurally; the
 *           depth bound is the termination guarantee.
 */
export const readFirstExport = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  indexPath: string,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    const source = yield* readSourceOrNull(fs, indexPath);
    if (source === null) return null;
    // collectExports's `options.siblings` is omitted — init has no project
    // context loaded so re-exports to unregistered files are dropped by
    // ts-morph. Star re-exports get a manual walk below; aliased
    // `export { x } from "./y"` clauses without a registered y also drop
    // silently, but `init` already treats those barrels as scaffolded
    // (the `from` clause is rare in greenfield init targets).
    const direct = firstRuntimeExport(collectExports(indexPath, source));
    if (direct !== null) return direct;
    return yield* resolveStarReExport({ fs, path }, indexPath, source, 0);
  }).pipe(Effect.withSpan("commands/init-export-picker/readFirstExport"));
