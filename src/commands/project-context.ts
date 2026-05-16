/**
 * @spec.purpose Project-wide loader for the codemod. Walks the project tree
 *   for every non-test `.ts` source, reads the tsconfig `paths` map, the
 *   git HEAD SHA, and the optional `safer-spec.config.json` (per-folder
 *   threshold overrides). `collectExports` consumes the sources + paths
 *   so barrel re-exports across files and aliases resolve; emit needs the
 *   SHA for SpecFrontmatter and SpecArtifact metadata; validate's
 *   threshold gate reads `config` per-folder via `resolveThresholdsFor`.
 *
 *   Tagged errors `ProjectContextError` and `ConfigError` are co-located
 *   here.
 */

import * as nodePath from "node:path";
import { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Schema } from "effect";
import type { SourceFile } from "@safer/spec/source-exports.js";

export class ProjectContextError extends Data.TaggedError("ProjectContextError")<{
  readonly path: string;
  readonly cause: string;
}> {}

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

export interface ProjectContext {
  readonly sources: ReadonlyArray<SourceFile>;
  readonly paths: Readonly<Record<string, ReadonlyArray<string>>>;

  /**
   * tsconfig.compilerOptions.baseUrl (the root `paths` resolve relative to).
   * Defaults to "." when tsconfig omits it; TypeScript requires baseUrl when
   * paths is set, and "." matches both common practice and ts-morph behavior.
   */
  readonly baseUrl: string;
  readonly generatedAtSha: string;
  // Raw `safer-spec.config.json` contents (defaults + per-folder overrides).
  // Resolve per-folder thresholds via `resolveThresholdsFor(ctx.config, folder)`.
  readonly config: Config;
}

// Permissive defaults: validate gates only when a threshold is non-zero. The
// codemod ships with 0s so projects whose property bodies aren't filled in
// pass by default; `safer-spec.config.json` raises individual metrics +
// per-folder overrides once the project's tests are populated.
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

/**
 * Normalize the user-supplied `--folder` value into a path the codemod
 * stores as artifact identity (frontmatter `folder:`, sidecar slug,
 * drift-check key). Absolute inputs are rewritten to cwd-relative so they
 * match the repo-relative paths `loadProjectContext` registers; `./` and
 * trailing separators are stripped so authoring conveniences don't
 * manifest as false drift.
 */
export const normalizeFolder = (folder: string): string => {
  const rebased = nodePath.isAbsolute(folder)
    ? toRepoRelative(folder)
    : folder;
  // Canonicalize redundant separators and `.`/`..` segments BEFORE
  // stripping leading-./ and trailing-/ — otherwise inputs like
  // `src//commands` round-trip into the artifact's frontmatter as
  // `src//commands` and a later canonical `src/commands` re-run reports
  // false drift.
  const canonical = nodePath.normalize(rebased);
  const start = skipLeadingDotSlash(canonical);
  const end = stripTrailingSep(canonical, start);
  const sliced = start === 0 && end === canonical.length
    ? canonical
    : canonical.slice(start, end);
  // `--folder ./` and `--folder /` strip to empty; preserve the
  // project-root sentinel so downstream `fs.readDirectory` reads "."
  // rather than `""` (which fails even when `./index.ts` exists).
  return sliced.length === 0 ? "." : sliced;
};

const toRepoRelative = (abs: string): string => {
  const rel = nodePath.relative(process.cwd(), abs);
  return rel.length === 0 ? "." : rel;
};

const SLASH = 47;
const BACKSLASH = 92;
const DOT = 46;

const skipLeadingDotSlash = (s: string): number => {
  let i = 0;
  while (i + 1 < s.length && s.charCodeAt(i) === DOT) {
    const next = s.charCodeAt(i + 1);
    if (next !== SLASH && next !== BACKSLASH) break;
    i += 2;
  }
  return i;
};

const stripTrailingSep = (s: string, start: number): number => {
  let end = s.length;
  while (end > start) {
    const ch = s.charCodeAt(end - 1);
    if (ch !== SLASH && ch !== BACKSLASH) break;
    end -= 1;
  }
  return end;
};

const isTsSource = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".d.ts") && !name.endsWith(".spec.test.ts");
const SKIP_DIRS = new Set(["node_modules", "dist"]);

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(
    Effect.map((entries) => [...entries].sort()),
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
  );

const isDirectory = (
  fs: FileSystem.FileSystem,
  full: string,
): Effect.Effect<boolean, never> =>
  fs.stat(full).pipe(
    Effect.map((s) => s.type === "Directory"),
    Effect.catchAll(() => Effect.succeed(false)),
  );

const recordTsFile = (
  fs: FileSystem.FileSystem,
  full: string,
  name: string,
  out: SourceFile[],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (!isTsSource(name)) return;
    const source = yield* fs
      .readFileString(full)
      .pipe(Effect.catchAll(() => Effect.succeed(null as string | null)));
    if (source !== null) out.push({ path: full, source });
  });

const walkSources = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
  out: SourceFile[],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, dir);
    for (const name of entries) {
      if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      const dirCheck = yield* isDirectory(fs, full);
      yield* dirCheck
        ? walkSources(fs, path, full, out)
        : recordTsFile(fs, full, name, out);
    }
  });

const PATHS_BLOCK_RE = /"paths"\s*:\s*\{([\s\S]*?)\}/;
const PATH_ENTRY_RE = /"([^"]+)"\s*:\s*\[([^\]]*)\]/g;
const STRING_LIT_RE = /"([^"]+)"/g;
const BASE_URL_RE = /"baseUrl"\s*:\s*"([^"]+)"/;

const parseBaseUrl = (text: string): string | undefined => {
  const m = BASE_URL_RE.exec(text);
  return m === null ? undefined : m[1];
};

const parsePathsBlock = (text: string): Record<string, ReadonlyArray<string>> => {
  const block = PATHS_BLOCK_RE.exec(text);
  if (block === null) return {};
  const result: Record<string, ReadonlyArray<string>> = {};
  PATH_ENTRY_RE.lastIndex = 0;
  let entry: RegExpExecArray | null;
  while ((entry = PATH_ENTRY_RE.exec(block[1] ?? "")) !== null) {
    const values: string[] = [];
    STRING_LIT_RE.lastIndex = 0;
    let lit: RegExpExecArray | null;
    while ((lit = STRING_LIT_RE.exec(entry[2] ?? "")) !== null) values.push(lit[1]!);
    result[entry[1]!] = values;
  }
  return result;
};

interface TsConfigBits {
  readonly paths: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly baseUrl: string;
}

const DEFAULT_BASE_URL = ".";

const readTsConfigBits = (
  fs: FileSystem.FileSystem,
  tsconfigPath: string,
): Effect.Effect<TsConfigBits, never> =>
  fs
    .readFileString(tsconfigPath)
    .pipe(
      Effect.map((text) => ({
        paths: parsePathsBlock(text),
        baseUrl: parseBaseUrl(text) ?? DEFAULT_BASE_URL,
      })),
      Effect.catchAll(() =>
        Effect.succeed({ paths: {}, baseUrl: DEFAULT_BASE_URL } as TsConfigBits),
      ),
    );

// Resolves `<root>/.git` to the directory holding HEAD. For a normal repo
// that's the dir itself; for a worktree or submodule, `.git` is a FILE
// containing `gitdir: <path>` and we follow that pointer. Path is resolved
// relative to <root>/.git's parent when not absolute.
const resolveGitDir = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<string, never> => {
  const gitPath = path.join(root, ".git");
  return fs.stat(gitPath).pipe(
    Effect.flatMap((s) =>
      s.type === "Directory"
        ? Effect.succeed(gitPath)
        : fs.readFileString(gitPath).pipe(
            Effect.map((text) => {
              const line = text.trim();
              const pointer = line.startsWith("gitdir: ") ? line.slice(8) : line;
              return nodePath.isAbsolute(pointer) ? pointer : path.join(root, pointer);
            }),
          ),
    ),
    Effect.catchAll(() => Effect.succeed(gitPath)),
  );
};

const readGitSha = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<string, never> =>
  resolveGitDir(fs, path, root).pipe(
    Effect.flatMap((gitDir) =>
      fs.readFileString(path.join(gitDir, "HEAD")).pipe(
        Effect.flatMap((text) => {
          const trimmed = text.trim();
          if (!trimmed.startsWith("ref: ")) return Effect.succeed(trimmed);
          return fs
            .readFileString(path.join(gitDir, trimmed.slice(5)))
            .pipe(Effect.map((t) => t.trim()));
        }),
      ),
    ),
    Effect.catchAll(() => Effect.succeed("uncommitted")),
  );

// Reads `<root>/safer-spec.config.json` and decodes via ConfigSchema.
// Missing file → permissive empty config (all-zero thresholds remain in
// effect). File present but malformed → ConfigError (fail loudly, since a
// project author who wrote a config wants the contents respected).
const decodeConfig = Schema.decodeUnknown(ConfigSchema);

const decodeConfigSource = (
  text: string,
  configPath: string,
): Effect.Effect<Config, ConfigError> =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (e) =>
      new ConfigError({ path: configPath, cause: `invalid JSON: ${String(e)}` }),
  }).pipe(
    Effect.flatMap((parsed) =>
      decodeConfig(parsed).pipe(
        Effect.catchTag("ParseError", (e) =>
          Effect.fail(new ConfigError({ path: configPath, cause: e.message })),
        ),
      ),
    ),
  );

const loadConfig = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<Config, ConfigError> => {
  const configPath = path.join(root, "safer-spec.config.json");
  return fs.readFileString(configPath).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed(EMPTY_CONFIG),
      onSuccess: (text) => decodeConfigSource(text, configPath),
    }),
    Effect.withSpan("commands/project-context/loadConfig"),
  );
};

/**
 * @spec.guarantee "loads project-wide context (every non-test `.ts` under `root`, tsconfig `paths`, git HEAD SHA, `safer-spec.config.json`); collectExports consumes sources+paths so barrel re-exports resolve"
 *   reason: ts-morph cannot follow `export ... from` without target files
 *           registered; validate's threshold gate reads the loaded config.
 * @spec.residual-contract "missing tsconfig.json yields empty `paths`; missing `.git/HEAD` yields `generatedAtSha = 'uncommitted'`; missing safer-spec.config.json yields permissive all-zero thresholds"
 *   reason: projects without aliases, git history, or per-folder gate
 *           configuration still load with no false failures.
 */
export const loadProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<ProjectContext, ProjectContextError | ConfigError> =>
  Effect.gen(function* () {
    const sources: SourceFile[] = [];
    yield* walkSources(fs, path, root, sources);
    const tsconfig = yield* readTsConfigBits(fs, path.join(root, "tsconfig.json"));
    const generatedAtSha = yield* readGitSha(fs, path, root);
    const config = yield* loadConfig(fs, path, root);
    return {
      sources,
      paths: tsconfig.paths,
      baseUrl: tsconfig.baseUrl,
      generatedAtSha,
      config,
    };
  }).pipe(Effect.withSpan("commands/project-context/loadProjectContext"));

export const loadValidateProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, ProjectContextError | ConfigError> =>
  loadProjectContext(fs, path, ".");
