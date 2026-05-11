// @agent-code-guard/architecture-exception: no-inventory-barrel
// reason: the kernel folder IS the shared kernel by design — its semantic
// contract is "everything every layer reaches for"; re-exporting all sibling
// modules through one facade is the contract, not inventory drift. The
// individual files (kinds, types, version, sidecar, frontmatter, helper) are
// not standalone features; they are the kernel's named compartments.
/**
 * @spec.purpose Kernel facade. Re-exports the shared vocabulary every layer
 *   reaches for: format version, closed kind taxonomy, sidecar/frontmatter
 *   contract types and decode boundaries, public option types, and the
 *   author-facing test helper. Schema constructors stay private to their
 *   owning files (sidecar.ts, frontmatter.ts).
 */

export { SPEC_FORMAT_VERSION } from "./version.js";

export type { Kind } from "./kinds.js";
export { KINDS, isKind } from "./kinds.js";

export type { SpecArtifact, SpecExportEntry } from "./sidecar.js";
export { decodeSpecArtifact } from "./sidecar.js";

export type { SpecFrontmatter } from "./frontmatter.js";
export { decodeSpecFrontmatter } from "./frontmatter.js";

export { itSpec } from "./helper.js";
export type { ItSpec } from "./helper.js";
