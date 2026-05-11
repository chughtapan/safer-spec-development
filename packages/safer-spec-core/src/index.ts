/**
 * @chughtapan/safer-spec-core — shared types + Effect Schema definitions.
 *
 * @spec.purpose
 *   Single source of truth for the kinds enum, directive grammar, JSON sidecar
 *   schema, and format-version constant. Consumed by the codemod, the lint
 *   rules, and any external tool that integrates with safer-spec.
 */

export { SPEC_FORMAT_VERSION } from "./version.js";
export type { Kind } from "./kinds.js";
export { KINDS, isKind } from "./kinds.js";
export type { SpecArtifact, SpecExportEntry } from "./sidecar.js";
export { SpecArtifactSchema } from "./sidecar.js";
