/**
 * @spec.purpose Project-wide loader for the codemod. Walks the project tree
 *   once at startup and produces a `ProjectContext` snapshot that downstream
 *   layers (analysis, commands) READ from instead of calling pure helpers
 *   per folder. The snapshot carries the sources ts-morph needs, the
 *   tsconfig `paths` map, the git HEAD SHA, the parsed config, plus
 *   precomputed:
 *
 *   - `folders`: every directory under root that has an `index.ts` barrel
 *   - `subfoldersOf(folder)`: immediate SPEC'd subfolders of `folder`
 *   - `thresholdsFor(folder)`: resolved coverage thresholds for `folder`
 *   - `resolveFolder(input)`: maps a user-supplied `--folder X` to a
 *     known canonical folder, failing with `FolderNotFoundError` if `X`
 *     doesn't match anything discovered
 *
 *   Tagged errors `ProjectContextError`, `ConfigError`, and
 *   `FolderNotFoundError` live here and at `config.ts`; the cli at
 *   `commands/index.ts` catches each by tag.
 */

import * as nodePath from "node:path";
import { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";
import {
  loadConfig,
  resolveThresholdsFor as resolveThresholdsForInternal,
  type Config,
  type ConfigError,
  type Thresholds,
} from "@safer/project/config.js";

/**
 * In-memory source file shape — `{path, source}` pairs the ts-morph
 * project registers so cross-file `export ... from` resolves. Produced
 * by `loadProjectContext` and consumed by `analysis/exports.ts`'s
 * `collectExports`.
 */
export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

export class ProjectContextError extends Data.TaggedError("ProjectContextError")<{
  readonly path: string;
  readonly cause: string;
}> {}

export class FolderNotFoundError extends Data.TaggedError("FolderNotFoundError")<{
  readonly requested: string;
}> {}

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

  /** Every folder under the project root with an `index.ts` barrel, root-first depth-first. */
  readonly folders: ReadonlyArray<string>;

  /** Immediate SPEC'd subfolders of the given folder (folders directly inside `folder` that have their own `index.ts`). */
  readonly subfoldersOf: (folder: string) => ReadonlyArray<string>;

  /** Resolve the per-folder coverage thresholds (folder override > defaultThresholds > 0). */
  readonly thresholdsFor: (folder: string) => Thresholds;

  /**
   * Map a user-supplied `--folder X` to a canonical folder string,
   * failing with `FolderNotFoundError` when `X` doesn't match any
   * discovered folder.
   */
  readonly resolveFolder: (input: string) => Effect.Effect<string, FolderNotFoundError>;
}

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

const toRepoRelative = (abs: string): string => {
  const rel = nodePath.relative(process.cwd(), abs);
  return rel.length === 0 ? "." : rel;
};

// Internal helper used by `resolveFolder`. Canonicalizes a user-supplied
// folder string so the precomputed folders list lookup is exact-match.
const canonicalizeFolderInput = (folder: string): string => {
  const rebased = nodePath.isAbsolute(folder) ? toRepoRelative(folder) : folder;
  const canonical = nodePath.normalize(rebased);
  const start = skipLeadingDotSlash(canonical);
  const end = stripTrailingSep(canonical, start);
  const sliced = start === 0 && end === canonical.length
    ? canonical
    : canonical.slice(start, end);
  return sliced.length === 0 ? "." : sliced;
};

const isTsSource = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".d.ts") && !name.endsWith(".spec.test.ts");
const SKIP_DIRS = new Set(["node_modules", "dist"]);
const SKIP_DIRS_FOLDER_WALK = new Set([
  "__tests__", "node_modules", "dist", "build", "coverage", ".safer-spec",
]);

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

// Walks the project tree for every directory containing an `index.ts`
// barrel. Returns root-first depth-first order; same skip set as
// `walkSources` plus the build/test dirs that don't host SPEC'd code.
const walkFolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
  out: string[],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, dir);
    if (entries.includes("index.ts")) out.push(dir);
    for (const name of entries) {
      if (name.startsWith(".") || SKIP_DIRS_FOLDER_WALK.has(name)) continue;
      const full = path.join(dir, name);
      if (yield* isDirectory(fs, full)) yield* walkFolders(fs, path, full, out);
    }
  });

// Builds the `subfoldersOf` map: for every discovered folder, the
// immediate SPEC'd children (children-of-children belong to those
// children's own SPEC). Sourced from the same `folders` list to avoid
// re-walking the filesystem.
const buildSubfoldersMap = (
  folders: ReadonlyArray<string>,
  path: Path.Path,
): Map<string, ReadonlyArray<string>> => {
  const map = new Map<string, string[]>();
  for (const f of folders) map.set(f, []);
  for (const f of folders) {
    const parent = path.dirname(f);
    const parentList = map.get(parent);
    if (parentList !== undefined && parent !== f) parentList.push(f);
  }
  // Defensive: ensure stable order per the input folder list
  for (const [k, v] of map) {
    map.set(k, [...v].sort());
  }
  return map as Map<string, ReadonlyArray<string>>;
};

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

/**
 * @spec.guarantee "loads project-wide context (every non-test `.ts` under `root`, tsconfig `paths`, git HEAD SHA, `safer-spec.config.json`); the returned ProjectContext precomputes folder discovery and per-folder thresholds so downstream layers READ from the snapshot instead of re-walking the project tree per folder"
 *   reason: ts-morph cannot follow `export ... from` without target files
 *           registered; precomputing folder structure removes O(N²)
 *           re-discovery in the per-folder loops.
 * @spec.residual-contract "missing tsconfig.json yields empty `paths`; missing `.git/HEAD` yields `generatedAtSha = 'uncommitted'`; missing safer-spec.config.json yields permissive all-zero thresholds; root defaults to the cwd-relative \".\""
 *   reason: projects without aliases, git history, or per-folder gate
 *           configuration still load with no false failures.
 * @spec.skip "Partial Roundtrip"
 *   reason: loader-only; no `serializeProjectContext` companion.
 * @spec.skip "Commutative Paths"
 *   reason: single entry point; no equivalent API path yields the same context.
 */
export const loadProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string = ".",
): Effect.Effect<ProjectContext, ProjectContextError | ConfigError> =>
  Effect.gen(function* () {
    const sources: SourceFile[] = [];
    yield* walkSources(fs, path, root, sources);
    const tsconfig = yield* readTsConfigBits(fs, path.join(root, "tsconfig.json"));
    const generatedAtSha = yield* readGitSha(fs, path, root);
    const config = yield* loadConfig(fs, path, root);
    const folderList: string[] = [];
    yield* walkFolders(fs, path, root, folderList);
    const folders: ReadonlyArray<string> = folderList;
    const subfoldersMap = buildSubfoldersMap(folders, path);
    const folderSet: ReadonlySet<string> = new Set(folders);
    return buildProjectContext({
      sources,
      tsconfig,
      generatedAtSha,
      config,
      folders,
      subfoldersMap,
      folderSet,
    });
  }).pipe(Effect.withSpan("commands/project-context/loadProjectContext"));

interface BuildProjectContextArgs {
  readonly sources: ReadonlyArray<SourceFile>;
  readonly tsconfig: TsConfigBits;
  readonly generatedAtSha: string;
  readonly config: Config;
  readonly folders: ReadonlyArray<string>;
  readonly subfoldersMap: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly folderSet: ReadonlySet<string>;
}

const buildProjectContext = (args: BuildProjectContextArgs): ProjectContext => {
  const { sources, tsconfig, generatedAtSha, config, folders, subfoldersMap, folderSet } = args;
  return {
    sources,
    paths: tsconfig.paths,
    baseUrl: tsconfig.baseUrl,
    generatedAtSha,
    folders,
    subfoldersOf: (folder: string) => subfoldersMap.get(folder) ?? [],
    thresholdsFor: (folder: string) => resolveThresholdsForInternal(config, folder),
    resolveFolder: (input: string) => {
      const canonical = canonicalizeFolderInput(input);
      return folderSet.has(canonical)
        ? Effect.succeed(canonical)
        : Effect.fail(new FolderNotFoundError({ requested: input }));
    },
  };
};
