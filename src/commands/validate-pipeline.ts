/**
 * @spec.purpose Shared analysis pipeline for `validate`. Walks the same
 *   inputs as `generate` (sources, tests, index barrel) and returns the
 *   `FolderAnalysis` that the markdown emitter consumes plus the per-test
 *   issues list (`ItSpecIssue[]`) that `validate.ts` maps to its
 *   gap-class exit codes.
 */

import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import {
  parseFileDirectives,
  type JsDocDirectiveOverflowError,
  type JsDocDirectiveParseError,
  type JsDocUnknownDirectiveError,
  type LocatedDirective,
} from "@safer/spec/directives/index.js";
import {
  buildSpecArtifact,
  computeTypeCoverage,
  emitMarkdown,
  findMissingPropertyTypes,
  type FolderAnalysis,
  type PropertyRow,
  type SpecMeta,
} from "@safer/spec/emit.js";
import {
  decodeExecutionSidecar,
  type ExecutionSidecar,
} from "@safer/spec/reporter.js";
import { serializeSidecar, sidecarSlug } from "@safer/spec/sidecar-writer.js";
import {
  buildExportEntries,
  collectExports,
  indexFilePurposes,
  uniqueExternalSources,
} from "@safer/spec/source-exports.js";
import { extractProperties, type ItSpecIssue } from "@safer/spec/todos.js";
import { resolveThresholdsFor } from "@safer/commands/config.js";
import type { ProjectContext } from "@safer/commands/project-context.js";
import {
  buildChildren,
  discoverFolders,
  discoverImmediateSubfolders,
} from "@safer/commands/folder-discovery.js";

export { discoverFolders, discoverImmediateSubfolders, buildChildren };
export {
  loadProjectContext,
  loadValidateProjectContext,
  type ProjectContext,
} from "@safer/commands/project-context.js";

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
  fs.readDirectory(dir).pipe(
    Effect.map((entries) => [...entries].sort()),
    Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
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

interface TestParseResult {
  readonly rows: ReadonlyArray<PropertyRow>;
  readonly issues: ReadonlyArray<ItSpecIssue>;
  readonly directives: ReadonlyArray<LocatedDirective>;
}

// `collectKnownExports` returns the project-wide union of export names; the
// folder-scoped variant restricts to `sources`. Both feed validate's typo
// gates: the project set lets cross-folder references pass, the folder set
// flags truly-stale per-export directives.
const exportNamesFrom = (
  ctx: ProjectContext,
  paths: ReadonlySet<string> | null,
): ReadonlySet<string> => {
  const out = new Set<string>();
  for (const sf of ctx.sources) {
    if (paths !== null && !paths.has(sf.path)) continue;
    for (const d of collectExports(sf.path, sf.source, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    })) {
      out.add(d.name);
      out.add(d.declaredName);
    }
  }
  return out;
};

const collectKnownExports = (ctx: ProjectContext): ReadonlySet<string> =>
  exportNamesFrom(ctx, null);

const folderExportNames = (
  sources: ReadonlyArray<string>,
  ctx: ProjectContext,
): ReadonlySet<string> => exportNamesFrom(ctx, new Set(sources));

const parseTests = (
  fs: FileSystem.FileSystem,
  tests: ReadonlyArray<string>,
  declaredExports: ReadonlySet<string>,
): Effect.Effect<TestParseResult, DirectiveParseError> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    const issues: ItSpecIssue[] = [];
    const directives: LocatedDirective[] = [];
    for (const p of tests) {
      const src = yield* readSource(fs, p);
      const parsed = yield* parseFileDirectives(p, src);
      directives.push(...parsed);
      const r = extractProperties(p, src, parsed, declaredExports);
      rows.push(...r.rows);
      issues.push(...r.issues);
    }
    return { rows, issues, directives };
  });

export interface FolderInspection {
  readonly analysis: FolderAnalysis;
  readonly issues: ReadonlyArray<ItSpecIssue>;
}

export interface InspectArgs {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly folder: string;
  readonly inputs: FolderInputs;
  readonly ctx: ProjectContext;
}

/**
 * @spec.guarantee "produces the same FolderAnalysis shape `generate` emits plus a per-test issues list; regenerate-and-compare on `analysis` is byte-deterministic"
 *   reason: roundtrip contract; validate's drift check relies on it.
 */
export const inspectFolder = ({ fs, path, folder, inputs, ctx }: InspectArgs): Effect.Effect<FolderInspection, DirectiveParseError> =>
  Effect.gen(function* () {
    const indexFile = ctx.sources.find((s) => s.path === inputs.indexFilePath);
    const indexSrc = indexFile?.source ?? (yield* readSource(fs, inputs.indexFilePath));
    const declarations = collectExports(inputs.indexFilePath, indexSrc, {
      siblings: ctx.sources, paths: ctx.paths, baseUrl: ctx.baseUrl,
    });
    const externalSources = uniqueExternalSources(declarations, inputs.sources);
    const localDirectives = yield* parseSources(fs, inputs.sources);
    const externalDirectives = yield* parseSources(fs, externalSources);
    const directives = [...localDirectives, ...externalDirectives];
    const tests = yield* parseTests(fs, inputs.tests, collectKnownExports(ctx));
    const subfolders = yield* discoverImmediateSubfolders(fs, path, folder);
    const subDirectives = yield* parseSources(fs, subfolders.map((s) => path.join(s, "index.ts")));
    const purposeByPath = indexFilePurposes([
      ...directives, ...tests.directives, ...subDirectives,
    ]);
    const children = buildChildren({
      folder, sources: inputs.sources, tests: inputs.tests, subfolders, purposeByPath, path,
    });
    const built = buildExportEntries(declarations, directives, {
      folderKnownExports: folderExportNames(inputs.sources, ctx),
      localSources: new Set(inputs.sources),
    });
    const unmatchedIssues: ReadonlyArray<ItSpecIssue> = built.unmatched.map((d) => ({
      kind: "directive-mismatch",
      path: d.location.path,
      line: d.location.line,
      detail: `@spec.${d.directive._tag} on "${d.location.exportName ?? "?"}" does not match any export in this folder`,
    }));
    return {
      analysis: {
        folder,
        purpose: purposeByPath.get(inputs.indexFilePath) ?? null,
        exports: built.entries,
        properties: tests.rows,
        children,
      },
      issues: [...tests.issues, ...unmatchedIssues],
    };
  }).pipe(Effect.withSpan("commands/validate-pipeline/inspectFolder"));



const DEFAULT_GENERATED_FROM = {
  jsdoc: "ts-morph + @microsoft/tsdoc",
  exports: "ts-morph getExportedDeclarations",
  schemas: [],
  properties: ["fast-check"],
  eslint: "eslint-plugin-agent-code-guard",
} as const;

/**
 * @spec.guarantee "builds a `SpecMeta` from run-level context + analysis-derived type coverage; populates classifierCoverage / preconditionPassRate from `execution` sidecar when present"
 *   reason: emit's frontmatter + sidecar both require meta; `--implemented`
 *           mode merges Vitest reporter stats into the gate inputs.
 * @spec.residual-contract "branchCoverageFromSpecTests stays null until a v8 coverage hook is wired up (follow-up slice)"
 *   reason: lifecycle contract.
 */
export const buildSpecMeta = (
  analysis: FolderAnalysis,
  ctx: ProjectContext,
  execution?: ExecutionSidecar | null,
): SpecMeta => ({
  generatedAtSha: ctx.generatedAtSha,
  coverage: {
    typeCoverage: computeTypeCoverage(analysis),
    classifierCoverage: execution?.classifierCoverage ?? null,
    preconditionPassRate: execution?.preconditionPassRate ?? null,
    branchCoverageFromSpecTests: execution?.branchCoverageFromSpecTests ?? null,
  },
  thresholds: resolveThresholdsFor(ctx.config, analysis.folder),
  generatedFrom: DEFAULT_GENERATED_FROM,
});

/**
 * @spec.guarantee "loads the per-folder execution sidecar emitted by the Vitest reporter, decoded through `ExecutionSidecarSchema`; returns null when absent or malformed"
 *   reason: validate's `--implemented` gate consumes the coverage values;
 *           absence is surfaced separately as a typed gap error.
 */
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

/** Alias for `emitMarkdown(analysis, meta)`; keeps validate.ts's import block compact. */
export const regenerateMarkdown = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): string => emitMarkdown(analysis, meta);

export interface ThresholdShortfall {
  readonly metric: "typeCoverage" | "classifierCoverage" | "preconditionPassRate";
  readonly observed: number;
  readonly threshold: number;
  readonly missingPropertyTypes: ReadonlyArray<string>;
}

const checkOne = (
  metric: ThresholdShortfall["metric"],
  observed: number | null,
  threshold: number,
  missingPropertyTypes: ReadonlyArray<string>,
): ThresholdShortfall | null => {
  if (threshold <= 0 || observed === null || observed >= threshold) return null;
  return { metric, observed, threshold, missingPropertyTypes };
};

/**
 * @spec.guarantee "returns the first observed-below-threshold metric (typeCoverage → classifier → precondition order) or null when all gates pass"
 *   reason: validate emits one MissingImplError per folder; first failing
 *           gate is the surfaced one.
 * @spec.residual-contract "metrics whose threshold is 0 are not gated regardless of observed value"
 *   reason: zero-threshold is the explicit no-gate marker used by the
 *           permissive default config.
 */
export const findThresholdShortfall = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): ThresholdShortfall | null =>
  checkOne(
    "typeCoverage",
    meta.coverage.typeCoverage,
    meta.thresholds.typeCoverage,
    findMissingPropertyTypes(analysis),
  ) ??
  checkOne(
    "classifierCoverage",
    meta.coverage.classifierCoverage,
    meta.thresholds.classifierCoverage,
    [],
  ) ??
  checkOne(
    "preconditionPassRate",
    meta.coverage.preconditionPassRate,
    meta.thresholds.preconditionPassRate,
    [],
  );

const SHA_LINE_JSON = /"(generatedAtSha|sha)":\s*"[^"]*"/g;

/** Normalize SHA fields for byte-equality comparison between on-disk and regenerated sidecars. */
export const stripVolatileJson = (text: string): string =>
  text.replace(SHA_LINE_JSON, '"$1": "<NORMALIZED>"');

export { sidecarSlug };

/**
 * @spec.guarantee "regenerates the SpecArtifact and returns the pretty-printed JSON used for on-disk diff; SidecarSchemaError is a defect (artifact our own emitter produced)"
 *   reason: validate's sidecar-drift cross-check needs the byte-for-byte
 *           regenerated form.
 */
export const regenerateSidecar = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): Effect.Effect<string, never> =>
  serializeSidecar(buildSpecArtifact(analysis, meta)).pipe(
    Effect.catchTag("SidecarSchemaError", (e) =>
      Effect.die(new Error(`internal sidecar schema mismatch: ${e.issues.join("; ")}`)),
    ),
  );

