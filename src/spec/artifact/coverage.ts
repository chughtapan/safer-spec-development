/**
 * @spec.purpose Coverage-tier helpers — `buildSpecMeta` composes the
 *   `SpecMeta` consumed by `emitMarkdown` and `buildSpecArtifact`;
 *   `findThresholdShortfall` returns the first below-threshold metric
 *   for validate's gate. Both fold in `computeTypeCoverage` and
 *   `findMissingPropertyTypes` from `emit.ts` so consumers don't have
 *   to assemble the pieces themselves.
 *
 *   Internal-only callers of `computeTypeCoverage` and
 *   `findMissingPropertyTypes` live here; the analysis layer composes
 *   `buildSpecMeta` and `findThresholdShortfall`, never the lower
 *   primitives.
 */

import {
  computeTypeCoverage,
  findMissingPropertyTypes,
  type FolderAnalysis,
  type SpecMeta,
} from "@safer/spec/artifact/emit.js";
import type { ExecutionSidecar } from "@safer/spec/artifact/reporter.js";
import type { Thresholds } from "@safer/project/index.js";

export interface BuildSpecMetaArgs {
  readonly generatedAtSha: string;
  readonly thresholds: Thresholds;
  readonly execution?: ExecutionSidecar | null;
}

const DEFAULT_GENERATED_FROM = {
  jsdoc: "ts-morph + @microsoft/tsdoc",
  exports: "ts-morph getExportedDeclarations",
  schemas: [],
  properties: ["fast-check"],
  eslint: "eslint-plugin-agent-code-guard",
} as const;

/**
 * @spec.guarantee "builds a `SpecMeta` from analysis-derived type coverage + run-level args (generatedAtSha, thresholds); populates classifierCoverage/preconditionPassRate/branchCoverageFromSpecTests from `execution` when present"
 *   reason: emit's frontmatter + sidecar both require meta; `--implemented`
 *           mode merges Vitest reporter stats into the gate inputs.
 * @spec.residual-contract "branchCoverageFromSpecTests stays null until a v8 coverage hook is wired up (follow-up slice)"
 *   reason: lifecycle contract.
 */
export const buildSpecMeta = (
  analysis: FolderAnalysis,
  args: BuildSpecMetaArgs,
): SpecMeta => ({
  generatedAtSha: args.generatedAtSha,
  coverage: {
    typeCoverage: computeTypeCoverage(analysis),
    classifierCoverage: args.execution?.classifierCoverage ?? null,
    preconditionPassRate: args.execution?.preconditionPassRate ?? null,
    branchCoverageFromSpecTests: args.execution?.branchCoverageFromSpecTests ?? null,
  },
  thresholds: args.thresholds,
  generatedFrom: DEFAULT_GENERATED_FROM,
});

export interface ThresholdShortfall {
  readonly metric: "typeCoverage" | "preconditionPassRate";
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
 * @spec.guarantee "returns the first observed-below-threshold metric (typeCoverage to precondition order) or null when all gates pass"
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
    "preconditionPassRate",
    meta.coverage.preconditionPassRate,
    meta.thresholds.preconditionPassRate,
    [],
  );
