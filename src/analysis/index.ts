/**
 * @spec.purpose Barrel for the `analysis/` layer. Re-exports the analysis
 *   pipeline + cross-checks + the project-source readers that commands
 *   compose. The four files in this folder cover: project-source ingestion
 *   (exports, properties), the shared analysis pipeline (pipeline.ts),
 *   and the gap-class cross-checks (checks.ts).
 */

export {
  buildSpecMeta,
  collectFolderInputs,
  findThresholdShortfall,
  inspectFolder,
  loadExecutionSidecar,
  regenerateMarkdown,
  regenerateSidecar,
  sidecarSlug,
  stripVolatileJson,
} from "@safer/analysis/pipeline.js";
export type { FolderInputs, ThresholdShortfall } from "@safer/analysis/pipeline.js";

export {
  catchDirectiveErrors,
  checkDrift,
  checkExecutionSidecarPresent,
  checkImplBodies,
  checkSidecarDrift,
  checkThresholds,
  diagnosticLines,
  failOnIssues,
  MissingImplError,
  MissingSpecPropertyError,
  MissingStubError,
  NoFoldersResolvedError,
  unresolvedFolderError,
} from "@safer/analysis/checks.js";
export type {
  ValidateDiagnostic,
  ValidateGapError,
} from "@safer/analysis/checks.js";

export {
  buildExportEntries,
  collectExports,
  indexFilePurposes,
  uniqueExternalSources,
} from "@safer/analysis/exports.js";
export type { DeclaredExport } from "@safer/analysis/exports.js";

export { extractProperties } from "@safer/analysis/properties.js";
export type { ItSpecIssue } from "@safer/analysis/properties.js";
