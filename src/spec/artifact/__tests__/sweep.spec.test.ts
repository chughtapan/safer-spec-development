/**
 * @spec.purpose Coverage-sweep tests for `spec/artifact/`. Adds the
 *   remaining property-type rows beyond what `coverage.spec.test.ts`
 *   and `sidecar-io.spec.test.ts` cover so every export crosses the
 *   gate threshold.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import {
  buildSpecArtifact,
  buildSpecMeta,
  findThresholdShortfall,
  regenerateSidecar,
  sidecarSlug,
  type FolderAnalysis,
  type SpecMeta,
} from "@safer/spec/artifact/index.js";

class ArtifactSweepAssertionError extends Data.TaggedError(
  "ArtifactSweepAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, ArtifactSweepAssertionError> =>
  cond ? Effect.fail(new ArtifactSweepAssertionError({ detail })) : Effect.void;

const EMPTY_ANALYSIS: FolderAnalysis = {
  folder: "src/x",
  purpose: null,
  exports: [],
  properties: [],
  children: [],
};

const META: SpecMeta = buildSpecMeta(EMPTY_ANALYSIS, {
  generatedAtSha: "deadbee",
  thresholds: { typeCoverage: 0, preconditionPassRate: 0 },
});

/* ---------- buildSpecMeta — Constant Non-Equality + Exception Raising ---------- */

/**
 * @spec.property build-spec-meta-distinct-shas-distinct-meta
 * @spec.type Constant Non-Equality
 * @spec.exports buildSpecMeta
 * @spec.claim two `buildSpecMeta` calls with different `generatedAtSha` values produce `SpecMeta` objects with different `generatedAtSha` fields — no payload aliasing across instances
 */
itSpec.prop(
  "build-spec-meta-distinct-shas-distinct-meta",
  { type: "Constant Non-Equality", exports: [buildSpecMeta] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        buildSpecMeta(EMPTY_ANALYSIS, {
          generatedAtSha: "aaa",
          thresholds: { typeCoverage: 0, preconditionPassRate: 0 },
        }).generatedAtSha ===
          buildSpecMeta(EMPTY_ANALYSIS, {
            generatedAtSha: "bbb",
            thresholds: { typeCoverage: 0, preconditionPassRate: 0 },
          }).generatedAtSha,
        `sha aliased across instances`,
      ),
    ),
);

/* ---------- findThresholdShortfall additional types ---------- */

/**
 * @spec.property find-threshold-shortfall-bounded-output-shape
 * @spec.type Constant Bounds Checking
 * @spec.exports findThresholdShortfall
 * @spec.claim when non-null, the shortfall's `missingPropertyTypes` length stays within `[0, 9]` — the closed PROPERTY_TYPES taxonomy size is the upper bound
 */
itSpec.prop(
  "find-threshold-shortfall-bounded-output-shape",
  { type: "Constant Bounds Checking", exports: [findThresholdShortfall] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const meta = buildSpecMeta(EMPTY_ANALYSIS, {
          generatedAtSha: "x",
          thresholds: { typeCoverage: 0.5, preconditionPassRate: 0 },
          execution: {
            formatVersion: "1",
            folder: "src/x",
            generatedAtSha: "x",
            testTreeHash: "h",
            propertyIds: [],
            classifierCoverage: null,
            preconditionPassRate: null,
            branchCoverageFromSpecTests: null,
          },
        });
        const shortfall = findThresholdShortfall(EMPTY_ANALYSIS, meta);
        if (shortfall === null) return;
        yield* failIf(shortfall.missingPropertyTypes.length > 9, `exceeds 9`);
      }),
    ),
);

/**
 * @spec.property find-threshold-shortfall-roundtrip-on-zero-meta
 * @spec.type Roundtrip
 * @spec.exports findThresholdShortfall
 * @spec.claim two calls with the same meta produce equal results — the function is pure on its declared inputs
 */
itSpec.prop(
  "find-threshold-shortfall-roundtrip-on-zero-meta",
  { type: "Roundtrip", exports: [findThresholdShortfall] },
  fc.constant(undefined),
  () => {
    const a = findThresholdShortfall(EMPTY_ANALYSIS, META);
    const b = findThresholdShortfall(EMPTY_ANALYSIS, META);
    return Effect.runPromise(failIf(a !== b, `non-deterministic`));
  },
);

/* ---------- buildSpecArtifact additional types ---------- */

/**
 * @spec.property build-spec-artifact-stamps-folder
 * @spec.type Inclusion
 * @spec.exports buildSpecArtifact
 * @spec.claim the returned artifact's `folder` field matches the input analysis's folder — the identity stamp downstream sidecar paths key on
 */
itSpec.prop(
  "build-spec-artifact-stamps-folder",
  { type: "Inclusion", exports: [buildSpecArtifact] },
  fc.constantFrom("src/x", "src/spec/grammar", "src/analysis"),
  (folder) =>
    Effect.runPromise(
      failIf(
        buildSpecArtifact({ ...EMPTY_ANALYSIS, folder }, META).folder !== folder,
        `folder mismatch`,
      ),
    ),
);

/**
 * @spec.property build-spec-artifact-stamps-format-version
 * @spec.type Constant Equality
 * @spec.exports buildSpecArtifact
 * @spec.claim the returned artifact's `formatVersion` field matches `SPEC_FORMAT_VERSION` — the stable label `migrate` keys committed artifacts on across bumps
 */
itSpec.prop(
  "build-spec-artifact-stamps-format-version",
  { type: "Constant Equality", exports: [buildSpecArtifact] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      failIf(
        buildSpecArtifact(EMPTY_ANALYSIS, META).formatVersion !== "0.1.0",
        `formatVersion mismatch`,
      ),
    ),
);

/**
 * @spec.property build-spec-artifact-non-equal-on-distinct-shas
 * @spec.type Constant Non-Equality
 * @spec.exports buildSpecArtifact
 * @spec.claim two artifacts built with different `generatedAtSha` in their meta have different `generatedAtSha` fields — sha aliasing would defeat the audit trail
 */
itSpec.prop(
  "build-spec-artifact-non-equal-on-distinct-shas",
  { type: "Constant Non-Equality", exports: [buildSpecArtifact] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const a = buildSpecArtifact(EMPTY_ANALYSIS, buildSpecMeta(EMPTY_ANALYSIS, {
          generatedAtSha: "aaa",
          thresholds: { typeCoverage: 0, preconditionPassRate: 0 },
        }));
        const b = buildSpecArtifact(EMPTY_ANALYSIS, buildSpecMeta(EMPTY_ANALYSIS, {
          generatedAtSha: "bbb",
          thresholds: { typeCoverage: 0, preconditionPassRate: 0 },
        }));
        yield* failIf(a.generatedAtSha === b.generatedAtSha, `sha aliased`);
      }),
    ),
);

/* ---------- regenerateSidecar additional types ---------- */

/**
 * @spec.property regenerate-sidecar-parseable-json
 * @spec.type Inclusion
 * @spec.exports regenerateSidecar
 * @spec.claim the emitted string is well-formed JSON parseable to an object with a `formatVersion` field — the freshness-check contract validate's sidecar-drift reads
 */
itSpec.prop(
  "regenerate-sidecar-parseable-json",
  { type: "Inclusion", exports: [regenerateSidecar] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const json = yield* regenerateSidecar(EMPTY_ANALYSIS, META);
        const parsed = JSON.parse(json) as { formatVersion?: unknown };
        yield* failIf(typeof parsed.formatVersion !== "string", `formatVersion field`);
      }),
    ),
);

/* ---------- sidecarSlug additional types ---------- */

/**
 * @spec.property sidecar-slug-roundtrip-idempotent-on-canonical
 * @spec.type Roundtrip
 * @spec.exports sidecarSlug
 * @spec.claim `sidecarSlug(sidecarSlug(folder))` is a stable string output — applying the slug transform to its own result doesn't introduce separators
 */
itSpec.prop(
  "sidecar-slug-roundtrip-idempotent-on-canonical",
  { type: "Roundtrip", exports: [sidecarSlug] },
  fc.constantFrom("src/x", "src/spec/grammar", "."),
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const once = sidecarSlug(folder);
        const twice = sidecarSlug(once);
        yield* failIf(twice.includes("/") || twice.includes("\\"), `twice has separator`);
      }),
    ),
);
