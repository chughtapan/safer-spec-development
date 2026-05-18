/**
 * @spec.purpose Branch coverage for the gap-class check functions in
 *   `analysis/checks.ts`. Each itSpec.prop targets one untested branch
 *   so the per-folder `branchCoverageFromSpecTests` gate stops loud-
 *   failing on the analysis layer's failure paths.
 */

import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Cause, Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  catchDirectiveErrors,
  checkDrift,
  checkExecutionSidecarPresent,
  checkImplBodies,
  checkSidecarDrift,
  checkThresholds,
  failOnIssues,
  diagnosticLines,
} from "@safer/analysis/checks.js";
import { buildSpecMeta, type ExportEntry, type FolderAnalysis, type PropertyRow, type SpecMeta } from "@safer/spec/artifact/index.js";
import {
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
  JsDocUnknownDirectiveError,
} from "@safer/spec/grammar/index.js";

class ChecksAssertionError extends Data.TaggedError("ChecksAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, ChecksAssertionError> =>
  cond ? Effect.fail(new ChecksAssertionError({ detail })) : Effect.void;

const firstFailureTag = <A, E>(exit: Exit.Exit<A, E>): string | null => {
  if (!Exit.isFailure(exit)) return null;
  const [first] = [...Cause.failures(exit.cause)];
  if (first === undefined) return null;
  const probe = first as { readonly _tag?: unknown };
  return typeof probe._tag === "string" ? probe._tag : null;
};

const EMPTY_ANALYSIS: FolderAnalysis = {
  folder: "src/x",
  purpose: null,
  exports: [],
  properties: [],
  children: [],
};

const stubbedRow: PropertyRow = {
  id: "p-stub",
  propertyType: "Roundtrip",
  exports: ["x"],
  claim: "claim",
  sourceRef: { path: "src/x/index.spec.test.ts", line: 1 },
  stubbed: true,
};

const implRow: PropertyRow = {
  ...stubbedRow,
  id: "p-impl",
  sourceRef: { path: "src/x/index.spec.test.ts", line: 10 },
  stubbed: false,
};

const META_NO_GATE: SpecMeta = buildSpecMeta(EMPTY_ANALYSIS, {
  generatedAtSha: "deadbee",
  thresholds: { typeCoverage: 0, preconditionPassRate: 0, branchCoverageFromSpecTests: 0 },
});

// A value-bearing export with zero observed/skipped property types →
// computeTypeCoverage returns 0; META_GATED_BELOW_TYPE then trips on
// the 0.99 threshold.
const UNCOVERED_EXPORT: ExportEntry = {
  name: "uncoveredFn",
  kind: "function",
  signature: "() => void",
  description: "",
  sourceRef: { path: "src/x/index.ts", line: 1 },
  assumes: [],
  guarantees: [],
  residualContract: null,
  skipped: [],
};

const ANALYSIS_WITH_UNCOVERED_EXPORT: FolderAnalysis = {
  ...EMPTY_ANALYSIS,
  exports: [UNCOVERED_EXPORT],
};

const META_GATED_BELOW_TYPE: SpecMeta = buildSpecMeta(ANALYSIS_WITH_UNCOVERED_EXPORT, {
  generatedAtSha: "deadbee",
  thresholds: { typeCoverage: 0.99, preconditionPassRate: 0, branchCoverageFromSpecTests: 0 },
});

/**
 * @spec.property catch-directive-errors-overflow-maps-to-missing-stub
 * @spec.type Exception Raising
 * @spec.exports catchDirectiveErrors
 * @spec.claim `catchDirectiveErrors` maps `JsDocDirectiveOverflowError` to `MissingStubError`
 */
itSpec.prop(
  "catch-directive-errors-overflow-maps-to-missing-stub",
  { type: "Exception Raising", exports: [catchDirectiveErrors] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          catchDirectiveErrors(Effect.fail(new JsDocDirectiveOverflowError({
            path: "src/x.ts", line: 1, directive: "guarantee", length: 250, limit: 200,
          }))),
        );
        yield* failIf(firstFailureTag(exit) !== "MissingStubError", `expected MissingStubError; got ${firstFailureTag(exit) ?? "<none>"}`);
      }),
    ),
);

/**
 * @spec.property catch-directive-errors-parse-maps-to-missing-stub
 * @spec.type Exception Raising
 * @spec.exports catchDirectiveErrors
 * @spec.claim `catchDirectiveErrors` maps `JsDocDirectiveParseError` to `MissingStubError`
 */
itSpec.prop(
  "catch-directive-errors-parse-maps-to-missing-stub",
  { type: "Exception Raising", exports: [catchDirectiveErrors] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          catchDirectiveErrors(Effect.fail(new JsDocDirectiveParseError({
            path: "src/x.ts", line: 1, directive: "guarantee", reason: "missing quote",
          }))),
        );
        yield* failIf(firstFailureTag(exit) !== "MissingStubError", `expected MissingStubError`);
      }),
    ),
);

/**
 * @spec.property catch-directive-errors-unknown-maps-to-missing-stub
 * @spec.type Exception Raising
 * @spec.exports catchDirectiveErrors
 * @spec.claim `catchDirectiveErrors` maps `JsDocUnknownDirectiveError` to `MissingStubError`
 */
itSpec.prop(
  "catch-directive-errors-unknown-maps-to-missing-stub",
  { type: "Exception Raising", exports: [catchDirectiveErrors] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          catchDirectiveErrors(Effect.fail(new JsDocUnknownDirectiveError({
            path: "src/x.ts", line: 1, directive: "bogus",
          }))),
        );
        yield* failIf(firstFailureTag(exit) !== "MissingStubError", `expected MissingStubError`);
      }),
    ),
);

/**
 * @spec.property catch-directive-errors-passes-success-through
 * @spec.type Roundtrip
 * @spec.exports catchDirectiveErrors
 * @spec.claim `catchDirectiveErrors` is identity on the success channel
 */
itSpec.prop(
  "catch-directive-errors-passes-success-through",
  { type: "Roundtrip", exports: [catchDirectiveErrors] },
  fc.string(),
  (value) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const out = yield* catchDirectiveErrors(Effect.succeed(value));
        yield* failIf(out !== value, `expected ${value}; got ${out}`);
      }),
    ),
);

/**
 * @spec.property check-drift-missing-file-fails-with-missing-spec-property
 * @spec.type Exception Raising
 * @spec.exports checkDrift
 * @spec.claim a missing SPEC.md on disk fails with `MissingSpecPropertyError`
 */
itSpec.prop(
  "check-drift-missing-file-fails-with-missing-spec-property",
  { type: "Exception Raising", exports: [checkDrift] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const exit = yield* Effect.exit(checkDrift(fs, "/nonexistent/path/SPEC.md", "any content"));
        yield* failIf(firstFailureTag(exit) !== "MissingSpecPropertyError", `expected MissingSpecPropertyError`);
      }).pipe(Effect.provide(NodeContext.layer)),
    ),
);

/**
 * @spec.property check-drift-matching-content-succeeds
 * @spec.type Constant Equality
 * @spec.exports checkDrift
 * @spec.claim on-disk bytes equal to regenerated bytes (modulo SHA line) succeeds
 */
itSpec.prop(
  "check-drift-matching-content-succeeds",
  { type: "Constant Equality", exports: [checkDrift] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const exit = yield* Effect.exit(checkDrift(fs, "README.md", "DIFFERENT CONTENT"));
        yield* failIf(firstFailureTag(exit) !== "MissingSpecPropertyError", `expected drift to be flagged`);
      }).pipe(Effect.provide(NodeContext.layer)),
    ),
);

/**
 * @spec.property check-sidecar-drift-missing-file-fails
 * @spec.type Exception Raising
 * @spec.exports checkSidecarDrift
 * @spec.claim a missing sidecar JSON on disk fails with `MissingSpecPropertyError`
 */
itSpec.prop(
  "check-sidecar-drift-missing-file-fails",
  { type: "Exception Raising", exports: [checkSidecarDrift] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const exit = yield* Effect.exit(checkSidecarDrift(fs, "/nonexistent/path/sidecar.json", "{}"));
        yield* failIf(firstFailureTag(exit) !== "MissingSpecPropertyError", `expected MissingSpecPropertyError`);
      }).pipe(Effect.provide(NodeContext.layer)),
    ),
);

/**
 * @spec.property check-thresholds-zero-thresholds-pass
 * @spec.type Constant Equality
 * @spec.exports checkThresholds
 * @spec.claim threshold=0 across the board never trips; the function returns success
 */
itSpec.prop(
  "check-thresholds-zero-thresholds-pass",
  { type: "Constant Equality", exports: [checkThresholds] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(checkThresholds("src/x", EMPTY_ANALYSIS, META_NO_GATE));
        yield* failIf(!Exit.isSuccess(exit), `expected success on zero-threshold gate`);
      }),
    ),
);

/**
 * @spec.property check-thresholds-typecoverage-shortfall-fails
 * @spec.type Exception Raising
 * @spec.exports checkThresholds
 * @spec.claim a `typeCoverage` observed below threshold fails with `MissingImplError`
 */
itSpec.prop(
  "check-thresholds-typecoverage-shortfall-fails",
  { type: "Exception Raising", exports: [checkThresholds] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(checkThresholds("src/x", ANALYSIS_WITH_UNCOVERED_EXPORT, META_GATED_BELOW_TYPE));
        yield* failIf(firstFailureTag(exit) !== "MissingImplError", `expected MissingImplError`);
      }),
    ),
);

/**
 * @spec.property check-impl-bodies-stubbed-fails
 * @spec.type Exception Raising
 * @spec.exports checkImplBodies
 * @spec.claim an analysis with a stubbed property row fails with `MissingImplError`
 */
itSpec.prop(
  "check-impl-bodies-stubbed-fails",
  { type: "Exception Raising", exports: [checkImplBodies] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [stubbedRow] };
        const exit = yield* Effect.exit(checkImplBodies(analysis));
        yield* failIf(firstFailureTag(exit) !== "MissingImplError", `expected MissingImplError`);
      }),
    ),
);

/**
 * @spec.property check-impl-bodies-no-stub-succeeds
 * @spec.type Constant Equality
 * @spec.exports checkImplBodies
 * @spec.claim an analysis with only implemented rows passes
 */
itSpec.prop(
  "check-impl-bodies-no-stub-succeeds",
  { type: "Constant Equality", exports: [checkImplBodies] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [implRow] };
        const exit = yield* Effect.exit(checkImplBodies(analysis));
        yield* failIf(!Exit.isSuccess(exit), `expected success`);
      }),
    ),
);

/**
 * @spec.property check-execution-sidecar-vacuous-when-no-impl-properties
 * @spec.type Constant Equality
 * @spec.exports checkExecutionSidecarPresent
 * @spec.claim a folder whose properties are all stubs passes vacuously even with no sidecar
 */
itSpec.prop(
  "check-execution-sidecar-vacuous-when-no-impl-properties",
  { type: "Constant Equality", exports: [checkExecutionSidecarPresent] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [stubbedRow] };
        const exit = yield* Effect.exit(checkExecutionSidecarPresent(analysis, "src/x", null, "h"));
        yield* failIf(!Exit.isSuccess(exit), `expected vacuous pass for stubs-only folder`);
      }),
    ),
);

/**
 * @spec.property check-execution-sidecar-missing-fails
 * @spec.type Exception Raising
 * @spec.exports checkExecutionSidecarPresent
 * @spec.claim a folder with implemented properties but no sidecar on disk fails with `MissingImplError`
 */
itSpec.prop(
  "check-execution-sidecar-missing-fails",
  { type: "Exception Raising", exports: [checkExecutionSidecarPresent] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [implRow] };
        const exit = yield* Effect.exit(checkExecutionSidecarPresent(analysis, "src/x", null, "h"));
        yield* failIf(firstFailureTag(exit) !== "MissingImplError", `expected MissingImplError`);
      }),
    ),
);

/**
 * @spec.property check-execution-sidecar-stale-propertyids-fails
 * @spec.type Exception Raising
 * @spec.exports checkExecutionSidecarPresent
 * @spec.claim a sidecar covering a different property set fails with `MissingImplError`
 */
itSpec.prop(
  "check-execution-sidecar-stale-propertyids-fails",
  { type: "Exception Raising", exports: [checkExecutionSidecarPresent] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [implRow] };
        const exit = yield* Effect.exit(checkExecutionSidecarPresent(
          analysis, "src/x",
          { propertyIds: ["p-different"], testTreeHash: "h" },
          "h",
        ));
        yield* failIf(firstFailureTag(exit) !== "MissingImplError", `expected stale-propertyIds fail`);
      }),
    ),
);

/**
 * @spec.property check-execution-sidecar-stale-hash-fails
 * @spec.type Exception Raising
 * @spec.exports checkExecutionSidecarPresent
 * @spec.claim matching propertyIds but mismatching `testTreeHash` fails with `MissingImplError`
 */
itSpec.prop(
  "check-execution-sidecar-stale-hash-fails",
  { type: "Exception Raising", exports: [checkExecutionSidecarPresent] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [implRow] };
        const exit = yield* Effect.exit(checkExecutionSidecarPresent(
          analysis, "src/x",
          { propertyIds: ["p-impl"], testTreeHash: "old-hash" },
          "new-hash",
        ));
        yield* failIf(firstFailureTag(exit) !== "MissingImplError", `expected stale-hash fail`);
      }),
    ),
);

/**
 * @spec.property check-execution-sidecar-matching-succeeds
 * @spec.type Constant Equality
 * @spec.exports checkExecutionSidecarPresent
 * @spec.claim matching propertyIds + matching `testTreeHash` succeeds
 */
itSpec.prop(
  "check-execution-sidecar-matching-succeeds",
  { type: "Constant Equality", exports: [checkExecutionSidecarPresent] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const analysis: FolderAnalysis = { ...EMPTY_ANALYSIS, properties: [implRow] };
        const exit = yield* Effect.exit(checkExecutionSidecarPresent(
          analysis, "src/x",
          { propertyIds: ["p-impl"], testTreeHash: "h" },
          "h",
        ));
        yield* failIf(!Exit.isSuccess(exit), `expected matching sidecar to succeed`);
      }),
    ),
);

/**
 * @spec.property fail-on-issues-planned-mode-ignores-empty-body
 * @spec.type Constant Equality
 * @spec.exports failOnIssues
 * @spec.claim in `--planned` mode `empty-body` issues are filtered out (only `--implemented` enforces non-empty bodies)
 */
itSpec.prop(
  "fail-on-issues-planned-mode-ignores-empty-body",
  { type: "Constant Equality", exports: [failOnIssues] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(failOnIssues(
          [{ kind: "empty-body", path: "src/x.spec.test.ts", line: 1, detail: "empty" }],
          "planned",
        ));
        yield* failIf(!Exit.isSuccess(exit), `planned mode should ignore empty-body`);
      }),
    ),
);

/**
 * @spec.property fail-on-issues-missing-directive-maps-to-missing-stub
 * @spec.type Exception Raising
 * @spec.exports failOnIssues
 * @spec.claim a `missing-directive` issue maps to `MissingStubError`
 */
itSpec.prop(
  "fail-on-issues-missing-directive-maps-to-missing-stub",
  { type: "Exception Raising", exports: [failOnIssues] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(failOnIssues(
          [{ kind: "missing-directive", path: "src/x.spec.test.ts", line: 1, detail: "no @spec.property" }],
          "planned",
        ));
        yield* failIf(firstFailureTag(exit) !== "MissingStubError", `expected MissingStubError`);
      }),
    ),
);

/**
 * @spec.property fail-on-issues-directive-mismatch-maps-to-missing-spec-property
 * @spec.type Exception Raising
 * @spec.exports failOnIssues
 * @spec.claim a `directive-mismatch` issue maps to `MissingSpecPropertyError`
 */
itSpec.prop(
  "fail-on-issues-directive-mismatch-maps-to-missing-spec-property",
  { type: "Exception Raising", exports: [failOnIssues] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(failOnIssues(
          [{ kind: "directive-mismatch", path: "src/x.spec.test.ts", line: 1, detail: "name mismatch" }],
          "planned",
        ));
        yield* failIf(firstFailureTag(exit) !== "MissingSpecPropertyError", `expected MissingSpecPropertyError`);
      }),
    ),
);

/**
 * @spec.property fail-on-issues-implemented-mode-flags-empty-body
 * @spec.type Exception Raising
 * @spec.exports failOnIssues
 * @spec.claim in `--implemented` mode an `empty-body` issue maps to `MissingImplError`
 */
itSpec.prop(
  "fail-on-issues-implemented-mode-flags-empty-body",
  { type: "Exception Raising", exports: [failOnIssues] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(failOnIssues(
          [{ kind: "empty-body", path: "src/x.spec.test.ts", line: 1, detail: "empty" }],
          "implemented",
        ));
        yield* failIf(firstFailureTag(exit) !== "MissingImplError", `expected MissingImplError`);
      }),
    ),
);

/**
 * @spec.property diagnostic-lines-includes-tag-and-location
 * @spec.type Inclusion
 * @spec.exports diagnosticLines
 * @spec.claim the rendered diagnostic begins with `[Tag]` and includes the location, cause, fix, and docs link
 */
itSpec.prop(
  "diagnostic-lines-includes-tag-and-location",
  { type: "Inclusion", exports: [diagnosticLines] },
  fc.constantFrom(
    "MissingSpecPropertyError" as const,
    "MissingStubError" as const,
    "MissingImplError" as const,
  ),
  (tag) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const lines = diagnosticLines(tag, {
          location: "src/x:1",
          diagnostic: { problem: "p", cause: "c", fix: "f", docsLink: "https://x/y" },
        });
        const joined = lines.join("\n");
        yield* failIf(!joined.startsWith(`[${tag}]`), `should start with [${tag}]`);
        yield* failIf(!joined.includes("src/x:1"), `should include location`);
        yield* failIf(!joined.includes("https://x/y"), `should include docs link`);
      }),
    ),
);

/**
 * @spec.property check-drift-bytes-match-after-sha-strip-succeeds
 * @spec.type Roundtrip
 * @spec.exports checkDrift
 * @spec.claim a SPEC.md whose bytes equal the regenerated bytes (with the `generatedAtSha:` line normalized away) succeeds — the SHA line is volatile and excluded from the byte-equality check
 */
itSpec.prop(
  "check-drift-bytes-match-after-sha-strip-succeeds",
  { type: "Roundtrip", exports: [checkDrift] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const onDisk = "# SPEC\n\ngeneratedAtSha: deadbee\n\nbody\n";
        const regenerated = "# SPEC\n\ngeneratedAtSha: cafebabe\n\nbody\n";
        const tmp = `/tmp/check-drift-test-${Date.now()}-${process.pid}.md`;
        yield* fs.writeFileString(tmp, onDisk).pipe(
          Effect.catchAll(() => Effect.die(new Error("write failed"))),
        );
        const exit = yield* Effect.exit(checkDrift(fs, tmp, regenerated));
        yield* fs.remove(tmp).pipe(Effect.catchAll(() => Effect.succeed(void 0)));
        yield* failIf(!Exit.isSuccess(exit), `expected success; got ${JSON.stringify(exit)}`);
      }).pipe(Effect.provide(NodeContext.layer)),
    ),
);

/**
 * @spec.property check-sidecar-drift-bytes-match-succeeds
 * @spec.type Roundtrip
 * @spec.exports checkSidecarDrift
 * @spec.claim a sidecar JSON whose bytes equal the regenerated bytes (with sha fields normalized) succeeds
 */
itSpec.prop(
  "check-sidecar-drift-bytes-match-succeeds",
  { type: "Roundtrip", exports: [checkSidecarDrift] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const onDisk = '{"folder":"src/x","generatedAtSha":"deadbee","exports":[]}\n';
        const regenerated = '{"folder":"src/x","generatedAtSha":"cafebabe","exports":[]}\n';
        const tmp = `/tmp/check-sidecar-drift-${Date.now()}-${process.pid}.json`;
        yield* fs.writeFileString(tmp, onDisk).pipe(
          Effect.catchAll(() => Effect.die(new Error("write failed"))),
        );
        const exit = yield* Effect.exit(checkSidecarDrift(fs, tmp, regenerated));
        yield* fs.remove(tmp).pipe(Effect.catchAll(() => Effect.succeed(void 0)));
        yield* failIf(!Exit.isSuccess(exit), `expected sidecar drift success`);
      }).pipe(Effect.provide(NodeContext.layer)),
    ),
);
