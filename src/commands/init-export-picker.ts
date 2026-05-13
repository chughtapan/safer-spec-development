/**
 * @spec.purpose Regex-based "first runtime-named export" resolver for
 *   `commands/init`. Extracted from `init.ts` so that file stays under the
 *   per-folder line cap; nothing else consumes the picker today.
 *
 *   The picker is intentionally lightweight (no ts-morph, no project
 *   context) — init runs before any project config has been loaded and
 *   only needs ONE valid runtime symbol to bind the generated test stub's
 *   `import { ... } from "../index.js"` line.
 *
 *   Resolution order on the read file:
 *     1. Direct value declarations
 *        (`export const|let|var|class|enum|function|async function`).
 *        `type` / `interface` / `const enum` are excluded — type-erased
 *        and not importable as runtime values.
 *     2. `export { ... }` clauses (not `export type { ... }`). Per entry,
 *        `foo as bar` resolves to `bar` (publicly-bound name);
 *        `{ default }` and `{ foo as default }` skip; `{ default as foo }`
 *        resolves to `foo`.
 *     3. `export *` re-exports — `export * as ns from ...` binds `ns` as
 *        a runtime named export and stops there; `export * from ...`
 *        recurses into the target file (mapping `.js` to `.ts`/`.tsx`,
 *        bare specifiers to `&lt;spec>.ts`/`&lt;spec>.tsx`/`&lt;spec>/index.ts`),
 *        bounded by STAR_MAX_DEPTH to guard against cyclic chains.
 *   Returns `null` if no runtime-named export resolves.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

const VALUE_EXPORT_RE =
  /export\s+(?:const(?!\s+enum)|let|var|async\s+function|function|class|enum)\s+([A-Za-z_$][\w$]*)/g;
const RE_EXPORT_CLAUSE_RE = /export(?!\s+type)\s*\{([^}]+)\}/g;
const RE_EXPORT_AS_RE = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/;
const RE_EXPORT_PLAIN_RE = /^([A-Za-z_$][\w$]*)$/;
const STAR_REEXPORT_RE =
  /export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s+["']([^"']+)["']/g;

const STAR_MAX_DEPTH = 4;

const pickAliasedPublicName = (part: string): string | null => {
  const m = RE_EXPORT_AS_RE.exec(part);
  if (m === null) return null;
  const publicName = m[2];
  if (publicName === undefined || publicName === "default") return null;
  return publicName;
};

const pickPlainName = (part: string): string | null => {
  const m = RE_EXPORT_PLAIN_RE.exec(part);
  if (m === null) return null;
  const name = m[1];
  if (name === undefined || name === "default") return null;
  return name;
};

const firstRuntimeNameInClause = (body: string): string | null => {
  for (const raw of body.split(",")) {
    const part = raw.trim();
    if (part === "" || part.startsWith("type ")) continue;
    const name = pickAliasedPublicName(part) ?? pickPlainName(part);
    if (name !== null) return name;
  }
  return null;
};

const findFirstRuntimeReExport = (
  source: string,
): { readonly idx: number; readonly name: string } | null => {
  RE_EXPORT_CLAUSE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_EXPORT_CLAUSE_RE.exec(source)) !== null) {
    const name = firstRuntimeNameInClause(m[1] ?? "");
    if (name !== null) return { idx: m.index, name };
  }
  return null;
};

const findFirstNamedExport = (source: string): string | null => {
  VALUE_EXPORT_RE.lastIndex = 0;
  const direct = VALUE_EXPORT_RE.exec(source);
  const reExport = findFirstRuntimeReExport(source);
  if (direct === null) return reExport === null ? null : reExport.name;
  if (reExport === null) return direct[1] ?? null;
  return direct.index <= reExport.idx ? (direct[1] ?? null) : reExport.name;
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

const followStarTarget = (
  ctx: PickerCtx,
  baseDir: string,
  specifier: string,
  depth: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    for (const cand of tsCandidatesFor(specifier)) {
      const candPath = ctx.path.resolve(baseDir, cand);
      const candSource = yield* readSourceOrNull(ctx.fs, candPath);
      if (candSource === null) continue;
      const direct = findFirstNamedExport(candSource);
      if (direct !== null) return direct;
      const nested = yield* resolveStarReExport(ctx, candPath, candSource, depth + 1);
      if (nested !== null) return nested;
    }
    return null;
  });

const tryOneStarMatch = (
  ctx: PickerCtx,
  sourceFile: string,
  m: RegExpExecArray,
  depth: number,
): Effect.Effect<string | null, never> => {
  const nsAlias = m[1];
  const specifier = m[2];
  if (specifier === undefined) return Effect.succeed(null);
  if (nsAlias !== undefined && nsAlias !== "default") return Effect.succeed(nsAlias);
  return followStarTarget(ctx, ctx.path.dirname(sourceFile), specifier, depth);
};

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
 *   reason: regex picker reads via FileSystem.readFileString which decodes
 *           to a string; non-UTF-8 input would already throw at the FS layer
 *           and the caller treats that as `null`.
 * @spec.guarantee "returns the first runtime-named export resolvable from `indexPath` (direct, clause, or star); returns `null` if none exists"
 *   reason: contract; `init` uses this to decide between scaffold-as-stub
 *           (placeholder) and bind-to-existing (the returned symbol).
 * @spec.residual-contract "star recursion is depth-bounded by STAR_MAX_DEPTH; cyclic star chains return `null` past that depth"
 *   reason: regex-based resolver cannot detect cycles; depth bound is the
 *           termination guarantee.
 */
export const readFirstExport = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  indexPath: string,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    const source = yield* readSourceOrNull(fs, indexPath);
    if (source === null) return null;
    const direct = findFirstNamedExport(source);
    if (direct !== null) return direct;
    return yield* resolveStarReExport({ fs, path }, indexPath, source, 0);
  }).pipe(Effect.withSpan("commands/init-export-picker/readFirstExport"));
