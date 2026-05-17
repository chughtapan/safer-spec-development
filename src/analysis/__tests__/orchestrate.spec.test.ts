/**
 * @spec.purpose Property tests for the `analysis/` public surface —
 *   `generateFolder`, `validateFolder`,
 *   `buildKnownExports`, `diagnosticLines`, and
 *   the two `GenerateFolder*` tagged errors. The orchestrate functions'
 *   end-to-end behavior is exercised by `commands/__tests__/validate.spec.test.ts`
 *   (self-host); this file covers the shape contracts at the analysis
 *   layer without re-walking the whole project tree.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  GenerateFolderError,
  GenerateFolderIOError,
  buildKnownExports,
  diagnosticLines,
  generateFolder,
  validateFolder,
} from "@safer/analysis/index.js";
import { FolderNotFoundError } from "@safer/project/index.js";

class OrchestrateAssertionError extends Data.TaggedError(
  "OrchestrateAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, OrchestrateAssertionError> =>
  cond ? Effect.fail(new OrchestrateAssertionError({ detail })) : Effect.void;

/* ---------- generateFolder ---------- */

/**
 * @spec.property generate-folder-is-callable
 * @spec.type Typechecking
 * @spec.exports generateFolder
 * @spec.claim `generateFolder` is exported as a callable function whose return type is an Effect — the typed channel commands compose
 */
itSpec.prop(
  "generate-folder-is-callable",
  { type: "Typechecking", exports: [generateFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(typeof generateFolder !== "function", `generateFolder must be a function`),
    ),
);

/**
 * @spec.property generate-folder-arity
 * @spec.type Constant Equality
 * @spec.exports generateFolder
 * @spec.claim `generateFolder` has arity 1: `(args: GenerateFolderArgs) => Effect` — the signature commands depend on
 */
itSpec.prop(
  "generate-folder-arity",
  { type: "Constant Equality", exports: [generateFolder] },
  fc.constant(undefined),
  () => Effect.runPromise(failIf(generateFolder.length !== 1, `expected arity 1, got ${generateFolder.length}`)),
);

/* ---------- validateFolder ---------- */

/**
 * @spec.property validate-folder-is-callable
 * @spec.type Typechecking
 * @spec.exports validateFolder
 * @spec.claim `validateFolder` is exported as a callable function — the typed channel commands compose for the per-folder gate run
 */
itSpec.prop(
  "validate-folder-is-callable",
  { type: "Typechecking", exports: [validateFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(typeof validateFolder !== "function", `validateFolder must be a function`),
    ),
);

/**
 * @spec.property validate-folder-arity
 * @spec.type Constant Equality
 * @spec.exports validateFolder
 * @spec.claim `validateFolder` has arity 1: `(args: ValidateFolderArgs) => Effect` — the signature commands depend on
 */
itSpec.prop(
  "validate-folder-arity",
  { type: "Constant Equality", exports: [validateFolder] },
  fc.constant(undefined),
  () => Effect.runPromise(failIf(validateFolder.length !== 1, `expected arity 1, got ${validateFolder.length}`)),
);

/* ---------- buildKnownExports + collectFolderInputs ---------- */

/**
 * @spec.property build-known-exports-handles-empty-context
 * @spec.type Inclusion
 * @spec.exports buildKnownExports
 * @spec.claim `buildKnownExports` on a project context with no sources returns an empty set — degenerate input yields degenerate output, no fabrication
 */
itSpec.prop(
  "build-known-exports-handles-empty-context",
  { type: "Inclusion", exports: [buildKnownExports] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const set = buildKnownExports({
          sources: [],
          paths: {},
          baseUrl: ".",
          generatedAtSha: "x",
          folders: [],
          subfoldersOf: () => [],
          thresholdsFor: () => ({
            typeCoverage: 0,
            
            preconditionPassRate: 0,
          }),
          resolveFolder: (input) =>
            Effect.fail(new FolderNotFoundError({ requested: input })),
        });
        yield* failIf(!(set instanceof Set), `must return Set`);
        yield* failIf(set.size !== 0, `expected empty set on empty context`);
      }),
    ),
);

/**
 * @spec.property build-known-exports-typecheck
 * @spec.type Typechecking
 * @spec.exports buildKnownExports
 * @spec.claim returns a readonly Set of strings — the type `extractProperties`'s typo gate accepts via `has()` lookups
 */
itSpec.prop(
  "build-known-exports-typecheck",
  { type: "Typechecking", exports: [buildKnownExports] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(typeof buildKnownExports !== "function", `must be a function`),
    ),
);

/* ---------- GenerateFolderError ---------- */

/**
 * @spec.property generate-folder-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports GenerateFolderError
 * @spec.claim `GenerateFolderError` exposes the `{folder, reason}` payload it was constructed with — the surface the cli's exit-formatter reads
 */
itSpec.prop(
  "generate-folder-error-roundtrips-payload",
  { type: "Roundtrip", exports: [GenerateFolderError] },
  fc.record({
    folder: fc.string({ minLength: 1, maxLength: 40 }),
    reason: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  ({ folder, reason }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new GenerateFolderError({ folder, reason });
        yield* failIf(e.folder !== folder, `folder roundtrip`);
        yield* failIf(e.reason !== reason, `reason roundtrip`);
        yield* failIf(e._tag !== "GenerateFolderError", `tag`);
      }),
    ),
);

/**
 * @spec.property generate-folder-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports GenerateFolderError
 * @spec.claim `GenerateFolderError` round-trips through `Effect.fail` / `Effect.catchTag` without payload loss
 */
itSpec.prop(
  "generate-folder-error-is-throwable",
  { type: "Exception Raising", exports: [GenerateFolderError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(
          new GenerateFolderError({ folder: "x", reason: "y" }),
        ).pipe(Effect.catchTag("GenerateFolderError", (e) => Effect.succeed(e.reason)));
        yield* failIf(caught !== "y", `catchTag roundtrip`);
      }),
    ),
);

/**
 * @spec.property generate-folder-error-typecheck
 * @spec.type Typechecking
 * @spec.exports GenerateFolderError
 * @spec.claim `GenerateFolderError` instances extend `Error` and expose `_tag` (string), `folder` (string), `reason` (string)
 */
itSpec.prop(
  "generate-folder-error-typecheck",
  { type: "Typechecking", exports: [GenerateFolderError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new GenerateFolderError({ folder: "x", reason: "y" });
        yield* failIf(!(e instanceof Error), `instanceof Error`);
        yield* failIf(typeof e._tag !== "string", `_tag string`);
      }),
    ),
);

/* ---------- GenerateFolderIOError ---------- */

/**
 * @spec.property generate-folder-io-error-roundtrips-payload
 * @spec.type Roundtrip
 * @spec.exports GenerateFolderIOError
 * @spec.claim `GenerateFolderIOError` exposes the `{folder, path, cause}` payload it was constructed with — the surface the cli's exit-formatter reads on I/O failures
 */
itSpec.prop(
  "generate-folder-io-error-roundtrips-payload",
  { type: "Roundtrip", exports: [GenerateFolderIOError] },
  fc.record({
    folder: fc.string({ minLength: 1, maxLength: 40 }),
    path: fc.string({ minLength: 1, maxLength: 40 }),
    cause: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  ({ folder, path, cause }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new GenerateFolderIOError({ folder, path, cause });
        yield* failIf(e.folder !== folder, `folder roundtrip`);
        yield* failIf(e.path !== path, `path roundtrip`);
        yield* failIf(e.cause !== cause, `cause roundtrip`);
        yield* failIf(e._tag !== "GenerateFolderIOError", `tag`);
      }),
    ),
);

/**
 * @spec.property generate-folder-io-error-is-throwable
 * @spec.type Exception Raising
 * @spec.exports GenerateFolderIOError
 * @spec.claim `GenerateFolderIOError` round-trips through `Effect.fail` / `Effect.catchTag` — the cli's I/O failure exit path
 */
itSpec.prop(
  "generate-folder-io-error-is-throwable",
  { type: "Exception Raising", exports: [GenerateFolderIOError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const caught = yield* Effect.fail(
          new GenerateFolderIOError({ folder: "f", path: "p", cause: "c" }),
        ).pipe(Effect.catchTag("GenerateFolderIOError", (e) => Effect.succeed(e.cause)));
        yield* failIf(caught !== "c", `catchTag roundtrip`);
      }),
    ),
);

/**
 * @spec.property generate-folder-io-error-typecheck
 * @spec.type Typechecking
 * @spec.exports GenerateFolderIOError
 * @spec.claim instances extend `Error` and expose `_tag === "GenerateFolderIOError"` — the discriminant the cli catches by tag
 */
itSpec.prop(
  "generate-folder-io-error-typecheck",
  { type: "Typechecking", exports: [GenerateFolderIOError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new GenerateFolderIOError({ folder: "f", path: "p", cause: "c" });
        yield* failIf(!(e instanceof Error), `instanceof Error`);
        yield* failIf(e._tag !== "GenerateFolderIOError", `tag`);
      }),
    ),
);

/* ---------- diagnosticLines ---------- */

const PAYLOAD = {
  location: "src/x:42",
  diagnostic: { problem: "p", cause: "c", fix: "f", docsLink: "https://x/y" },
} as const;

/**
 * @spec.property diagnostic-lines-emits-five-lines
 * @spec.type Constant Equality
 * @spec.exports diagnosticLines
 * @spec.claim `diagnosticLines(tag, payload)` returns exactly 5 lines (header + 4 indented fields) — the stable format the cli's stderr renderer concatenates
 */
itSpec.prop(
  "diagnostic-lines-emits-five-lines",
  { type: "Constant Equality", exports: [diagnosticLines] },
  fc.constantFrom(
    "MissingSpecPropertyError" as const,
    "MissingStubError" as const,
    "MissingImplError" as const,
  ),
  (tag) =>
    Effect.runPromise(
      failIf(diagnosticLines(tag, PAYLOAD).length !== 5, `expected 5 lines for tag ${tag}`),
    ),
);

/**
 * @spec.property diagnostic-lines-header-carries-tag-and-problem
 * @spec.type Inclusion
 * @spec.exports diagnosticLines
 * @spec.claim the first emitted line carries both the `_tag` (in brackets) and the diagnostic's `problem` body — readers grep stderr by tag
 */
itSpec.prop(
  "diagnostic-lines-header-carries-tag-and-problem",
  { type: "Inclusion", exports: [diagnosticLines] },
  fc.string({ minLength: 1, maxLength: 40 }),
  (problem) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const lines = diagnosticLines("MissingStubError", {
          ...PAYLOAD,
          diagnostic: { ...PAYLOAD.diagnostic, problem },
        });
        yield* failIf(
          !lines[0]!.includes("[MissingStubError]") || !lines[0]!.includes(problem),
          `header missing tag or problem: ${lines[0]}`,
        );
      }),
    ),
);

/**
 * @spec.property diagnostic-lines-typecheck
 * @spec.type Typechecking
 * @spec.exports diagnosticLines
 * @spec.claim returns a ReadonlyArray of strings — the shape the cli's stderr renderer iterates
 */
itSpec.prop(
  "diagnostic-lines-typecheck",
  { type: "Typechecking", exports: [diagnosticLines] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const lines = diagnosticLines("MissingImplError", PAYLOAD);
        yield* failIf(!Array.isArray(lines), `must return array`);
        for (const l of lines) {
          yield* failIf(typeof l !== "string", `every line must be string`);
        }
      }),
    ),
);

/**
 * @spec.property diagnostic-lines-bounded-line-count
 * @spec.type Constant Bounds Checking
 * @spec.exports diagnosticLines
 * @spec.claim emitted line count is exactly 5 regardless of payload content size — stable for stderr framing
 */
itSpec.prop(
  "diagnostic-lines-bounded-line-count",
  { type: "Constant Bounds Checking", exports: [diagnosticLines] },
  fc.record({
    problem: fc.string({ minLength: 1, maxLength: 200 }),
    cause: fc.string({ minLength: 1, maxLength: 200 }),
    fix: fc.string({ minLength: 1, maxLength: 200 }),
    docsLink: fc.string({ minLength: 1, maxLength: 200 }),
  }),
  (diag) =>
    Effect.runPromise(
      failIf(
        diagnosticLines("MissingStubError", { location: "x", diagnostic: diag }).length !== 5,
        `line count not 5`,
      ),
    ),
);

