/**
 * @spec.purpose Per-folder pipeline orchestration. `generateFolder` and
 *   `validateFolder` are the public entry points that compose the parsers,
 *   pipeline helpers, and gap-class checks under one call. Commands at
 *   `commands/{generate,validate}.ts` consume these two functions plus
 *   folder discovery from `project/`; the pipeline primitives
 *   (`buildSpecMeta`, `regenerateMarkdown`, `checkDrift`, etc.) stay
 *   internal to this folder.
 *
 *   `generateFolder`: walks one folder's source + test + immediate
 *   subfolder index.ts; parses directives; builds the `FolderAnalysis`;
 *   emits the markdown + sidecar JSON. Returns the artifacts; callers
 *   own the on-disk write step (so `--dry-run` works at the cli boundary).
 *
 *   `validateFolder`: walks the same pipeline, then diffs the regenerated
 *   markdown + sidecar against the on-disk artifacts, enforces coverage
 *   thresholds, and runs the per-test directive cross-checks. Returns the
 *   folder string on success; fails with a `ValidateGapError` whose tag
 *   the cli maps to a POSIX exit code.
 */

import { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";
import { buildChildren } from "@safer/analysis/folders.js";
import type { ProjectContext } from "@safer/project/index.js";
import {
  parseFileDirectives,
  type LocatedDirective,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
} from "@safer/spec/grammar/index.js";
import {
  buildSpecMeta,
  computeTestTreeHash,
  emitMarkdown,
  loadBranchCoverage,
  loadExecutionSidecar,
  regenerateSidecar,
  sidecarSlug,
  type FolderAnalysis,
  type SpecMeta,
} from "@safer/spec/artifact/index.js";
import {
  buildExportEntries,
  collectExports,
  indexFilePurposes,
  uniqueExternalSources,
  type DeclaredExport,
} from "@safer/analysis/exports.js";
import { extractProperties } from "@safer/analysis/properties.js";
import {
  collectFolderInputs,
  inspectFolder,
} from "@safer/analysis/pipeline.js";
import {
  catchDirectiveErrors,
  checkDrift,
  checkExecutionSidecarPresent,
  checkImplBodies,
  checkSidecarDrift,
  checkThresholds,
  failOnIssues,
  MissingImplError,
  type ValidateGapError,
} from "@safer/analysis/checks.js";

/* ---------- shared error union for generateFolder ---------- */

export class GenerateFolderError extends Data.TaggedError("GenerateFolderError")<{
  readonly folder: string;
  readonly reason: string;
}> {}

export class GenerateFolderIOError extends Data.TaggedError("GenerateFolderIOError")<{
  readonly folder: string;
  readonly path: string;
  readonly cause: string;
}> {}

type DirectiveParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;

export type GenerateFolderAnyError =
  | GenerateFolderError
  | GenerateFolderIOError
  | DirectiveParseError;

export interface GenerateFolderArtifacts {
  readonly analysis: FolderAnalysis;
  readonly markdown: string;
  readonly sidecarJson: string;
  readonly sidecarRelPath: string;
}

const causeOf = (e: unknown): string => {
  if (typeof e !== "object" || e === null || !("message" in e)) return String(e);
  const m = (e as { message: unknown }).message;
  return typeof m === "string" ? m : String(e);
};

const ioErr = (folder: string, path: string) =>
  (e: unknown): GenerateFolderIOError =>
    new GenerateFolderIOError({ folder, path, cause: causeOf(e) });

const isTestFile = (n: string): boolean => n.endsWith(".spec.test.ts");
const isSourceFile = (n: string): boolean =>
  n.endsWith(".ts") && !isTestFile(n) && !n.endsWith(".d.ts");

const readDirSafe = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>, never> =>
  fs.readDirectory(dir).pipe(
    Effect.map((es) => [...es].sort()),
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
  );

const collectFolderFiles = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
  entries: ReadonlyArray<string>,
): Effect.Effect<{ sources: ReadonlyArray<string>; tests: ReadonlyArray<string> }, never> =>
  Effect.gen(function* () {
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
    return { sources, tests };
  });

const exportsOfFile = (
  fs: FileSystem.FileSystem,
  folder: string,
  filePath: string,
  ctx: ProjectContext,
): Effect.Effect<ReadonlyArray<DeclaredExport>, GenerateFolderIOError> =>
  Effect.gen(function* () {
    const cached = ctx.sources.find((s) => s.path === filePath);
    const src = cached?.source ??
      (yield* fs.readFileString(filePath).pipe(Effect.mapError(ioErr(folder, filePath))));
    return collectExports(filePath, src, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    });
  });

const parseTests = (
  fs: FileSystem.FileSystem,
  folder: string,
  tests: ReadonlyArray<string>,
  declaredExports: ReadonlySet<string>,
): Effect.Effect<
  { rows: ReturnType<typeof extractProperties>["rows"]; directives: ReadonlyArray<LocatedDirective> },
  GenerateFolderIOError | DirectiveParseError
> =>
  Effect.gen(function* () {
    const rows: Array<ReturnType<typeof extractProperties>["rows"][number]> = [];
    const directives: LocatedDirective[] = [];
    for (const filePath of tests) {
      const source = yield* fs.readFileString(filePath)
        .pipe(Effect.mapError(ioErr(folder, filePath)));
      const dirs = yield* parseFileDirectives(filePath, source);
      directives.push(...dirs);
      rows.push(...extractProperties(filePath, source, dirs, declaredExports).rows);
    }
    return { rows, directives };
  });

/**
 * Project-wide symbol existence set. Pass through to `generateFolder` so
 * `extractProperties`'s typo gate accepts cross-folder symbol references
 * while still rejecting non-existent names. Compute once per `generate`
 * run; reusable across folders.
 */
export const buildKnownExports = (ctx: ProjectContext): ReadonlySet<string> => {
  const out = new Set<string>();
  for (const sf of ctx.sources) {
    for (const d of collectExports(sf.path, sf.source, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    })) {
      out.add(d.name);
      out.add(d.declaredName);
    }
  }
  return out;
};

export interface GenerateFolderArgs {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
  readonly projectCtx: ProjectContext;
  readonly knownExports: ReadonlySet<string>;
}

const buildAnalysis = (
  args: GenerateFolderArgs,
): Effect.Effect<FolderAnalysis, GenerateFolderAnyError> =>
  Effect.gen(function* () {
    const { fs, path, folder, projectCtx, knownExports } = args;
    const entries = yield* fs.readDirectory(folder).pipe(
      Effect.map((es) => [...es].sort()),
      Effect.mapError(ioErr(folder, folder)),
    );
    const { sources, tests } = yield* collectFolderFiles(fs, path, folder, entries);
    const indexFilePath = sources.find((p) => path.basename(p) === "index.ts");
    if (indexFilePath === undefined) {
      return yield* Effect.fail(new GenerateFolderError({
        folder, reason: "folder has no `index.ts` barrel; folder spec requires one",
      }));
    }
    const declarations = yield* exportsOfFile(fs, folder, indexFilePath, projectCtx);
    const directives: LocatedDirective[] = [];
    for (const filePath of [...sources, ...uniqueExternalSources(declarations, sources)]) {
      const source = yield* fs.readFileString(filePath)
        .pipe(Effect.mapError(ioErr(folder, filePath)));
      directives.push(...(yield* parseFileDirectives(filePath, source)));
    }
    const { rows: properties, directives: testDirectives } =
      yield* parseTests(fs, folder, tests, knownExports);
    const subfolders = projectCtx.subfoldersOf(folder);
    const subDirectives: LocatedDirective[] = [];
    for (const sub of subfolders) {
      const idx = path.join(sub, "index.ts");
      const src = yield* fs.readFileString(idx)
        .pipe(Effect.mapError(ioErr(folder, idx)));
      subDirectives.push(...(yield* parseFileDirectives(idx, src)));
    }
    const purposeByPath = indexFilePurposes([
      ...directives, ...testDirectives, ...subDirectives,
    ]);
    const children = buildChildren({
      folder, sources, tests, subfolders, purposeByPath, path,
    });
    return {
      folder,
      purpose: purposeByPath.get(indexFilePath) ?? null,
      exports: buildExportEntries(declarations, directives).entries,
      properties,
      children,
    };
  });

const requireCoverageWhenGated = (
  folder: string,
  threshold: number,
  branchCoverage: number | null,
): Effect.Effect<void, MissingImplError> => {
  if (threshold <= 0 || branchCoverage !== null) return Effect.void;
  return Effect.fail(
    new MissingImplError({
      location: folder,
      diagnostic: {
        problem: `branchCoverageFromSpecTests threshold ${threshold} set, but coverage-summary.json is absent or missing data for this folder`,
        cause: "vitest's v8 coverage report is missing — tests likely ran without --coverage, or this folder was added after the last coverage run",
        fix: "run `pnpm test --coverage` before `pnpm safer-spec validate --implemented`, or drop the branchCoverageFromSpecTests threshold to 0",
        docsLink: "https://github.com/chughtapan/safer-spec-development/blob/main/docs/errors.md#missing-impl",
      },
    }),
  );
};

interface RequireFreshCoverageArgs {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
  readonly threshold: number;
  readonly branchCoverage: number | null;
  readonly folderFiles: ReadonlyArray<string>;
  readonly projectNewestMtime?: number;
}

const mtimeMs = (stat: { readonly mtime: { _tag: string; value?: Date } } | null): number => {
  if (stat === null) return 0;
  return stat.mtime._tag === "Some" && stat.mtime.value !== undefined
    ? stat.mtime.value.getTime()
    : 0;
};

const requireFreshCoverage = (
  args: RequireFreshCoverageArgs,
): Effect.Effect<void, MissingImplError> => {
  const { fs, path, folder, threshold, branchCoverage, folderFiles, projectNewestMtime } = args;
  if (threshold <= 0 || branchCoverage === null) return Effect.void;
  return Effect.gen(function* () {
    const coverageStat = yield* fs.stat(path.join("coverage", "coverage-summary.json"))
      .pipe(Effect.catchAll(() => Effect.succeed(null)));
    if (coverageStat === null) return;
    const coverageMtime = mtimeMs(coverageStat);
    // Compare against the newest mtime in the project — coverage is
    // a project-wide aggregate, so an edit to ANY spec test (even one
    // outside this folder) can shift this folder's branch numbers and
    // invalidate the cached summary. The caller (validate command)
    // precomputes the project-wide mtime once; the per-folder fallback
    // (single-folder validate calls in tests) is the local source+test
    // set, which subsumes the no-coverage-edit case.
    const folderNewest = yield* newestFileMtime(fs, folderFiles);
    const referenceMtime = projectNewestMtime !== undefined
      ? Math.max(projectNewestMtime, folderNewest)
      : folderNewest;
    if (coverageMtime >= referenceMtime) return;
    yield* Effect.fail(
      new MissingImplError({
        location: folder,
        diagnostic: {
          problem: "coverage-summary.json is older than the folder's tests/sources — coverage is stale relative to current code",
          cause: `coverage mtime ${new Date(coverageMtime).toISOString()} < reference mtime ${new Date(referenceMtime).toISOString()}`,
          fix: "rerun `pnpm test --coverage` so the coverage report reflects the current tree",
          docsLink: "https://github.com/chughtapan/safer-spec-development/blob/main/docs/errors.md#missing-impl",
        },
      }),
    );
  });
};

const newestFileMtime = (
  fs: FileSystem.FileSystem,
  files: ReadonlyArray<string>,
): Effect.Effect<number, never> =>
  Effect.forEach(
    files,
    (f) => fs.stat(f).pipe(
      Effect.map(mtimeMs),
      Effect.catchAll(() => Effect.succeed(0)),
    ),
    { concurrency: 4 },
  ).pipe(Effect.map((mtimes) => Math.max(0, ...mtimes)));

/**
 * @spec.guarantee "returns the max mtime across every project source file, every spec.test.ts discovered under each folder, and the runner/codemod config files (vitest.config.ts, safer-spec.config.json); 0 when nothing exists"
 *   reason: validate's branchCoverage freshness check needs a
 *           project-wide reference; config files can shift coverage
 *           attribution without touching sources or tests.
 */
export const computeProjectNewestMtime = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  projectCtx: ProjectContext,
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    const sourcePaths = projectCtx.sources.map((s) => s.path);
    const folderInputs = yield* Effect.forEach(
      projectCtx.folders,
      (folder) => collectFolderInputs(fs, path, folder),
      { concurrency: 4 },
    );
    const testPaths = folderInputs.flatMap((i) => (i === null ? [] : [...i.tests]));
    // Edits to vitest.config.ts (e.g., narrowing test.include or
    // coverage.exclude) change what gets credited toward
    // branchCoverageFromSpecTests even when no source/test file moved.
    // safer-spec.config.json changes thresholds. Either invalidates
    // a cached coverage-summary.json for gate purposes.
    const configPaths: ReadonlyArray<string> = [
      "vitest.config.ts",
      "safer-spec.config.json",
    ];
    return yield* newestFileMtime(fs, [...sourcePaths, ...testPaths, ...configPaths]);
  }).pipe(Effect.withSpan("analysis/computeProjectNewestMtime"));

const driftMetaFor = (
  analysis: FolderAnalysis,
  projectCtx: ProjectContext,
): SpecMeta =>
  buildSpecMeta(analysis, {
    generatedAtSha: projectCtx.generatedAtSha,
    thresholds: projectCtx.thresholdsFor(analysis.folder),
  });

/**
 * @spec.guarantee "returns the artifacts (markdown + sidecar JSON) for one folder; folder writes are the caller's responsibility so --dry-run / --write decisions stay at the CLI boundary"
 *   reason: separation of pipeline (here) from I/O policy (commands/).
 * @spec.residual-contract "execution metrics from the Vitest reporter are NOT folded into the emitted artifacts; committed SPEC.md must be deterministic at a given tree SHA regardless of whether tests ran locally"
 *   reason: drift-check byte-equality contract.
 */
export const generateFolder = (
  args: GenerateFolderArgs,
): Effect.Effect<GenerateFolderArtifacts, GenerateFolderAnyError> =>
  Effect.gen(function* () {
    const { folder, path, projectCtx } = args;
    const analysis = yield* buildAnalysis(args);
    const meta = driftMetaFor(analysis, projectCtx);
    const markdown = emitMarkdown(analysis, meta);
    const sidecarJson = yield* regenerateSidecar(analysis, meta);
    const sidecarRelPath = path.join(folder, ".safer-spec", `${sidecarSlug(folder)}.json`);
    return { analysis, markdown, sidecarJson, sidecarRelPath };
  }).pipe(Effect.withSpan("analysis/generateFolder"));

/**
 * @spec.guarantee "first failing check short-circuits and emits exactly one of the four gap-class errors; success returns the folder string"
 *   reason: the cli's catchTags routing acts on the tag; batched failures
 *           would obscure routing.
 * @spec.assume "the underlying generate-tier pipeline is deterministic at the same tree SHA"
 *   reason: drift cross-checks rely on byte-equality between on-disk and
 *           regenerated artifacts.
 * @spec.residual-contract "in `--implemented` mode, a Vitest execution sidecar must already exist on disk for the folder; absence is reported as MissingImplError"
 *   reason: implementation-tier gate; planned-mode doesn't read execution
 *           sidecars at all.
 */
export interface ValidateFolderArgs {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
  readonly projectCtx: ProjectContext;
  readonly mode: "planned" | "implemented";
  // Newest mtime among every project source + spec-test file. Used as
  // the freshness reference for branchCoverage staleness, since
  // coverage-summary.json is a project-wide aggregate — an edit to a
  // spec-test in folder B can invalidate coverage for folder A.
  // Optional so single-folder validate calls (tests) need not compute it.
  readonly projectNewestMtime?: number;
}

export const validateFolder = (
  args: ValidateFolderArgs,
): Effect.Effect<string | null, ValidateGapError> =>
  Effect.gen(function* () {
    const { fs, path, folder, projectCtx, mode, projectNewestMtime } = args;
    const inputs = yield* collectFolderInputs(fs, path, folder);
    if (inputs === null) return null;
    const inspection = yield* catchDirectiveErrors(
      inspectFolder({ fs, path, folder, inputs, ctx: projectCtx }),
    );
    yield* failOnIssues(inspection.issues, mode);
    const driftMeta = driftMetaFor(inspection.analysis, projectCtx);
    const regenerated = emitMarkdown(inspection.analysis, driftMeta);
    yield* checkDrift(fs, path.join(folder, "SPEC.md"), regenerated);
    const sidecarJson = yield* regenerateSidecar(inspection.analysis, driftMeta);
    const sidecarPath = path.join(folder, ".safer-spec", `${sidecarSlug(folder)}.json`);
    yield* checkSidecarDrift(fs, sidecarPath, sidecarJson);
    if (mode === "implemented") {
      const execution = yield* loadExecutionSidecar(fs, path, folder);
      const currentHash = yield* computeTestTreeHash(
        fs,
        [...inputs.sources, ...inputs.tests],
      );
      yield* checkExecutionSidecarPresent(inspection.analysis, folder, execution, currentHash);
      yield* checkImplBodies(inspection.analysis);
      const thresholds = projectCtx.thresholdsFor(inspection.analysis.folder);
      const branchCoverage = yield* loadBranchCoverage(fs, path, folder, {
        expectedSources: inputs.sources,
      });
      yield* requireCoverageWhenGated(folder, thresholds.branchCoverageFromSpecTests, branchCoverage);
      yield* requireFreshCoverage({
        fs, path, folder,
        threshold: thresholds.branchCoverageFromSpecTests,
        branchCoverage,
        folderFiles: [...inputs.sources, ...inputs.tests],
        ...(projectNewestMtime !== undefined ? { projectNewestMtime } : {}),
      });
      const gateMeta = buildSpecMeta(inspection.analysis, {
        generatedAtSha: projectCtx.generatedAtSha,
        thresholds,
        execution,
        branchCoverageFromSpecTests: branchCoverage,
      });
      yield* checkThresholds(folder, inspection.analysis, gateMeta);
    } else {
      yield* checkThresholds(folder, inspection.analysis, driftMeta);
    }
    return folder;
  }).pipe(Effect.withSpan("analysis/validateFolder"));
