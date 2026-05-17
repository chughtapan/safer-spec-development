/**
 * @spec.purpose Public barrel for `spec/artifact/`. Exposes the abstraction
 *   level downstream layers consume — `buildSpecArtifact`/`emitMarkdown`
 *   to construct the artifact, `buildSpecMeta`/`findThresholdShortfall`
 *   for coverage analysis, `regenerateSidecar`/`loadExecutionSidecar`/
 *   `computeTestTreeHash` for sidecar I/O, and `sidecarSlug` for path
 *   construction. The lower codecs (`serializeSidecar`,
 *   `decodeExecutionSidecar`, `hashTestTree`, `computeTypeCoverage`,
 *   `findMissingPropertyTypes`) are implementation details consumed only
 *   by the wrappers above.
 *
 *   Intentional non-exports:
 *   - `SaferSpecExecutionReporter`: the Vitest reporter class. Exposed
 *     via the `./reporter` package subpath so the barrel isn't pulled
 *     in by CLI consumers.
 *   - `decodeSpecFrontmatter`/`decodeSpecArtifact`: internal helpers used
 *     by sidecar-writer's roundtrip property only.
 *   - `escapeFor*` / `relativeToFolder` / `SidecarWriteError` / `writeSidecar`:
 *     internal to artifact, callers use the higher-level wrappers.
 */

export {
  buildSpecArtifact,
  emitMarkdown,
} from "@safer/spec/artifact/emit.js";
export type {
  ExportEntry,
  ExportKind,
  FolderAnalysis,
  PropertyRow,
  SpecMeta,
} from "@safer/spec/artifact/emit.js";

export { regenerateSidecar, sidecarSlug } from "@safer/spec/artifact/sidecar-writer.js";

export {
  computeTestTreeHash,
  loadBranchCoverage,
  loadExecutionSidecar,
} from "@safer/spec/artifact/reporter.js";

export {
  buildSpecMeta,
  findThresholdShortfall,
} from "@safer/spec/artifact/coverage.js";
export type { ThresholdShortfall } from "@safer/spec/artifact/coverage.js";
