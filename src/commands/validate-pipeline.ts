/**
 * @spec.purpose Shared analysis pipeline for `validate`. Walks the same
 *   inputs as `generate` (sources, tests, index barrel) and returns the
 *   `FolderAnalysis` that the markdown emitter consumes. Also owns
 *   `loadProjectContext` — the project-wide source walker + tsconfig
 *   `paths` reader that `collectExports` consumes to follow barrel
 *   re-exports across files and aliases.
 *
 *   Tagged error `ProjectContextError` is co-located here.
 */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";
import {
  parseFileDirectives,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
  type LocatedDirective,
} from "@safer/spec/directives/index.js";
import {
  computeKindCoverage,
  emitMarkdown,
  type FolderAnalysis,
  type PropertyRow,
  type SpecMeta,
} from "@safer/spec/emit.js";
import {
  buildExportEntries,
  collectExports,
  findPurpose,
  type SourceFile,
} from "@safer/spec/source-exports.js";
import { extractProperties } from "@safer/spec/todos.js";

export class ProjectContextError extends Data.TaggedError("ProjectContextError")<{
  readonly path: string;
  readonly cause: string;
}> {}

export interface ProjectContext {
  readonly sources: ReadonlyArray<SourceFile>;
  readonly paths: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly generatedAtSha: string;
  readonly thresholds: {
    readonly kindCoverage: number;
    readonly classifierCoverage: number;
    readonly preconditionPassRate: number;
  };
}

const DEFAULT_THRESHOLDS = {
  kindCoverage: 1.0,
  classifierCoverage: 0.8,
  preconditionPassRate: 0.9,
} as const;

type DirectiveParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;

export interface FolderInputs {
  readonly sources: ReadonlyArray<string>;
  readonly tests: ReadonlyArray<string>;
  readonly indexFilePath: string;
}

const isTestFile = (name: string): boolean => name.endsWith(".spec.test.ts");
const isSourceFile = (name: string): boolean =>
  name.endsWith(".ts") && !isTestFile(name) && !name.endsWith(".d.ts");

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs
    .readDirectory(dir)
    .pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)));

const isDirectory = (
  fs: FileSystem.FileSystem,
  full: string,
): Effect.Effect<boolean, never> =>
  fs.stat(full).pipe(
    Effect.map((s) => s.type === "Directory"),
    Effect.catchAll(() => Effect.succeed(false)),
  );

/**
 * @spec.guarantee "returns folder inputs (sources, tests, index path) or null if no index.ts barrel exists"
 *   reason: contract for validate's per-folder iteration.
 */
export const collectFolderInputs = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<FolderInputs | null, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, folder);
    const sources: string[] = [];
    const tests: string[] = [];
    for (const name of entries) {
      const full = path.join(folder, name);
      if (isSourceFile(name)) sources.push(full);
      else if (isTestFile(name)) tests.push(full);
    }
    const subEntries = yield* readDirSafe(fs, path.join(folder, "__tests__"));
    for (const name of subEntries) {
      if (isTestFile(name)) tests.push(path.join(folder, "__tests__", name));
    }
    const indexFilePath = sources.find((p) => path.basename(p) === "index.ts");
    if (indexFilePath === undefined) return null;
    return { sources, tests, indexFilePath };
  }).pipe(Effect.withSpan("commands/validate-pipeline/collectFolderInputs"));

const orDieFile = (path: string) =>
  Effect.catchAll((cause: unknown) =>
    Effect.die(new Error(`cannot read ${path}: ${String(cause)}`)),
  );

const readSource = (
  fs: FileSystem.FileSystem,
  path: string,
): Effect.Effect<string, never> =>
  fs.readFileString(path).pipe(orDieFile(path));

const parseSources = (
  fs: FileSystem.FileSystem,
  sources: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<LocatedDirective>, DirectiveParseError> =>
  Effect.gen(function* () {
    const all: LocatedDirective[] = [];
    for (const p of sources) {
      const src = yield* readSource(fs, p);
      all.push(...(yield* parseFileDirectives(p, src)));
    }
    return all;
  });

const parseTests = (
  fs: FileSystem.FileSystem,
  tests: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<PropertyRow>, DirectiveParseError> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    for (const p of tests) {
      const src = yield* readSource(fs, p);
      const parsed = yield* parseFileDirectives(p, src);
      rows.push(...extractProperties(p, src, parsed));
    }
    return rows;
  });

/**
 * @spec.guarantee "produces the same FolderAnalysis shape `generate` emits; regenerate-and-compare is byte-deterministic"
 *   reason: roundtrip contract; validate's drift check relies on it.
 */
export const buildFolderAnalysis = (
  fs: FileSystem.FileSystem,
  folder: string,
  inputs: FolderInputs,
  ctx: ProjectContext,
): Effect.Effect<FolderAnalysis, DirectiveParseError> =>
  Effect.gen(function* () {
    const directives = yield* parseSources(fs, inputs.sources);
    const indexFile = ctx.sources.find((s) => s.path === inputs.indexFilePath);
    const indexSrc = indexFile?.source ?? (yield* readSource(fs, inputs.indexFilePath));
    const declarations = collectExports(inputs.indexFilePath, indexSrc, {
      siblings: ctx.sources,
      paths: ctx.paths,
    });
    const properties = yield* parseTests(fs, inputs.tests);
    return {
      folder,
      purpose: findPurpose(directives, inputs.indexFilePath),
      exports: buildExportEntries(declarations, directives),
      properties,
      sourceFiles: inputs.sources,
      testFiles: inputs.tests,
    };
  }).pipe(Effect.withSpan("commands/validate-pipeline/buildFolderAnalysis"));

const isTsSource = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".d.ts") && !name.endsWith(".spec.test.ts");
const SKIP_DIRS = new Set(["node_modules", "dist"]);

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
      Effect.catchAll(() =>
        Effect.succeed({} as Record<string, ReadonlyArray<string>>),
      ),
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
    return {
      sources,
      paths,
      generatedAtSha,
      thresholds: DEFAULT_THRESHOLDS,
    };
  }).pipe(Effect.withSpan("commands/validate-pipeline/loadProjectContext"));

export const loadValidateProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, ProjectContextError> => loadProjectContext(fs, path, ".");

/**
 * @spec.guarantee "builds a `SpecMeta` from run-level context + analysis-derived coverage"
 *   reason: emit's frontmatter + sidecar both require meta.
 * @spec.residual-contract "classifier coverage and precondition pass rate are null in this slice; populated only when `validate --implemented` consumes Vitest reporter sidecars"
 *   reason: lifecycle contract.
 */
const DEFAULT_GENERATED_FROM = {
  jsdoc: "ts-morph + @microsoft/tsdoc",
  exports: "ts-morph getExportedDeclarations",
  schemas: [],
  properties: ["fast-check"],
  eslint: "eslint-plugin-agent-code-guard",
} as const;

export const buildSpecMeta = (
  analysis: FolderAnalysis,
  ctx: ProjectContext,
): SpecMeta => ({
  generatedAtSha: ctx.generatedAtSha,
  coverage: {
    kindCoverage: computeKindCoverage(analysis),
    classifierCoverage: null,
    preconditionPassRate: null,
    branchCoverageFromSpecTests: null,
  },
  thresholds: ctx.thresholds,
  generatedFrom: DEFAULT_GENERATED_FROM,
});

/** Alias for `emitMarkdown(analysis, meta)`; keeps validate.ts's import block compact. */
export const regenerateMarkdown = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): string => emitMarkdown(analysis, meta);

const walkOnce = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
  out: string[],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entries = yield* readDirSafe(fs, dir);
    if (entries.includes("index.ts")) out.push(dir);
    for (const name of entries) {
      if (name === "__tests__" || name.startsWith(".")) continue;
      const full = path.join(dir, name);
      if (yield* isDirectory(fs, full)) yield* walkOnce(fs, path, full, out);
    }
  });

/**
 * @spec.guarantee "returns every directory under `root` that contains an `index.ts` barrel"
 *   reason: contract; validate iterates this list when no `--folder` is given.
 * @spec.residual-contract "dot-prefixed directories and `__tests__` are skipped; symlinks are not followed"
 *   reason: scope-of-this-slice contract.
 */
export const discoverFolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  Effect.gen(function* () {
    const out: string[] = [];
    yield* walkOnce(fs, path, root, out);
    return out;
  }).pipe(Effect.withSpan("commands/validate-pipeline/discoverFolders"));
