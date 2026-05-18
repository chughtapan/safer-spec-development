/**
 * @spec.purpose Validate's gap-class cross-checks. Co-locates the four tagged
 *   errors (MissingSpecPropertyError, MissingStubError, MissingImplError,
 *   NoFoldersResolvedError) with the check effects that emit them and the
 *   diagnostic-builder helpers that shape their bodies.
 *
 *   Extracted from `validate.ts` to keep the orchestration file under the
 *   strict max-lines cap; the public surface still routes through
 *   `validate.ts` (this module is internal to the commands layer).
 */

 

import { FileSystem } from "@effect/platform";
import { Data, Effect, Schema } from "effect";
import {
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
  JsDocUnknownDirectiveError,
} from "@safer/spec/grammar/index.js";
import { stripVolatileJson } from "@safer/analysis/pipeline.js";
import {
  findThresholdShortfall,
  type FolderAnalysis,
  type SpecMeta,
  type ThresholdShortfall,
} from "@safer/spec/artifact/index.js";
import type { ItSpecIssue } from "@safer/analysis/properties.js";

const ValidateDiagnosticSchema = Schema.Struct({
  problem: Schema.String,
  cause: Schema.String,
  fix: Schema.String,
  docsLink: Schema.String,
});

export type ValidateDiagnostic = Schema.Schema.Type<typeof ValidateDiagnosticSchema>;

export interface GapErrorPayload {
  readonly location: string;
  readonly diagnostic: ValidateDiagnostic;
}

/**
 * @spec.guarantee "emitted when committed MODULE.md drifts from the regenerated output, when the sidecar JSON drifts, or when a Properties row fails its test-side directive cross-check"
 *   reason: spec-tier ratchet; cli translates this tag to exit code 11.
 * @spec.residual-contract "diagnostic.problem is human-readable; agents read .diagnostic.fix to route remediation"
 *   reason: trust contract for diagnostic body content.
 */
export class MissingSpecPropertyError extends Data.TaggedError(
  "MissingSpecPropertyError",
)<GapErrorPayload> {}

/**
 * @spec.guarantee "emitted when an itSpec call site lacks the four required JSDoc directives, or when a JSDoc directive fails to parse"
 *   reason: stub-tier ratchet; cli translates this tag to exit code 12.
 * @spec.residual-contract "diagnostic.location names the call site (file:line)"
 *   reason: trust contract for routing the next remediation step.
 */
export class MissingStubError extends Data.TaggedError(
  "MissingStubError",
)<GapErrorPayload> {}

/**
 * @spec.guarantee "emitted when an itSpec.prop body is empty/stubbed in --implemented mode, or when a coverage metric is below its configured non-zero threshold"
 *   reason: implementation-tier block; cli translates this tag to exit code 13.
 * @spec.residual-contract "diagnostic.cause names the reason the body is empty or the metric is below threshold"
 *   reason: trust contract for routing the next remediation step.
 */
export class MissingImplError extends Data.TaggedError(
  "MissingImplError",
)<GapErrorPayload> {}

export type ValidateGapError =
  | MissingSpecPropertyError
  | MissingStubError
  | MissingImplError;

const DOCS_BASE =
  "https://github.com/chughtapan/safer-spec-development/blob/main/docs";

const mkDiagnostic = (
  problem: string,
  cause: string,
  fix: string,
  anchor: string,
): ValidateDiagnostic => ({
  problem,
  cause,
  fix,
  docsLink: `${DOCS_BASE}/errors.md#${anchor}`,
});

const directiveErrorToStub = (
  e: JsDocDirectiveOverflowError | JsDocDirectiveParseError | JsDocUnknownDirectiveError,
): MissingStubError =>
  new MissingStubError({
    location: `${e.path}:${String(e.line)}`,
    diagnostic: mkDiagnostic(
      `directive ${e._tag}`,
      `tag \`${e.directive}\``,
      "fix the JSDoc directive on the call site",
      "missing-stub",
    ),
  });

export const catchDirectiveErrors = <A, R>(
  eff: Effect.Effect<
    A,
    JsDocDirectiveOverflowError | JsDocDirectiveParseError | JsDocUnknownDirectiveError,
    R
  >,
): Effect.Effect<A, MissingStubError, R> =>
  eff.pipe(
    Effect.catchTags({
      JsDocDirectiveOverflowError: (e) => Effect.fail(directiveErrorToStub(e)),
      JsDocDirectiveParseError: (e) => Effect.fail(directiveErrorToStub(e)),
      JsDocUnknownDirectiveError: (e) => Effect.fail(directiveErrorToStub(e)),
    }),
  );

const driftError = (specPath: string, reason: string): MissingSpecPropertyError =>
  new MissingSpecPropertyError({
    location: specPath,
    diagnostic: mkDiagnostic(
      "committed MODULE.md drifted from regenerated output",
      reason,
      "run `safer-spec generate --write` to refresh",
      "missing-spec-property",
    ),
  });

const SHA_LINE_RE = /^generatedAtSha:.*$/m;
const stripVolatileMd = (text: string): string =>
  text.replace(SHA_LINE_RE, "generatedAtSha: <NORMALIZED>");

export const checkDrift = (
  fs: FileSystem.FileSystem,
  specPath: string,
  regenerated: string,
): Effect.Effect<void, MissingSpecPropertyError> =>
  fs.readFileString(specPath).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.fail(driftError(specPath, "no MODULE.md on disk for this folder")),
      onSuccess: (onDisk) =>
        stripVolatileMd(onDisk) === stripVolatileMd(regenerated)
          ? Effect.succeed(void 0)
          : Effect.fail(driftError(specPath, "on-disk bytes differ from re-emit")),
    }),
  );

const sidecarDriftError = (
  jsonPath: string,
  reason: string,
): MissingSpecPropertyError =>
  new MissingSpecPropertyError({
    location: jsonPath,
    diagnostic: mkDiagnostic(
      `sidecar drift at ${jsonPath}: ${reason}`,
      reason,
      "run `safer-spec generate --write` to refresh the sidecar",
      "missing-spec-property",
    ),
  });

export const checkSidecarDrift = (
  fs: FileSystem.FileSystem,
  sidecarPath: string,
  regenerated: string,
): Effect.Effect<void, MissingSpecPropertyError> =>
  fs.readFileString(sidecarPath).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.fail(
          sidecarDriftError(sidecarPath, "no sidecar JSON on disk for this folder"),
        ),
      onSuccess: (onDisk) =>
        stripVolatileJson(onDisk) === stripVolatileJson(regenerated)
          ? Effect.succeed(void 0)
          : Effect.fail(
              sidecarDriftError(
                sidecarPath,
                "regenerated content differs from committed",
              ),
            ),
    }),
  );

const formatRatio = (v: number): string => v.toFixed(2);

const fixTextFor = (metric: ThresholdShortfall["metric"]): string => {
  switch (metric) {
    case "typeCoverage":
      return "add itSpec.prop calls covering the missing property-types, or declare @spec.skip with a documented reason";
    case "preconditionPassRate":
      return "loosen the fc.pre precondition so fewer samples are skipped, or fix the property body to satisfy it more often";
    case "branchCoverageFromSpecTests":
      return "add itSpec.prop calls exercising the uncovered branches in this folder's source files, or remove unreachable code";
  }
};

const shortfallDiagnostic = (
  folder: string,
  s: ThresholdShortfall,
): ValidateDiagnostic => {
  const gap =
    s.metric === "typeCoverage" && s.missingPropertyTypes.length > 0
      ? ` (gap: missing tests for property-types [${s.missingPropertyTypes.join(", ")}])`
      : "";
  return mkDiagnostic(
    `coverage below threshold: ${s.metric}=${formatRatio(s.observed)} < threshold=${formatRatio(s.threshold)} at folder ${folder}${gap}`,
    `observed ${s.metric} (${formatRatio(s.observed)}) is below the configured threshold (${formatRatio(s.threshold)})`,
    fixTextFor(s.metric),
    "missing-impl",
  );
};

export const checkThresholds = (
  folder: string,
  analysis: FolderAnalysis,
  meta: SpecMeta,
): Effect.Effect<void, MissingImplError> => {
  const shortfall = findThresholdShortfall(analysis, meta);
  if (shortfall === null) return Effect.succeed(void 0);
  return Effect.fail(
    new MissingImplError({
      location: folder,
      diagnostic: shortfallDiagnostic(folder, shortfall),
    }),
  );
};

export const checkImplBodies = (
  analysis: FolderAnalysis,
): Effect.Effect<void, MissingImplError> => {
  const stubbed = analysis.properties.find((p) => p.stubbed);
  if (stubbed === undefined) return Effect.succeed(void 0);
  return Effect.fail(
    new MissingImplError({
      location: `${stubbed.sourceRef.path}:${String(stubbed.sourceRef.line)}`,
      diagnostic: mkDiagnostic(
        `property \`${stubbed.id}\` is still a placeholder`,
        "itSpec.todo has not yet been promoted to itSpec.prop with a fast-check body",
        `replace itSpec.todo("${stubbed.id}", ...) with itSpec.prop(...)`,
        "missing-impl",
      ),
    }),
  );
};

/**
 * @spec.guarantee "fails when `--implemented` is requested for a folder with at least one implemented (non-stubbed) itSpec.prop but no `<folder>/.safer-spec/<slug>.execution.json` on disk"
 *   reason: implemented-mode coverage gates read classifier/precondition
 *           stats from the reporter-emitted sidecar; absence makes the
 *           gate vacuously pass and silently regresses the contract.
 * @spec.residual-contract "folders whose properties are all still stubs do not require execution.json (planned-mode parity)"
 *   reason: stubs cannot produce stats; demanding the sidecar before any
 *           body exists would falsely block the planned → implemented
 *           ratchet.
 */
export interface ExecutionSidecarCheck {
  readonly propertyIds: ReadonlyArray<string>;
  readonly testTreeHash: string;
}

const fail = (folder: string, problem: string, cause: string, fix: string) =>
  Effect.fail(new MissingImplError({
    location: folder,
    diagnostic: mkDiagnostic(problem, cause, fix, "missing-impl"),
  }));

export const checkExecutionSidecarPresent = (
  analysis: FolderAnalysis,
  folder: string,
  execution: ExecutionSidecarCheck | null,
  currentTestTreeHash: string,
): Effect.Effect<void, MissingImplError> => {
  const expected = analysis.properties.filter((p) => !p.stubbed).map((p) => p.id).sort();
  if (expected.length === 0) return Effect.succeed(void 0);
  if (execution === null) return fail(folder,
    `missing reporter sidecar: ${folder}/.safer-spec/<slug>.execution.json not on disk`,
    "validate --implemented requires the Vitest reporter sidecar so classifier coverage and precondition pass rate can be checked against thresholds",
    "run `pnpm test` (or `pnpm vitest run`) to regenerate the execution sidecar before validating");
  const got = [...execution.propertyIds].sort();
  if (!(got.length === expected.length && got.every((id, i) => id === expected[i]))) return fail(folder,
    `stale reporter sidecar: covers a different property set than the current tests (sidecar: [${got.join(", ")}], expected: [${expected.join(", ")}])`,
    "validate --implemented uses the sidecar's per-property stats; a sidecar that covers a different property set than what `extractProperties` sees now can't gate this run",
    "rerun `pnpm test` so the reporter rewrites the sidecar against the current implemented property set");
  if (execution.testTreeHash !== currentTestTreeHash) return fail(folder,
    `stale reporter sidecar: emitted against a test tree whose bytes differ from what's on disk now`,
    "propertyIds match but a test file's body / arbitrary / precondition changed since the last `pnpm test` run; the stored stats no longer prove the current bodies executed",
    "rerun `pnpm test` to regenerate the sidecar against the current test-tree contents");
  return Effect.succeed(void 0);
};

const issueToError = (issue: ItSpecIssue): ValidateGapError => {
  const location = `${issue.path}:${String(issue.line)}`;
  if (issue.kind === "missing-directive") {
    return new MissingStubError({
      location,
      diagnostic: mkDiagnostic(
        "itSpec call site missing required JSDoc directive(s)",
        issue.detail,
        "add the missing @spec.property / @spec.type / @spec.exports / @spec.claim block above the call",
        "missing-stub",
      ),
    });
  }
  if (issue.kind === "directive-mismatch") {
    return new MissingSpecPropertyError({
      location,
      diagnostic: mkDiagnostic(
        "JSDoc directive disagrees with itSpec runtime argument",
        issue.detail,
        "make the JSDoc directive and the itSpec call argument refer to the same value",
        "missing-spec-property",
      ),
    });
  }
  return new MissingImplError({
    location,
    diagnostic: mkDiagnostic(
      "itSpec.prop body is empty",
      issue.detail,
      "replace the empty body with a fast-check property assertion",
      "missing-impl",
    ),
  });
};

export const failOnIssues = (
  issues: ReadonlyArray<ItSpecIssue>,
  mode: "planned" | "implemented",
): Effect.Effect<void, ValidateGapError> => {
  const filtered = mode === "planned"
    ? issues.filter((i) => i.kind !== "empty-body")
    : issues;
  if (filtered.length === 0) return Effect.succeed(void 0);
  return Effect.fail(issueToError(filtered[0]!));
};

/**
 * @spec.guarantee "returns a 5-line array: [Tag] header, location, cause, fix, docs link — the canonical stderr renderer for gap-class errors"
 *   reason: cli's stderr output is byte-stable for downstream automation
 *           that greps the exit code + first line.
 * @spec.skip "Partial Roundtrip"
 *   reason: one-way formatter; no parser back from the rendered lines.
 * @spec.skip "Commutative Paths"
 *   reason: single entry point; no equivalent renderer.
 * @spec.skip "Constant Non-Equality"
 *   reason: distinct tag/payload pairs can produce identical lines when payload fields collide.
 * @spec.skip "Exception Raising"
 *   reason: pure synchronous formatter; cannot fail.
 */
export const diagnosticLines = (
  tag: ValidateGapError["_tag"],
  payload: GapErrorPayload,
): ReadonlyArray<string> => [
  `[${tag}] ${payload.diagnostic.problem}`,
  `  location: ${payload.location}`,
  `  cause:    ${payload.diagnostic.cause}`,
  `  fix:      ${payload.diagnostic.fix}`,
  `  docs:     ${payload.diagnostic.docsLink}`,
];
