/**
 * @chughtapan/safer-spec-development — per-folder SPEC.md codemod.
 *
 * @spec.purpose
 *   Generates structured per-folder SPEC.md from TypeScript source + JSDoc
 *   directives + Effect Schema + fast-check property tests. Validates the
 *   resulting artifact against kind-coverage, classifier-coverage, and
 *   precondition-pass-rate gates. Routes coverage gaps upstream by class
 *   (MISSING_SPEC_PROPERTY / MISSING_STUB / MISSING_IMPL) per the Stage 5
 *   spec Amendment 5 mapping.
 *
 * @spec.residual-contract none
 *   reason: Stage 1 interface stubs only; runtime behavior lands in
 *           implement-staff (sub-issue #5) per the parent epic.
 */

// Format version.
export { SPEC_FORMAT_VERSION } from "./version.js";

// Kinds enum (closed; OOPSLA 2025 9-kind taxonomy).
export type { Kind } from "./kinds.js";
export { KINDS, isKind } from "./kinds.js";

// Sidecar JSON contract.
export type { SpecArtifact, SpecExportEntry } from "./sidecar.js";
export { SpecArtifactSchema } from "./sidecar.js";

// SPEC.md frontmatter contract.
export type { SpecFrontmatter } from "./frontmatter.js";
export { SpecFrontmatterSchema } from "./frontmatter.js";

// Author-facing helper.
export { itSpec } from "./helper.js";
export type { ItSpec } from "./helper.js";

// Option types.
export type {
  GenerateOptions,
  ValidateOptions,
  InitOptions,
  PropertyMeta,
} from "./types.js";

// Codemod entry points.
export { generate } from "./codemod/generate.js";
export type { GenerateInput, GenerateResult } from "./codemod/generate.js";
export { validate, GAP_CLASS_EXIT_CODES, ValidateDiagnostic } from "./codemod/validate.js";
export type {
  ValidateInput,
  ValidatePassReport,
  GapClass,
  GapClassName,
} from "./codemod/validate.js";
export { init } from "./codemod/init.js";
export type { InitInput, InitResult } from "./codemod/init.js";
export { doctor } from "./codemod/doctor.js";
export type { DoctorCheck, DoctorReport } from "./codemod/doctor.js";
export { migrate } from "./codemod/migrate.js";
export type { MigrateInput, MigrateResult } from "./codemod/migrate.js";
export { explain } from "./codemod/explain.js";
export type { ExplainInput, ExplainResult } from "./codemod/explain.js";

// JSDoc directive parser.
export {
  parseFileDirectives,
  parseFileDirectivesFromDisk,
  DIRECTIVE_BODY_MAX_CHARS,
  DIRECTIVE_NAMES,
} from "./jsdoc-parser/index.js";
export type {
  Directive,
  DirectiveLocation,
  DirectiveName,
  LocatedDirective,
} from "./jsdoc-parser/index.js";

// Kind detector.
export { detectExports, detectFolderExports } from "./kind-detector/index.js";
export type { DetectedExport, ExportShape } from "./kind-detector/index.js";

// Applicability matrix.
export { resolveExport, resolveFolder, APPLICABILITY_MATRIX } from "./applicability/index.js";
export type { ApplicabilityRow, ResolvedExport } from "./applicability/index.js";

// Link resolver.
export { resolveSymbol, resolveAll } from "./link-resolver/index.js";
export type {
  LinkOutcome,
  LinkResolution,
  ResolutionOrigin,
  UnresolvedExternal,
} from "./link-resolver/index.js";

// Section emitter.
export { emitSpec } from "./section-emitter/index.js";
export type { EmittedSpec } from "./section-emitter/index.js";

// Reporter + sidecar writer.
export { collectTestRecord, finalizeRun, serializeSidecar, writeSidecar, readSidecar } from "./reporter/index.js";
export type {
  ReporterRunRecord,
  ReporterTestRecord,
  SidecarWritePayload,
} from "./reporter/index.js";

// Tagged-error registry.
export * from "./errors/index.js";
