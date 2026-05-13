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
 *   Before scanning, line/block comments and string literals are blanked
 *   out (replaced with same-length whitespace runs so source-position
 *   tie-breaking stays correct). This keeps commented-out `export` lines
 *   and quoted-string content from masquerading as real declarations.
 *
 *   Resolution order on the read file:
 *     1. Direct value declarations
 *        (`export const|let|var|class|enum|function|async function|`
 *        `abstract class`). `type` / `interface` / `const enum` are
 *        excluded — type-erased and not importable as runtime values.
 *        `abstract class` emits a runtime named export.
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

// Two passes keep each regex's sonarjs/regex-complexity score under the cap.
// PRIMARY: bare-keyword declarations; `const(?!\s+enum)` rejects type-erased
// `export const enum`. MODIFIED: declarations that start with a modifier
// keyword (`async function`, `abstract class`) — both runtime-named.
const VALUE_EXPORT_PRIMARY_RE =
  /export\s+(?:const(?!\s+enum)|let|var|function|class|enum)\s+([A-Za-z_$][\w$]*)/g;
const VALUE_EXPORT_MODIFIED_RE =
  /export\s+(?:async\s+function|abstract\s+class)\s+([A-Za-z_$][\w$]*)/g;
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

// Replace each match with same-length run of spaces so source indices stay
// stable for the "earliest match wins" comparison after stripping. Strings
// are scrubbed first so a `/*` inside a string literal cannot trip the
// block-comment regex (and a `//` inside a string cannot trip line
// comments).
const STRIP_DOUBLE_STRING_RE = /"(?:\\.|[^"\\])*"/g;
const STRIP_SINGLE_STRING_RE = /'(?:\\.|[^'\\])*'/g;
const STRIP_TEMPLATE_RE = /`(?:\\.|[^`\\])*`/g;
const STRIP_BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const STRIP_LINE_COMMENT_RE = /\/\/[^\n]*/g;

const blankOut = (match: string): string => match.replace(/[^\n]/g, " ");

const stripNonCode = (source: string): string =>
  source
    .replace(STRIP_DOUBLE_STRING_RE, blankOut)
    .replace(STRIP_SINGLE_STRING_RE, blankOut)
    .replace(STRIP_TEMPLATE_RE, blankOut)
    .replace(STRIP_BLOCK_COMMENT_RE, blankOut)
    .replace(STRIP_LINE_COMMENT_RE, blankOut);

interface Match {
  readonly idx: number;
  readonly name: string;
}

const toMatch = (m: RegExpExecArray | null): Match | null =>
  m === null ? null : { idx: m.index, name: m[1] ?? "" };

const earlier = (a: Match | null, b: Match | null): Match | null => {
  if (a === null) return b;
  if (b === null) return a;
  return a.idx <= b.idx ? a : b;
};

const findFirstValueExport = (code: string): Match | null => {
  VALUE_EXPORT_PRIMARY_RE.lastIndex = 0;
  VALUE_EXPORT_MODIFIED_RE.lastIndex = 0;
  return earlier(
    toMatch(VALUE_EXPORT_PRIMARY_RE.exec(code)),
    toMatch(VALUE_EXPORT_MODIFIED_RE.exec(code)),
  );
};

const findFirstNamedExport = (source: string): string | null => {
  const code = stripNonCode(source);
  const direct = findFirstValueExport(code);
  const reExport = findFirstRuntimeReExport(code);
  if (direct === null) return reExport === null ? null : reExport.name;
  if (reExport === null) return direct.name;
  return direct.idx <= reExport.idx ? direct.name : reExport.name;
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
    const code = stripNonCode(source);
    STAR_REEXPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STAR_REEXPORT_RE.exec(code)) !== null) {
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
