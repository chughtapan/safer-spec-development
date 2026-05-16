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
  inspectFolder,
  loadExecutionSidecar,
  regenerateMarkdown,
  regenerateSidecar,
  sidecarSlug,
} from "@safer/analysis/pipeline.js";
export type { FolderInputs } from "@safer/analysis/pipeline.js";

export {
  catchDirectiveErrors,
  checkDrift,
  checkExecutionSidecarPresent,
  checkImplBodies,
  checkSidecarDrift,
  checkThresholds,
  diagnosticLines,
  failOnIssues,
  unresolvedFolderError,
} from "@safer/analysis/checks.js";
export type { ValidateGapError } from "@safer/analysis/checks.js";

export {
  buildExportEntries,
  collectExports,
  indexFilePurposes,
  uniqueExternalSources,
} from "@safer/analysis/exports.js";
export type {
  BuildExportEntriesResult,
  DeclaredExport,
} from "@safer/analysis/exports.js";

export { extractProperties } from "@safer/analysis/properties.js";
