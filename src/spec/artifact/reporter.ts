/**
 * @spec.purpose Vitest reporter that emits per-folder execution sidecars.
 *   Walks the file/task tree at `onFinished`, extracts the fast-check stats
 *   attached to each `itSpec.prop` call's `task.meta.fastCheck` slot,
 *   aggregates by enclosing folder (`folder/__tests__/x.spec.test.ts` is
 *   credited to `folder`), and writes `folder/.safer-spec/slug.execution.json`.
 *
 *   Boundary: Vitest's File/Task shape carries arbitrary user metadata;
 *   each task's `meta.fastCheck` goes through `FastCheckTaskStatsSchema`
 *   and the final sidecar through `ExecutionSidecarSchema` so validate
 *   can decode the on-disk artifact without trust assumptions.
 *
 *   `SaferSpecExecutionReporter` is the Vitest-facing class. validate's
 *   `--implemented` mode reads the emitted sidecar via
 *   `decodeExecutionSidecar`. The reporter composes its own
 *   `NodeContext.layer` because Vitest invokes it outside the codemod
 *   CLI's composition root, so this file owns its runtime boundary.
 */

import { createHash } from "node:crypto";
import * as nodePath from "node:path";
import { Config, Effect, Schema } from "effect";
import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";

// Reporter is loaded by `vitest.config.ts` BEFORE the tsconfig-paths
// plugin is registered, so imports must resolve via plain node ESM
// (no `@safer/*` aliases). Slug helper inlined to avoid crossing the
// alias boundary; pinned to the sidecar-writer copy by property test.
interface FastCheckTaskStats {
  readonly propertyId: string;
  readonly numRuns: number;
  readonly numSkips: number;
}

const sidecarSlug = (folder: string): string => {
  if (folder === ".") return "root";
  return folder.replace(/^\.[/\\]/, "").replace(/[/\\]+/g, "_");
};

const EXECUTION_SIDECAR_FORMAT_VERSION = "1" as const;

const FastCheckTaskStatsSchema = Schema.Struct({
  propertyId: Schema.String,
  numRuns: Schema.Number,
  numSkips: Schema.Number,
});

const ExecutionSidecarSchema = Schema.Struct({
  formatVersion: Schema.Literal(EXECUTION_SIDECAR_FORMAT_VERSION),
  folder: Schema.String,
  generatedAtSha: Schema.String,
  // Sorted, deduplicated property IDs the reporter observed for this
  // folder. Validate compares this set against the current folder's
  // implemented properties; mismatch = stale sidecar (test set changed
  // since the last `pnpm test` run).
  propertyIds: Schema.Array(Schema.String),
  // SHA-256 of the concatenated test-file bytes (lex-sorted by path)
  // the reporter observed at write-time. Validate recomputes the hash
  // from the current files on disk and rejects the sidecar when they
  // differ — catches edits to property bodies / arbitraries that don't
  // change the propertyIds set.
  testTreeHash: Schema.String,
  classifierCoverage: Schema.NullOr(Schema.Number),
  preconditionPassRate: Schema.NullOr(Schema.Number),
  branchCoverageFromSpecTests: Schema.NullOr(Schema.Number),
});

export type ExecutionSidecar = Schema.Schema.Type<typeof ExecutionSidecarSchema>;

/**
 * @spec.guarantee "rejects malformed input on the Effect error channel with a typed ParseError, never throws"
 *   reason: trust-boundary contract; validate's --implemented gate reads
 *           the on-disk artifact and routes parse failures to its typed
 *           gap error.
 * @spec.residual-contract "decoded sidecar field invariants are enforced at decode time; classifierCoverage / preconditionPassRate may be `null` when the test run produced no measurable samples"
 *   reason: lifecycle; populated only when an itSpec.prop body actually
 *           ran during the test execution.
 */
export const decodeExecutionSidecar = Schema.decodeUnknown(ExecutionSidecarSchema);

const decodeStats = Schema.decodeUnknownOption(FastCheckTaskStatsSchema);

// Vitest File/Task shape, narrowed to the slots this reporter consumes.
interface MinimalTask {
  readonly tasks?: ReadonlyArray<MinimalTask>;
  readonly meta?: unknown;
}

interface MinimalFile extends MinimalTask {
  readonly filepath: string;
}

const statsFromMeta = (meta: unknown): FastCheckTaskStats | null => {
  if (typeof meta !== "object" || meta === null) return null;
  const slot = (meta as { readonly fastCheck?: unknown }).fastCheck;
  if (slot === undefined) return null;
  const decoded = decodeStats(slot);
  return decoded._tag === "Some" ? decoded.value : null;
};

const walkTaskMeta = (
  task: MinimalTask,
  out: Array<FastCheckTaskStats>,
): void => {
  const stats = statsFromMeta(task.meta);
  if (stats !== null) out.push(stats);
  if (task.tasks === undefined) return;
  for (const child of task.tasks) walkTaskMeta(child, out);
};

// Test file `src/foo/__tests__/bar.spec.test.ts` belongs to folder `src/foo`.
// Test file `src/foo/bar.spec.test.ts` belongs to folder `src/foo`.
const folderOfTestFile = (filepath: string, projectRoot: string): string => {
  const rel = nodePath.relative(projectRoot, filepath);
  const normalized = rel.split(nodePath.sep).join("/");
  const parts = normalized.split("/");
  const parent = parts.slice(0, -1);
  if (parent.at(-1) === "__tests__") return parent.slice(0, -1).join("/");
  return parent.join("/");
};

interface AggregatedCoverage {
  readonly classifierCoverage: number | null;
  readonly preconditionPassRate: number | null;
  readonly branchCoverageFromSpecTests: number | null;
}

const NO_COVERAGE: AggregatedCoverage = {
  classifierCoverage: null,
  preconditionPassRate: null,
  branchCoverageFromSpecTests: null,
};

const aggregate = (stats: ReadonlyArray<FastCheckTaskStats>): AggregatedCoverage => {
  if (stats.length === 0) return NO_COVERAGE;
  let runs = 0;
  let skips = 0;
  for (const s of stats) {
    runs += s.numRuns;
    skips += s.numSkips;
  }
  const total = runs + skips;
  // `preconditionPassRate` reports samples-that-passed / total-samples
  // (1.0 when no `fc.pre` was used — 100% of samples ran because there
  // were no preconditions to fail). `classifierCoverage` stays null:
  // fast-check has no canonical project-wide classifier coverage notion
  // (`fc.statistics` is an ad-hoc debugging tool); inventing one here
  // gates on adoption rather than quality. Schema field stays for forward
  // compat with any future per-test classifier observability.
  return {
    classifierCoverage: null,
    preconditionPassRate: total === 0 ? null : runs / total,
    branchCoverageFromSpecTests: null,
  };
};

interface FolderBucket {
  readonly folder: string;
  readonly stats: Array<FastCheckTaskStats>;
  // Test file paths in TWO views: `rel` is projectRoot-relative
  // (POSIX-style) for hash input identity with validate; `abs` is the
  // absolute path used to read bytes regardless of the reporter's cwd.
  readonly testFiles: Array<{ readonly rel: string; readonly abs: string }>;
}

// Validate's `isTestFile` predicate (collectFolderInputs only treats
// `.spec.test.ts` as a codemod test file). The reporter must use the
// same filter so the hash inputs stay symmetric — Vitest hands us every
// `*.test.ts`, including ordinary tests downstream consumers run.
const isSpecTestFile = (filepath: string): boolean =>
  filepath.endsWith(".spec.test.ts");

const groupByFolder = (
  files: ReadonlyArray<MinimalFile>,
  projectRoot: string,
): ReadonlyArray<FolderBucket> => {
  const buckets = new Map<string, FolderBucket>();
  for (const file of files) {
    if (!isSpecTestFile(file.filepath)) continue;
    const collected: Array<FastCheckTaskStats> = [];
    walkTaskMeta(file, collected);
    // Root-folder tests (`foo.spec.test.ts` / `__tests__/...` at the
    // project root) resolve to folder === ""; the rest of the CLI uses
    // the `.` sentinel (sidecarSlug, generate, validate all agree).
    const folder = folderOfTestFile(file.filepath, projectRoot);
    const key = folder.length === 0 ? "." : folder;
    const rel = nodePath.relative(projectRoot, file.filepath).split(nodePath.sep).join("/");
    const bucket = buckets.get(key) ?? { folder: key, stats: [], testFiles: [] };
    bucket.stats.push(...collected);
    bucket.testFiles.push({ rel, abs: file.filepath });
    buckets.set(key, bucket);
  }
  // Drop buckets that produced no stats at all — those folders had no
  // implemented itSpec.prop and don't need an execution sidecar (the
  // planned → implemented ratchet rule from `checkExecutionSidecarPresent`).
  return [...buckets.values()].filter((b) => b.stats.length > 0);
};

export const hashTestTree = (paths: ReadonlyArray<string>, read: (p: string) => string): string => {
  const h = createHash("sha256");
  for (const p of [...paths].sort()) {
    h.update(p);
    h.update("\0");
    h.update(read(p));
    h.update("\0");
  }
  return h.digest("hex");
};

const toPosix = (p: string): string => p.split("\\").join("/");

/**
 * @spec.guarantee "reads the given test paths from disk, normalizes them to POSIX slashes, sorts by path, and returns the sha256 hex digest — the freshness-gate input validate compares against the on-disk execution sidecar's `testTreeHash`"
 *   reason: Windows-host runs would otherwise hash with `\` separators
 *           while the reporter writes POSIX. Normalizing here keeps the
 *           comparison stable across hosts.
 * @spec.residual-contract "unreadable test files contribute the empty string to the hash; the reporter applies the same convention so a transient read failure doesn't poison the hash"
 *   reason: byte-equality contract; missing-file -> empty-bytes.
 */
export const computeTestTreeHash = (
  fs: FileSystem.FileSystem,
  testPaths: ReadonlyArray<string>,
): Effect.Effect<string, never> =>
  Effect.gen(function* () {
    const reads = yield* Effect.forEach(
      testPaths,
      (p) => fs.readFileString(p).pipe(
        Effect.map((content) => [toPosix(p), content] as const),
        Effect.catchAll(() => Effect.succeed([toPosix(p), ""] as const)),
      ),
      { concurrency: 1 },
    );
    const byPath = new Map(reads);
    const posixPaths = testPaths.map(toPosix);
    return hashTestTree(posixPaths, (p) => byPath.get(p) ?? "");
  }).pipe(Effect.withSpan("spec/artifact/reporter/computeTestTreeHash"));

/**
 * @spec.guarantee "loads the per-folder execution sidecar emitted by the Vitest reporter, decoded through `ExecutionSidecarSchema`; returns null when absent or malformed"
 *   reason: validate's `--implemented` gate consumes the coverage values;
 *           absence is surfaced separately as a typed gap error.
 */

/**
 * @spec.guarantee "reads `coverage/coverage-summary.json` and aggregates v8 branch coverage for the folder's immediate source files; returns `null` when the file is absent (so consumers can loud-fail) and `1.0` when present-but-no-branches"
 *   reason: validate's `--implemented` gate consumes branchCoverageFromSpecTests;
 *           the null/1.0 split lets it distinguish "user forgot --coverage"
 *           from "folder is just re-exports."
 * @spec.residual-contract "absolute paths from v8 are rebased to project-relative via `path.relative` before the per-folder prefix match"
 *   reason: vitest emits absolute paths; we aggregate by repo-relative folder.
 */
export const loadBranchCoverage = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
  projectRoot: string = ".",
): Effect.Effect<number | null, never> =>
  fs
    .readFileString(path.join(projectRoot, "coverage", "coverage-summary.json"))
    .pipe(
      Effect.flatMap((text) =>
        Effect.try({ try: () => JSON.parse(text) as unknown, catch: () => null }),
      ),
      Effect.map((parsed) => aggregateBranchCoverageForFolder(parsed, folder, projectRoot)),
      Effect.catchAll(() => Effect.succeed(null)),
    );

interface BranchSummary {
  readonly branches?: { readonly total: number; readonly covered: number };
}

const aggregateBranchCoverageForFolder = (
  parsed: unknown,
  folder: string,
  projectRoot: string,
): number => {
  if (typeof parsed !== "object" || parsed === null) return 1;
  const summary = parsed as Record<string, BranchSummary>;
  const rootAbs = nodePath.resolve(projectRoot);
  const branches = Object.entries(summary)
    .filter(([key]) => key !== "total")
    .map(([key, value]) => ({
      rel: nodePath.relative(rootAbs, key).split(nodePath.sep).join("/"),
      branches: value.branches,
    }))
    .filter((e) => e.branches !== undefined && isImmediateChild(e.rel, folder))
    .map((e) => e.branches as { readonly total: number; readonly covered: number });
  const total = branches.reduce((sum, b) => sum + b.total, 0);
  // Folder has no branchable code (pure re-exports etc.) — vacuously
  // covered. Parallels typeCoverage's no-value-exports degenerate case.
  if (total === 0) return 1;
  const covered = branches.reduce((sum, b) => sum + b.covered, 0);
  return covered / total;
};

// Immediate child of `folder` (non-recursive): the relative path must
// start with `folder/` AND have no further `/` segments. Folder "." (the
// project-root sentinel) matches any top-level source file.
const isImmediateChild = (rel: string, folder: string): boolean => {
  if (folder === ".") return !rel.includes("/");
  const prefix = `${folder}/`;
  if (!rel.startsWith(prefix)) return false;
  return !rel.slice(prefix.length).includes("/");
};

export const loadExecutionSidecar = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<ExecutionSidecar | null, never> =>
  fs
    .readFileString(
      path.join(folder, ".safer-spec", `${sidecarSlug(folder)}.execution.json`),
    )
    .pipe(
      Effect.flatMap((text) =>
        Effect.try({ try: () => JSON.parse(text) as unknown, catch: () => null }),
      ),
      Effect.flatMap(decodeExecutionSidecar),
      Effect.map((v): ExecutionSidecar | null => v),
      Effect.catchAll(() => Effect.succeed(null)),
    );

// Enumerate the folder's source files (`.ts`, excluding `.d.ts` and
// `.spec.test.ts`) — mirror of `collectFolderInputs` in
// validate-pipeline.ts. Both must produce the same set so the
// treeHash inputs match.
const enumerateSourcePaths = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  projectRoot: string,
  folder: string,
): Effect.Effect<Array<{ readonly rel: string; readonly abs: string }>, never> =>
  Effect.gen(function* () {
    const folderAbs = path.isAbsolute(folder) ? folder : path.join(projectRoot, folder);
    const entries = yield* fs.readDirectory(folderAbs)
      .pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)));
    const out: Array<{ readonly rel: string; readonly abs: string }> = [];
    for (const name of entries) {
      if (!name.endsWith(".ts") || name.endsWith(".d.ts") || name.endsWith(".spec.test.ts")) continue;
      const abs = path.join(folderAbs, name);
      const rel = nodePath.relative(projectRoot, abs).split(nodePath.sep).join("/");
      out.push({ rel, abs });
    }
    return out;
  });

const writeOneSidecar = (
  bucket: FolderBucket,
  generatedAtSha: string,
  projectRoot: string,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const propertyIds = [...new Set(bucket.stats.map((s) => s.propertyId))].sort();
    const sourcePaths = yield* enumerateSourcePaths(fs, path, projectRoot, bucket.folder);
    // Hash inputs cover BOTH source files and test files in the folder so
    // an implementation-only edit between `pnpm test` and validate also
    // invalidates the sidecar. Read by absolute path; key by POSIX-style
    // projectRoot-relative path (matches what validate hashes).
    const allFiles = [...sourcePaths, ...bucket.testFiles];
    const reads = yield* Effect.forEach(
      allFiles,
      (tf) => fs.readFileString(tf.abs).pipe(
        Effect.map((content) => [tf.rel, content] as const),
        Effect.catchAll(() => Effect.succeed([tf.rel, ""] as const)),
      ),
      { concurrency: 1 },
    );
    const byRel = new Map(reads);
    const relPaths = allFiles.map((tf) => tf.rel);
    const testTreeHash = hashTestTree(relPaths, (p) => byRel.get(p) ?? "");
    const sidecar: ExecutionSidecar = {
      formatVersion: EXECUTION_SIDECAR_FORMAT_VERSION,
      folder: bucket.folder,
      generatedAtSha,
      propertyIds,
      testTreeHash,
      ...aggregate(bucket.stats),
    };
    const encoded = yield* Schema.encode(ExecutionSidecarSchema)(sidecar).pipe(
      Effect.catchAll(() => Effect.succeed(sidecar)),
    );
    // bucket.folder is relative to projectRoot (set in groupByFolder).
    // Anchor at projectRoot so monorepo workspace consumers writing from
    // a sub-package config land sidecars inside that workspace rather
    // than under whatever process.cwd() happens to be at test time.
    const dir = path.join(projectRoot, bucket.folder, ".safer-spec");
    const file = path.join(dir, `${sidecarSlug(bucket.folder)}.execution.json`);
    yield* fs
      .makeDirectory(dir, { recursive: true })
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    const json = JSON.stringify(encoded, null, 2) + "\n";
    yield* fs
      .writeFileString(file, json)
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
  });

const writeAll = (
  buckets: ReadonlyArray<FolderBucket>,
  generatedAtSha: string,
  projectRoot: string,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(buckets, (b) => writeOneSidecar(b, generatedAtSha, projectRoot), {
    discard: true,
    concurrency: 1,
  });

const ShaConfig = Config.string("SAFER_SPEC_EXECUTION_SHA").pipe(
  Config.withDefault("uncommitted"),
);

const runReporter = (
  files: ReadonlyArray<MinimalFile>,
  projectRoot: string,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const sha = yield* Effect.orElseSucceed(ShaConfig, () => "uncommitted");
    const buckets = groupByFolder(files, projectRoot);
    if (buckets.length === 0) return;
    yield* writeAll(buckets, sha, projectRoot);
  });

/**
 * @spec.guarantee "on `onFinished`, walks the File tree, aggregates fast-check stats per enclosing folder, and writes one `folder/.safer-spec/slug.execution.json` per folder with measurable stats"
 *   reason: validate --implemented consumes these sidecars to populate
 *           SpecMeta.coverage; the reporter is the typed write boundary.
 * @spec.residual-contract "filesystem failures are swallowed; the reporter must not crash the test run on a partial sidecar (validate will surface the missing sidecar via its own gap error)"
 *   reason: separation of concerns; reporting is best-effort, validation
 *           is the strict gate.
 */
export class SaferSpecExecutionReporter {
  readonly #projectRoot: string;

  constructor(options?: { readonly projectRoot?: string }) {
    this.#projectRoot = options?.projectRoot ?? process.cwd();
  }

  // eslint-disable-next-line agent-code-guard/promise-type -- Vitest's Reporter interface requires Awaitable<void>; the runtime boundary is THIS class
  onFinished(files?: ReadonlyArray<MinimalFile>): Promise<void> {
    if (files === undefined || files.length === 0) return Promise.resolve();
    return Effect.runPromise(
      runReporter(files, this.#projectRoot).pipe(Effect.provide(NodeContext.layer)),
    );
  }
}
