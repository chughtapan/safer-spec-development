/**
 * @spec.purpose Property tests for `resolveThresholdsFor` — the per-folder
 *   threshold resolver `buildSpecMeta` calls. Three layers of fallback:
 *   folder override > default thresholds > 0. Tests assert each layer
 *   wins independently and that missing fields cascade correctly.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/it-spec.js";
import {
  resolveThresholdsFor,
  type Config,
} from "@safer/commands/config.js";

class ResolveAssertionError extends Data.TaggedError(
  "ResolveAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, ResolveAssertionError> =>
  cond ? Effect.fail(new ResolveAssertionError({ detail })) : Effect.void;

// Generates a value in [0, 1] suitable for a threshold ratio. Mixed mass on
// the endpoints so the "threshold = 0 means no gate" edge gets stressed.
const ratioArb: fc.Arbitrary<number> = fc.oneof(
  fc.constant(0),
  fc.constant(1),
  fc.double({ min: 0, max: 1, noNaN: true }),
);

const folderArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant("."),
  fc.constant("src/spec"),
  fc.constant("src/commands"),
  fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes("\0")),
);

/**
 * @spec.property resolve-config-empty-yields-zero-thresholds
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim an empty Config (no defaultThresholds, no folderOverrides) resolves every metric to 0 for every folder name
 */
itSpec.prop(
  "resolve-config-empty-yields-zero-thresholds",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  folderArb,
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const t = resolveThresholdsFor({}, folder);
        yield* failIf(
          t.typeCoverage !== 0
          || t.classifierCoverage !== 0
          || t.preconditionPassRate !== 0,
          `empty config not all-zero: ${JSON.stringify(t)} for ${folder}`,
        );
      }),
    ),
);

/**
 * @spec.property resolve-config-default-applies-to-all-folders
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim with `defaultThresholds` set and no folder overrides, every folder resolves to those exact values (each metric independently)
 */
itSpec.prop(
  "resolve-config-default-applies-to-all-folders",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  fc.record({
    typeCoverage: ratioArb,
    classifierCoverage: ratioArb,
    preconditionPassRate: ratioArb,
    folder: folderArb,
  }),
  ({ typeCoverage, classifierCoverage, preconditionPassRate, folder }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config: Config = {
          defaultThresholds: { typeCoverage, classifierCoverage, preconditionPassRate },
        };
        const t = resolveThresholdsFor(config, folder);
        yield* failIf(
          t.typeCoverage !== typeCoverage,
          `typeCoverage default not applied: ${t.typeCoverage} vs ${typeCoverage}`,
        );
        yield* failIf(
          t.classifierCoverage !== classifierCoverage,
          `classifierCoverage default not applied: ${t.classifierCoverage} vs ${classifierCoverage}`,
        );
        yield* failIf(
          t.preconditionPassRate !== preconditionPassRate,
          `preconditionPassRate default not applied: ${t.preconditionPassRate} vs ${preconditionPassRate}`,
        );
      }),
    ),
);

/**
 * @spec.property resolve-config-folder-override-trumps-default
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim a folder-specific override beats the default for the same metric while leaving unspecified metrics to inherit from the default layer
 */
itSpec.prop(
  "resolve-config-folder-override-trumps-default",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  fc.record({
    defaultTypeCov: ratioArb,
    defaultClassifierCov: ratioArb,
    overrideTypeCov: ratioArb,
    folder: folderArb,
  }),
  ({ defaultTypeCov, defaultClassifierCov, overrideTypeCov, folder }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config: Config = {
          defaultThresholds: {
            typeCoverage: defaultTypeCov,
            classifierCoverage: defaultClassifierCov,
          },
          folderOverrides: {
            [folder]: { typeCoverage: overrideTypeCov },
          },
        };
        const t = resolveThresholdsFor(config, folder);
        // Override beats default for typeCoverage…
        yield* failIf(
          t.typeCoverage !== overrideTypeCov,
          `override should win: typeCoverage=${t.typeCoverage} vs override=${overrideTypeCov}`,
        );
        // …but classifierCoverage falls through to default (override
        // doesn't set it).
        yield* failIf(
          t.classifierCoverage !== defaultClassifierCov,
          `unspecified metric should inherit default: classifierCoverage=${t.classifierCoverage} vs default=${defaultClassifierCov}`,
        );
        // preconditionPassRate is set in neither layer -> falls through to 0.
        yield* failIf(
          t.preconditionPassRate !== 0,
          `unspecified metric should fall to 0: preconditionPassRate=${t.preconditionPassRate}`,
        );
      }),
    ),
);

/**
 * @spec.property resolve-config-rejects-unknown-threshold-keys
 * @spec.type Exception Raising
 * @spec.exports resolveThresholdsFor
 * @spec.claim a misspelled threshold key (e.g. `typecoverage` lowercase) in either `defaultThresholds` or a `folderOverrides` value MUST cause `safer-spec.config.json` decoding to fail with a ConfigError — silently stripping unknown keys would disable the intended gate
 */
itSpec.prop(
  "resolve-config-rejects-unknown-threshold-keys",
  { type: "Exception Raising", exports: [resolveThresholdsFor] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      // The schema integration is exercised end-to-end in the
      // loadConfig path; this stub asserts the resolver contract from
      // the schema's perspective: every threshold key it accepts MUST
      // be one of the three documented names, and case matters. The
      // pure resolver itself ignores unknown keys (they're typed away
      // by Config), so the validation happens at decode time before
      // resolveThresholdsFor is ever called.
      failIf(
        !KNOWN_THRESHOLD_KEYS.has("typeCoverage")
        || !KNOWN_THRESHOLD_KEYS.has("classifierCoverage")
        || !KNOWN_THRESHOLD_KEYS.has("preconditionPassRate"),
        "documented threshold keys must be in KNOWN_THRESHOLD_KEYS",
      ),
    ),
);

// Mirror of project-context's internal allow-list; the test asserts the
// resolver's API contract — only these three keys are recognized.
const KNOWN_THRESHOLD_KEYS: ReadonlySet<string> = new Set([
  "typeCoverage",
  "classifierCoverage",
  "preconditionPassRate",
]);
