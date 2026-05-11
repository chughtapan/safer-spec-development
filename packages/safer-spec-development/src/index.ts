/**
 * @chughtapan/safer-spec-development — per-folder SPEC.md codemod.
 *
 * @spec.purpose
 *   Generates structured per-folder SPEC.md from TypeScript source + JSDoc
 *   directives + Effect Schema + fast-check property tests. Validates the
 *   resulting artifact against kind-coverage, classifier-coverage, and
 *   precondition-pass-rate gates.
 *
 * @spec.residual-contract none
 *   reason: Stage 0 scaffolding only; runtime behavior not yet implemented.
 */

export { SPEC_FORMAT_VERSION } from "./version.js";
export type { Kind } from "./kinds.js";
export { KINDS, isKind } from "./kinds.js";
export type { SpecArtifact, SpecExportEntry } from "./sidecar.js";
export { SpecArtifactSchema } from "./sidecar.js";
export { itSpec } from "./helper.js";
export type { ItSpec } from "./helper.js";
export type {
  GenerateOptions,
  ValidateOptions,
  InitOptions,
} from "./types.js";
