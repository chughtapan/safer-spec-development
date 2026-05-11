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
import { serializeSidecar } from "@safer/spec/sidecar-writer.js";
import {
  buildExportEntries,
  collectExports,
  findPurpose,
} from "@safer/spec/source-exports.js";
import { extractProperties, type ItSpecIssue } from "@safer/spec/todos.js";
import type { ProjectContext } from "@safer/commands/project-context.js";

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

interface TestParseResult {
  readonly rows: ReadonlyArray<PropertyRow>;
  readonly issues: ReadonlyArray<ItSpecIssue>;
}

const parseTests = (
  fs: FileSystem.FileSystem,
  tests: ReadonlyArray<string>,
): Effect.Effect<TestParseResult, DirectiveParseError> =>
  Effect.gen(function* () {
    const rows: PropertyRow[] = [];
    const issues: ItSpecIssue[] = [];
    for (const p of tests) {
      const src = yield* readSource(fs, p);
      const parsed = yield* parseFileDirectives(p, src);
      const r = extractProperties(p, src, parsed);
      rows.push(...r.rows);
      issues.push(...r.issues);
    }
    return { rows, issues };
  });

export interface FolderInspection {
  readonly analysis: FolderAnalysis;
  readonly issues: ReadonlyArray<ItSpecIssue>;
}

/**
 * @spec.guarantee "produces the same FolderAnalysis shape `generate` emits + the per-test issues list; regenerate-and-compare on `analysis` is byte-deterministic"
 *   reason: roundtrip contract; validate's drift check relies on it.
 */
export const inspectFolder = (
  fs: FileSystem.FileSystem,
  folder: string,
  inputs: FolderInputs,
  ctx: ProjectContext,
): Effect.Effect<FolderInspection, DirectiveParseError> =>
  Effect.gen(function* () {
    const directives = yield* parseSources(fs, inputs.sources);
    const indexFile = ctx.sources.find((s) => s.path === inputs.indexFilePath);
    const indexSrc = indexFile?.source ?? (yield* readSource(fs, inputs.indexFilePath));
    const declarations = collectExports(inputs.indexFilePath, indexSrc, {
      siblings: ctx.sources,
      paths: ctx.paths,
    });
    const tests = yield* parseTests(fs, inputs.tests);
    return {
      analysis: {
        folder,
        purpose: findPurpose(directives, inputs.indexFilePath),
        exports: buildExportEntries(declarations, directives),
        properties: tests.rows,
        sourceFiles: inputs.sources,
        testFiles: inputs.tests,
      },
      issues: tests.issues,
    };
  }).pipe(Effect.withSpan("commands/validate-pipeline/inspectFolder"));


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
    typeCoverage: computeTypeCoverage(analysis),
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

/** Slug for the per-folder sidecar JSON path: `<folder>/.safer-spec/<slug>.json`. */
export const sidecarSlug = (folder: string): string =>
  folder.replace(/^\.\//, "").replace(/\//g, "_");

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
