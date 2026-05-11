/**
 * @spec.purpose Project-wide loader for the codemod. Walks the project tree
 *   for every non-test `.ts` source, reads the tsconfig `paths` map, and
 *   reads the current git HEAD SHA. `collectExports` consumes the sources
 *   + paths so barrel re-exports across files and aliases resolve; emit
 *   needs the SHA for SpecFrontmatter and SpecArtifact metadata.
 *
 *   Tagged error `ProjectContextError` is co-located here.
 */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";
import type { SourceFile } from "@safer/spec/source-exports.js";

export class ProjectContextError extends Data.TaggedError("ProjectContextError")<{
  readonly path: string;
  readonly cause: string;
}> {}

export interface ProjectContext {
  readonly sources: ReadonlyArray<SourceFile>;
  readonly paths: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly generatedAtSha: string;
  readonly thresholds: {
    readonly typeCoverage: number;
    readonly classifierCoverage: number;
    readonly preconditionPassRate: number;
  };
}

// Permissive defaults: validate gates only when a threshold is non-zero. The
// codemod ships with 0s so the dogfood (which has no property bodies yet)
// passes by default; downstream projects raise these via per-project config
// (future slice) once their property tests are populated.
const DEFAULT_THRESHOLDS = {
  typeCoverage: 0,
  classifierCoverage: 0,
  preconditionPassRate: 0,
} as const;

const isTsSource = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".d.ts") && !name.endsWith(".spec.test.ts");
const SKIP_DIRS = new Set(["node_modules", "dist"]);

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)));

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

const readTsConfigPaths = (
  fs: FileSystem.FileSystem,
  tsconfigPath: string,
): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, never> =>
  fs
    .readFileString(tsconfigPath)
    .pipe(
      Effect.map(parsePathsBlock),
      Effect.catchAll(() => Effect.succeed({} as Record<string, ReadonlyArray<string>>)),
    );

const readGitSha = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<string, never> =>
  fs.readFileString(path.join(root, ".git", "HEAD")).pipe(
    Effect.flatMap((text) => {
      const trimmed = text.trim();
      if (!trimmed.startsWith("ref: ")) return Effect.succeed(trimmed);
      return fs
        .readFileString(path.join(root, ".git", trimmed.slice(5)))
        .pipe(Effect.map((t) => t.trim()));
    }),
    Effect.catchAll(() => Effect.succeed("uncommitted")),
  );

/**
 * @spec.guarantee "loads project-wide context (every non-test `.ts` under `root`, tsconfig `paths`, git HEAD SHA, default thresholds); collectExports consumes sources+paths so barrel re-exports resolve"
 *   reason: ts-morph cannot follow `export ... from` without target files
 *           registered and aliases configured.
 * @spec.residual-contract "missing tsconfig.json yields empty `paths`; missing `.git/HEAD` yields `generatedAtSha = 'uncommitted'`"
 *   reason: projects without aliases or git history still load.
 */
export const loadProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<ProjectContext, ProjectContextError> =>
  Effect.gen(function* () {
    const sources: SourceFile[] = [];
    yield* walkSources(fs, path, root, sources);
    const paths = yield* readTsConfigPaths(fs, path.join(root, "tsconfig.json"));
    const generatedAtSha = yield* readGitSha(fs, path, root);
    return { sources, paths, generatedAtSha, thresholds: DEFAULT_THRESHOLDS };
  }).pipe(Effect.withSpan("commands/project-context/loadProjectContext"));

export const loadValidateProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, ProjectContextError> => loadProjectContext(fs, path, ".");
