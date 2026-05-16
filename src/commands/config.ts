/**
 * @spec.purpose `safer-spec.config.json` schema + loader + per-folder
 *   threshold resolver. Two-layer fallback for each of the three coverage
 *   metrics: `folderOverrides[folder]` > `defaultThresholds` > 0. Extracted
 *   from `project-context.ts` to keep that file under its line cap; the
 *   loader is consumed by `loadProjectContext` so every command sees the
 *   same parsed config.
 *
 *   Tagged error `ConfigError` is co-located here. Schema rejects unknown
 *   keys at both the root level and the per-thresholds object level — a
 *   misspelled `typecoverage` (lowercase) would otherwise silently disable
 *   the intended gate.
 */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Schema } from "effect";

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly path: string;
  readonly cause: string;
}> {}

const RatioSchema = Schema.Number.pipe(Schema.between(0, 1));

const ThresholdsSchema = Schema.Struct({
  typeCoverage: Schema.optional(RatioSchema),
  classifierCoverage: Schema.optional(RatioSchema),
  preconditionPassRate: Schema.optional(RatioSchema),
});

const KNOWN_THRESHOLD_KEYS: ReadonlySet<string> = new Set([
  "typeCoverage",
  "classifierCoverage",
  "preconditionPassRate",
]);

const KNOWN_CONFIG_KEYS: ReadonlySet<string> = new Set([
  "defaultThresholds",
  "folderOverrides",
]);

const ConfigSchema = Schema.Struct({
  defaultThresholds: Schema.optional(ThresholdsSchema),
  folderOverrides: Schema.optional(
    Schema.Record({ key: Schema.String, value: ThresholdsSchema }),
  ),
});

export type Config = Schema.Schema.Type<typeof ConfigSchema>;

export interface Thresholds {
  readonly typeCoverage: number;
  readonly classifierCoverage: number;
  readonly preconditionPassRate: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  typeCoverage: 0,
  classifierCoverage: 0,
  preconditionPassRate: 0,
};

const EMPTY_CONFIG: Config = {};

const pickThreshold = (
  override: number | undefined,
  baseline: number | undefined,
  fallback: number,
): number => override ?? baseline ?? fallback;

/**
 * @spec.guarantee "returns a Thresholds value with each metric resolved in three-layer priority: folder override > defaultThresholds > 0"
 *   reason: validate's gate reads this per-folder; the layered fallback
 *           lets projects raise a baseline + tighten specific folders
 *           without restating the baseline everywhere.
 * @spec.residual-contract "folder match is exact-string against the normalized folder path; glob patterns are NOT supported in this slice"
 *   reason: scope limit; glob lookup is a future enhancement that needs a
 *           defined longest-match resolution rule.
 */
export const resolveThresholdsFor = (
  config: Config,
  folder: string,
): Thresholds => {
  const baseline = config.defaultThresholds ?? {};
  const override = config.folderOverrides?.[folder] ?? {};
  return {
    typeCoverage: pickThreshold(
      override.typeCoverage,
      baseline.typeCoverage,
      DEFAULT_THRESHOLDS.typeCoverage,
    ),
    classifierCoverage: pickThreshold(
      override.classifierCoverage,
      baseline.classifierCoverage,
      DEFAULT_THRESHOLDS.classifierCoverage,
    ),
    preconditionPassRate: pickThreshold(
      override.preconditionPassRate,
      baseline.preconditionPassRate,
      DEFAULT_THRESHOLDS.preconditionPassRate,
    ),
  };
};

const decodeConfig = Schema.decodeUnknown(ConfigSchema);

// Reject unknown keys BEFORE schema decode: Schema.Struct silently strips
// extras, which would let a misspelled `typecoverage` (lowercase) pass and
// the resolver fall back to 0, silently disabling the intended gate.
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const findUnknownKey = (
  obj: unknown,
  allowed: ReadonlySet<string>,
): string | null => {
  if (!isPlainObject(obj)) return null;
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) return k;
  }
  return null;
};

const unknownKeyError = (
  configPath: string,
  where: string,
  key: string,
  allowed: ReadonlySet<string>,
): ConfigError =>
  new ConfigError({
    path: configPath,
    cause: `unknown key "${key}" in ${where}; allowed: ${[...allowed].join(", ")}`,
  });

const checkThresholdsKeys = (
  obj: unknown,
  where: string,
  configPath: string,
): Effect.Effect<void, ConfigError> => {
  const bad = findUnknownKey(obj, KNOWN_THRESHOLD_KEYS);
  return bad === null
    ? Effect.void
    : Effect.fail(unknownKeyError(configPath, where, bad, KNOWN_THRESHOLD_KEYS));
};

const checkKnownKeys = (
  parsed: unknown,
  configPath: string,
): Effect.Effect<void, ConfigError> =>
  Effect.gen(function* () {
    const badTop = findUnknownKey(parsed, KNOWN_CONFIG_KEYS);
    if (badTop !== null) {
      return yield* Effect.fail(
        unknownKeyError(configPath, "<root>", badTop, KNOWN_CONFIG_KEYS),
      );
    }
    if (!isPlainObject(parsed)) return;
    yield* checkThresholdsKeys(parsed.defaultThresholds, "defaultThresholds", configPath);
    const overrides = parsed.folderOverrides;
    if (!isPlainObject(overrides)) return;
    for (const [folder, value] of Object.entries(overrides)) {
      yield* checkThresholdsKeys(value, `folderOverrides["${folder}"]`, configPath);
    }
  });

const decodeConfigSource = (
  text: string,
  configPath: string,
): Effect.Effect<Config, ConfigError> =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (e) =>
      new ConfigError({ path: configPath, cause: `invalid JSON: ${String(e)}` }),
  }).pipe(
    Effect.tap((parsed) => checkKnownKeys(parsed, configPath)),
    Effect.flatMap((parsed) =>
      decodeConfig(parsed).pipe(
        Effect.catchTag("ParseError", (e) =>
          Effect.fail(new ConfigError({ path: configPath, cause: e.message })),
        ),
      ),
    ),
  );

/**
 * @spec.guarantee "reads safer-spec.config.json at the project root; missing file yields empty Config; present-but-malformed file yields ConfigError"
 *   reason: missing config is the common case (permissive defaults); a
 *           present-but-broken config is a user error that should fail
 *           loudly, not be silently treated as missing.
 * @spec.residual-contract "discriminates 'file truly absent' (use empty Config) from 'file present but unreadable' (ConfigError) via `fs.exists`; a race window between exists() and readFileString is acceptable for config files"
 *   reason: permission failures, EISDIR, and other read errors on an
 *           existing config are NOT 'absent' — they are wrong-state and
 *           must surface, not silently disable gates.
 */
export const loadConfig = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<Config, ConfigError> => {
  const configPath = path.join(root, "safer-spec.config.json");
  return fs.exists(configPath).pipe(
    Effect.catchAll(() => Effect.succeed(false)),
    Effect.flatMap((present) =>
      present
        ? fs.readFileString(configPath).pipe(
            Effect.matchEffect({
              onFailure: (e) =>
                Effect.fail(
                  new ConfigError({
                    path: configPath,
                    cause: `read failed: ${String(e)}`,
                  }),
                ),
              onSuccess: (text) => decodeConfigSource(text, configPath),
            }),
          )
        : Effect.succeed(EMPTY_CONFIG),
    ),
    Effect.withSpan("commands/config/loadConfig"),
  );
};
