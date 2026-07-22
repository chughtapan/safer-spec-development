/**
 * @spec.purpose Branch coverage for the `safer-spec.config.json` loader
 *   and per-folder threshold resolver in `project/config.ts`. The
 *   resolver tests exercise the three-layer fallback (override >
 *   defaultThresholds > 0); the loader tests exercise the four
 *   real-world outcomes a project boot hits (missing file, malformed
 *   JSON, unknown key at root, unknown threshold key, valid) plus the
 *   `excludeRootPrefixes` validation split (safe prefixes roundtrip,
 *   unsafe shapes fail with `ConfigError`).
 */

import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Cause, Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import * as nodePath from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { loadConfig, resolveThresholdsFor, type Config } from "@safer/project/config.js";

class ConfigAssertionError extends Data.TaggedError("ConfigAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, ConfigAssertionError> =>
  cond ? Effect.fail(new ConfigAssertionError({ detail })) : Effect.void;

const firstFailureTag = <A, E>(exit: Exit.Exit<A, E>): string | null => {
  if (!Exit.isFailure(exit)) return null;
  const [first] = [...Cause.failures(exit.cause)];
  if (first === undefined) return null;
  const probe = first as { readonly _tag?: unknown };
  return typeof probe._tag === "string" ? probe._tag : null;
};

const FIXTURE_ROOT = nodePath.join(os.tmpdir(), `safer-spec-config-tests-${crypto.randomBytes(4).toString("hex")}`);

const writeFixture = (relPath: string, contents: string): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = path.join(FIXTURE_ROOT, relPath);
    yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    yield* fs.writeFileString(path.join(dir, "safer-spec.config.json"), contents).pipe(
      Effect.catchAll(() => Effect.die(new Error(`failed to write fixture ${dir}`))),
    );
    return dir;
  });

type LoadOutcome =
  | { readonly _tag: "ok"; readonly cfg: Config }
  | { readonly _tag: "fail"; readonly errorTag: string };

const fixtureLoadOutcome = (
  name: string,
  contents: string,
): Effect.Effect<LoadOutcome, never> =>
  Effect.gen(function* () {
    const dir = yield* writeFixture(name, contents);
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* loadConfig(fs, path, dir).pipe(
      Effect.match({
        onSuccess: (cfg): LoadOutcome => ({ _tag: "ok", cfg }),
        onFailure: (e): LoadOutcome => ({ _tag: "fail", errorTag: e._tag }),
      }),
    );
  }).pipe(Effect.provide(NodeContext.layer));

// Pre-resolve every loadConfig outcome once during collect so the fc
// loop reads cached Exits and doesn't touch disk per iteration.
const missingFileRoot = nodePath.join(os.tmpdir(), `safer-spec-missing-${crypto.randomBytes(4).toString("hex")}`);
const MISSING_FILE_OUTCOME = await Effect.runPromise(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* loadConfig(fs, path, missingFileRoot).pipe(
      Effect.match({
        onSuccess: (cfg): LoadOutcome => ({ _tag: "ok", cfg }),
        onFailure: (e): LoadOutcome => ({ _tag: "fail", errorTag: e._tag }),
      }),
    );
  }).pipe(Effect.provide(NodeContext.layer)),
);

const VALID_CONFIG_OUTCOME = await Effect.runPromise(fixtureLoadOutcome(
  "valid",
  JSON.stringify({
    defaultThresholds: { typeCoverage: 0.5, branchCoverageFromSpecTests: 0.8 },
    folderOverrides: { "src/x": { typeCoverage: 0.9 } },
  }),
));

const INVALID_JSON_OUTCOME = await Effect.runPromise(fixtureLoadOutcome("invalid-json", "{ not valid json"));

const UNKNOWN_ROOT_KEY_OUTCOME = await Effect.runPromise(fixtureLoadOutcome(
  "unknown-root",
  JSON.stringify({ thresholds: {} }),
));

const UNKNOWN_THRESHOLD_KEY_OUTCOME = await Effect.runPromise(fixtureLoadOutcome(
  "unknown-threshold",
  JSON.stringify({ defaultThresholds: { typecoverage: 0.5 } }),
));

const UNKNOWN_FOLDER_OVERRIDE_KEY_OUTCOME = await Effect.runPromise(fixtureLoadOutcome(
  "unknown-folder-key",
  JSON.stringify({ folderOverrides: { "src/x": { bogusKey: 0.5 } } }),
));

const OUT_OF_RANGE_OUTCOME = await Effect.runPromise(fixtureLoadOutcome(
  "out-of-range",
  JSON.stringify({ defaultThresholds: { typeCoverage: 1.5 } }),
));

const EXCLUDE_PREFIXES_VALID_OUTCOME = await Effect.runPromise(fixtureLoadOutcome(
  "exclude-prefixes-valid",
  JSON.stringify({ excludeRootPrefixes: ["vendor", "generated/sdk"] }),
));

// One fixture per rejected shape: empty, absolute, drive-letter, backslash,
// NUL, and dot/dot-dot segments. Pre-resolved so the fc loop stays disk-free.
const INVALID_EXCLUDE_PREFIXES: ReadonlyArray<string> = [
  "",
  "/absolute",
  "C:generated",
  "a\\b",
  "nul\u0000byte",
  ".",
  "a/../b",
];
const EXCLUDE_PREFIX_INVALID_OUTCOMES: ReadonlyArray<LoadOutcome> = await Effect.runPromise(
  Effect.forEach(
    INVALID_EXCLUDE_PREFIXES,
    (prefix, index) =>
      fixtureLoadOutcome(
        `exclude-prefixes-invalid-${index}`,
        JSON.stringify({ excludeRootPrefixes: [prefix] }),
      ),
    { concurrency: 1 },
  ),
);

/**
 * @spec.property resolve-thresholds-falls-back-to-zero-when-no-config
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim with empty config, every metric resolves to 0 — the bottom of the three-layer fallback
 */
itSpec.prop(
  "resolve-thresholds-falls-back-to-zero-when-no-config",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  fc.string(),
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const t = resolveThresholdsFor({}, folder);
        yield* failIf(t.typeCoverage !== 0, `typeCoverage should be 0`);
        yield* failIf(t.preconditionPassRate !== 0, `preconditionPassRate should be 0`);
        yield* failIf(t.branchCoverageFromSpecTests !== 0, `branchCoverageFromSpecTests should be 0`);
      }),
    ),
);

/**
 * @spec.property resolve-thresholds-baseline-applies-when-no-override
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim defaultThresholds applies for any folder lacking a folderOverrides entry
 */
itSpec.prop(
  "resolve-thresholds-baseline-applies-when-no-override",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config: Config = { defaultThresholds: { typeCoverage: 0.5, branchCoverageFromSpecTests: 0.75 } };
        const t = resolveThresholdsFor(config, "src/anyfolder");
        yield* failIf(t.typeCoverage !== 0.5, `typeCoverage should be 0.5; got ${t.typeCoverage}`);
        yield* failIf(t.branchCoverageFromSpecTests !== 0.75, `branchCoverageFromSpecTests should be 0.75`);
        yield* failIf(t.preconditionPassRate !== 0, `preconditionPassRate should default to 0`);
      }),
    ),
);

/**
 * @spec.property resolve-thresholds-folder-override-wins
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim folderOverrides[folder] beats defaultThresholds for the matching folder
 */
itSpec.prop(
  "resolve-thresholds-folder-override-wins",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config: Config = {
          defaultThresholds: { typeCoverage: 0.5 },
          folderOverrides: { "src/x": { typeCoverage: 0.9, branchCoverageFromSpecTests: 0.95 } },
        };
        const t = resolveThresholdsFor(config, "src/x");
        yield* failIf(t.typeCoverage !== 0.9, `override wins; got ${t.typeCoverage}`);
        yield* failIf(t.branchCoverageFromSpecTests !== 0.95, `override applies`);
      }),
    ),
);

/**
 * @spec.property resolve-thresholds-non-matching-folder-uses-baseline
 * @spec.type Constant Equality
 * @spec.exports resolveThresholdsFor
 * @spec.claim folderOverrides only apply on exact-string match; non-matching folder falls back to defaultThresholds
 */
itSpec.prop(
  "resolve-thresholds-non-matching-folder-uses-baseline",
  { type: "Constant Equality", exports: [resolveThresholdsFor] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config: Config = {
          defaultThresholds: { typeCoverage: 0.5 },
          folderOverrides: { "src/x": { typeCoverage: 0.9 } },
        };
        const t = resolveThresholdsFor(config, "src/y");
        yield* failIf(t.typeCoverage !== 0.5, `non-matching folder uses baseline`);
      }),
    ),
);

/**
 * @spec.property load-config-missing-file-yields-empty-config
 * @spec.type Constant Equality
 * @spec.exports loadConfig
 * @spec.claim a missing `safer-spec.config.json` resolves to an empty Config (permissive defaults), not an error
 */
itSpec.prop(
  "load-config-missing-file-yields-empty-config",
  { type: "Constant Equality", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(MISSING_FILE_OUTCOME._tag !== "ok", `expected success on missing file`);
        if (MISSING_FILE_OUTCOME._tag !== "ok") return;
        yield* failIf(MISSING_FILE_OUTCOME.cfg.defaultThresholds !== undefined, `empty Config should have no defaultThresholds`);
      }),
    ),
);

/**
 * @spec.property load-config-valid-file-decodes
 * @spec.type Roundtrip
 * @spec.exports loadConfig
 * @spec.claim a valid `safer-spec.config.json` round-trips through the loader with thresholds and folderOverrides intact
 */
itSpec.prop(
  "load-config-valid-file-decodes",
  { type: "Roundtrip", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(VALID_CONFIG_OUTCOME._tag !== "ok", `expected success on valid config`);
        if (VALID_CONFIG_OUTCOME._tag !== "ok") return;
        const cfg = VALID_CONFIG_OUTCOME.cfg;
        yield* failIf(
          cfg.defaultThresholds?.typeCoverage !== 0.5,
          `expected typeCoverage 0.5 in baseline`,
        );
        yield* failIf(
          cfg.folderOverrides?.["src/x"]?.typeCoverage !== 0.9,
          `expected folder override typeCoverage 0.9`,
        );
      }),
    ),
);

/**
 * @spec.property load-config-invalid-json-fails-with-config-error
 * @spec.type Exception Raising
 * @spec.exports loadConfig
 * @spec.claim a malformed JSON file fails with `ConfigError` whose cause names "invalid JSON"
 */
itSpec.prop(
  "load-config-invalid-json-fails-with-config-error",
  { type: "Exception Raising", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(INVALID_JSON_OUTCOME._tag !== "fail", `expected ConfigError`);
      }),
    ),
);

/**
 * @spec.property load-config-unknown-root-key-fails
 * @spec.type Exception Raising
 * @spec.exports loadConfig
 * @spec.claim an unknown top-level key fails with `ConfigError` — Schema.Struct would silently strip it
 */
itSpec.prop(
  "load-config-unknown-root-key-fails",
  { type: "Exception Raising", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(UNKNOWN_ROOT_KEY_OUTCOME._tag !== "fail", `expected ConfigError`);
      }),
    ),
);

/**
 * @spec.property load-config-unknown-threshold-key-fails
 * @spec.type Exception Raising
 * @spec.exports loadConfig
 * @spec.claim a misspelled threshold key (e.g. `typecoverage` lowercase) fails with `ConfigError`
 */
itSpec.prop(
  "load-config-unknown-threshold-key-fails",
  { type: "Exception Raising", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(UNKNOWN_THRESHOLD_KEY_OUTCOME._tag !== "fail", `expected ConfigError`);
      }),
    ),
);

/**
 * @spec.property load-config-unknown-folder-override-key-fails
 * @spec.type Exception Raising
 * @spec.exports loadConfig
 * @spec.claim an unknown key inside a `folderOverrides["src/x"]` block fails with `ConfigError`
 */
itSpec.prop(
  "load-config-unknown-folder-override-key-fails",
  { type: "Exception Raising", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(UNKNOWN_FOLDER_OVERRIDE_KEY_OUTCOME._tag !== "fail", `expected ConfigError`);
      }),
    ),
);

/**
 * @spec.property load-config-out-of-range-ratio-fails
 * @spec.type Exception Raising
 * @spec.exports loadConfig
 * @spec.claim a ratio outside [0, 1] fails through the schema decode → ConfigError
 */
itSpec.prop(
  "load-config-out-of-range-ratio-fails",
  { type: "Exception Raising", exports: [loadConfig] },
  fc.constant(undefined),
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* failIf(OUT_OF_RANGE_OUTCOME._tag !== "fail", `expected ConfigError`);
      }),
    ),
);
