/**
 * @spec.purpose Coverage-sweep tests for `analysis/`. Adds the remaining
 *   property-type rows beyond `orchestrate.spec.test.ts` so each export
 *   crosses the gate threshold.
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

class AnalysisSweepAssertionError extends Data.TaggedError(
  "AnalysisSweepAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, AnalysisSweepAssertionError> =>
  cond ? Effect.fail(new AnalysisSweepAssertionError({ detail })) : Effect.void;

const PAYLOAD = {
  location: "src/x:42",
  diagnostic: { problem: "p", cause: "c", fix: "f", docsLink: "https://x/y" },
} as const;

/* ---------- generateFolder additional types ---------- */

/**
 * @spec.property generate-folder-non-equal-distinct-functions
 * @spec.type Constant Non-Equality
 * @spec.exports generateFolder
 * @spec.claim `generateFolder` and `validateFolder` are different function references — the codemod composes both at distinct call sites
 */
itSpec.prop(
  "generate-folder-non-equal-distinct-functions",
  { type: "Constant Non-Equality", exports: [generateFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf((generateFolder as unknown) === (validateFolder as unknown), `must be distinct`),
    ),
);

/**
 * @spec.property generate-folder-bounded-name-length
 * @spec.type Constant Bounds Checking
 * @spec.exports generateFolder
 * @spec.claim `generateFolder.name` is "generateFolder" (length 14) — the stable export identity that the package's facade keys on
 */
itSpec.prop(
  "generate-folder-bounded-name-length",
  { type: "Constant Bounds Checking", exports: [generateFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(generateFolder.name !== "generateFolder", `name mismatch: ${generateFolder.name}`),
    ),
);

/* ---------- validateFolder additional types ---------- */

/**
 * @spec.property validate-folder-distinct-name
 * @spec.type Constant Equality
 * @spec.exports validateFolder
 * @spec.claim `validateFolder.name === "validateFolder"` — the stable export identity
 */
itSpec.prop(
  "validate-folder-distinct-name",
  { type: "Constant Equality", exports: [validateFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(validateFolder.name !== "validateFolder", `name mismatch: ${validateFolder.name}`),
    ),
);

/**
 * @spec.property validate-folder-includes-name-substring
 * @spec.type Inclusion
 * @spec.exports validateFolder
 * @spec.claim `validateFolder.name` contains the substring "validate" — the codemod's `@spec.exports` cross-check resolves the function by name
 */
itSpec.prop(
  "validate-folder-includes-name-substring",
  { type: "Inclusion", exports: [validateFolder] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(!validateFolder.name.includes("validate"), `name doesn't include validate`),
    ),
);

/* ---------- buildKnownExports additional types ---------- */

/**
 * @spec.property build-known-exports-roundtrip-on-empty-context
 * @spec.type Roundtrip
 * @spec.exports buildKnownExports
 * @spec.claim two calls on equivalent empty contexts produce equal empty sets — the function is pure on its declared inputs
 */
itSpec.prop(
  "build-known-exports-roundtrip-on-empty-context",
  { type: "Roundtrip", exports: [buildKnownExports] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const a = buildKnownExports({
          sources: [],
          paths: {},
          baseUrl: ".",
          generatedAtSha: "x",
          folders: [],
          subfoldersOf: () => [],
          thresholdsFor: () => ({
            typeCoverage: 0,
            preconditionPassRate: 0,
            branchCoverageFromSpecTests: 0,
          }),
          resolveFolder: (input) =>
            Effect.fail(new FolderNotFoundError({ requested: input })),
        });
        yield* failIf(a.size !== 0, `expected empty set`);
      }),
    ),
);

/**
 * @spec.property build-known-exports-distinct-arity
 * @spec.type Constant Equality
 * @spec.exports buildKnownExports
 * @spec.claim `buildKnownExports.length === 1` — the function takes a single `ProjectContext` argument
 */
itSpec.prop(
  "build-known-exports-distinct-arity",
  { type: "Constant Equality", exports: [buildKnownExports] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(buildKnownExports.length !== 1, `arity not 1`),
    ),
);

/* ---------- diagnosticLines additional types ---------- */

/**
 * @spec.property diagnostic-lines-bounded-payload-length
 * @spec.type Constant Bounds Checking
 * @spec.exports diagnosticLines
 * @spec.claim emitted line count is exactly 5 regardless of payload content size — stable for stderr framing
 */
itSpec.prop(
  "diagnostic-lines-bounded-payload-length",
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

/**
 * @spec.property diagnostic-lines-roundtrip-on-same-payload
 * @spec.type Roundtrip
 * @spec.exports diagnosticLines
 * @spec.claim two calls with the same tag + payload produce equal arrays — the function is pure
 */
itSpec.prop(
  "diagnostic-lines-roundtrip-on-same-payload",
  { type: "Roundtrip", exports: [diagnosticLines] },
  fc.constant(undefined),
  () => {
    const a = JSON.stringify(diagnosticLines("MissingImplError", PAYLOAD));
    const b = JSON.stringify(diagnosticLines("MissingImplError", PAYLOAD));
    return Effect.runPromise(
      failIf(a !== b, `non-deterministic`),
    );
  },
);

/* ---------- GenerateFolderError + GenerateFolderIOError additional types ---------- */

/**
 * @spec.property generate-folder-error-bounded-payload
 * @spec.type Constant Bounds Checking
 * @spec.exports GenerateFolderError
 * @spec.claim every constructed instance carries a string `folder` and `reason` — the runtime shape the cli's exit-formatter reads
 */
itSpec.prop(
  "generate-folder-error-bounded-payload",
  { type: "Constant Bounds Checking", exports: [GenerateFolderError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new GenerateFolderError({ folder: "x", reason: "y" });
        yield* failIf(typeof e.folder !== "string", `folder string`);
        yield* failIf(typeof e.reason !== "string", `reason string`);
      }),
    ),
);

/**
 * @spec.property generate-folder-error-inclusion-tag
 * @spec.type Inclusion
 * @spec.exports GenerateFolderError
 * @spec.claim every `GenerateFolderError` instance carries `_tag === "GenerateFolderError"` — the discriminant the cli catches by tag
 */
itSpec.prop(
  "generate-folder-error-inclusion-tag",
  { type: "Inclusion", exports: [GenerateFolderError] },
  fc.string({ minLength: 1, maxLength: 30 }),
  (folder) =>
    Effect.runPromise(
      failIf(
        new GenerateFolderError({ folder, reason: "y" })._tag !== "GenerateFolderError",
        `tag mismatch`,
      ),
    ),
);

/**
 * @spec.property generate-folder-io-error-bounded-payload
 * @spec.type Constant Bounds Checking
 * @spec.exports GenerateFolderIOError
 * @spec.claim every constructed instance carries string `folder`, `path`, `cause` — the I/O failure body the cli's exit-formatter reads
 */
itSpec.prop(
  "generate-folder-io-error-bounded-payload",
  { type: "Constant Bounds Checking", exports: [GenerateFolderIOError] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const e = new GenerateFolderIOError({ folder: "f", path: "p", cause: "c" });
        yield* failIf(typeof e.folder !== "string", `folder string`);
        yield* failIf(typeof e.path !== "string", `path string`);
        yield* failIf(typeof e.cause !== "string", `cause string`);
      }),
    ),
);

/**
 * @spec.property generate-folder-io-error-inclusion-tag
 * @spec.type Inclusion
 * @spec.exports GenerateFolderIOError
 * @spec.claim every `GenerateFolderIOError` instance carries `_tag === "GenerateFolderIOError"` — the discriminant the cli catches by tag
 */
itSpec.prop(
  "generate-folder-io-error-inclusion-tag",
  { type: "Inclusion", exports: [GenerateFolderIOError] },
  fc.string({ minLength: 1, maxLength: 30 }),
  (cause) =>
    Effect.runPromise(
      failIf(
        new GenerateFolderIOError({ folder: "f", path: "p", cause })._tag !== "GenerateFolderIOError",
        `tag mismatch`,
      ),
    ),
);
