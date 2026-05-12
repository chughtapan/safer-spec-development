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

import * as nodePath from "node:path";
import { Config, Effect, Schema } from "effect";
import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";

// Reporter is loaded by `vitest.config.ts` BEFORE vite's tsconfig-paths
// plugin is registered, so node resolves this module's import chain
// without any `@safer/*` alias support. Any import from this file (and
// anything it transitively pulls in) must therefore be resolvable by
// plain node ESM. That excludes the rest of the spec domain — which IS
// aliased — so this file keeps the slug helper inline rather than
// reaching across the alias boundary. The shared definition still lives
// in `sidecar-writer.ts` (consumed by `commands/`); the two copies are
// the same trivial expression and the reporter test pins them via the
// `sidecar-writer-coalesces-path-separators-into-slug` property.

interface FastCheckTaskStats {
  readonly numRuns: number;
  readonly numSkips: number;
  readonly classifiers: ReadonlyArray<string>;
}

const sidecarSlug = (folder: string): string => {
  if (folder === ".") return "root";
  return folder.replace(/^\.[/\\]/, "").replace(/[/\\]+/g, "_");
};

const EXECUTION_SIDECAR_FORMAT_VERSION = "1" as const;

const FastCheckTaskStatsSchema = Schema.Struct({
  numRuns: Schema.Number,
  numSkips: Schema.Number,
  classifiers: Schema.Array(Schema.String),
});

const ExecutionSidecarSchema = Schema.Struct({
  formatVersion: Schema.Literal(EXECUTION_SIDECAR_FORMAT_VERSION),
  folder: Schema.String,
  generatedAtSha: Schema.String,
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
  let anyClassifier = false;
  for (const s of stats) {
    runs += s.numRuns;
    skips += s.numSkips;
    anyClassifier ||= s.classifiers.length > 0;
  }
  const total = runs + skips;
  return {
    classifierCoverage: anyClassifier ? 0 : null,
    preconditionPassRate: total === 0 ? null : runs / total,
    branchCoverageFromSpecTests: null,
  };
};

interface FolderBucket {
  readonly folder: string;
  readonly stats: Array<FastCheckTaskStats>;
}

const addToBuckets = (
  buckets: Map<string, FolderBucket>,
  folder: string,
  collected: ReadonlyArray<FastCheckTaskStats>,
): void => {
  if (collected.length === 0) return;
  // Root-folder tests (`foo.spec.test.ts` or `__tests__/foo.spec.test.ts`
  // at the project root) resolve to folder === "". The rest of the CLI
  // uses the `.` sentinel for that case (sidecarSlug, generate,
  // validate); preserve the stats by re-mapping here.
  const key = folder.length === 0 ? "." : folder;
  const bucket = buckets.get(key) ?? { folder: key, stats: [] };
  bucket.stats.push(...collected);
  buckets.set(key, bucket);
};

const groupByFolder = (
  files: ReadonlyArray<MinimalFile>,
  projectRoot: string,
): ReadonlyArray<FolderBucket> => {
  const buckets = new Map<string, FolderBucket>();
  for (const file of files) {
    const collected: Array<FastCheckTaskStats> = [];
    walkTaskMeta(file, collected);
    addToBuckets(buckets, folderOfTestFile(file.filepath, projectRoot), collected);
  }
  return [...buckets.values()];
};

const writeOneSidecar = (
  bucket: FolderBucket,
  generatedAtSha: string,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const sidecar: ExecutionSidecar = {
      formatVersion: EXECUTION_SIDECAR_FORMAT_VERSION,
      folder: bucket.folder,
      generatedAtSha,
      ...aggregate(bucket.stats),
    };
    const encoded = yield* Schema.encode(ExecutionSidecarSchema)(sidecar).pipe(
      Effect.catchAll(() => Effect.succeed(sidecar)),
    );
    const dir = path.join(bucket.folder, ".safer-spec");
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
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(buckets, (b) => writeOneSidecar(b, generatedAtSha), {
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
    yield* writeAll(buckets, sha);
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
