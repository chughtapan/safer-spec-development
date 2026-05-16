/**
 * @spec.purpose Public barrel for `spec/artifact/`. Re-exports the external
 *   surface — what other layers (analysis, commands) reach for, not what
 *   the folder uses internally.
 *
 *   Intentional non-exports:
 *   - `decodeSpecFrontmatter` and `decodeSpecArtifact`: internal helpers
 *     for their own roundtrip tests + `sidecar-writer.ts`'s same-folder
 *     roundtrip assertion. Reached via direct file path.
 *   - `SaferSpecExecutionReporter`: the Vitest reporter class. Exposed
 *     via the `./reporter` package subpath so the barrel isn't pulled
 *     in by CLI consumers.
 *   - `escapeFor*` / `relativeToFolder` / `SidecarWriteError` / `writeSidecar`
 *     / `SidecarSchemaError` (as a class): used inside the artifact
 *     folder only. Catch via tag string (`Effect.catchTag("SidecarSchemaError", ...)`),
 *     no class import needed.
 *
 *   `decodeExecutionSidecar` and `hashTestTree` are vitest-free and
 *   exposed because `analysis/` reads execution sidecars during the
 *   `--implemented` freshness check.
 */

export {
  buildSpecArtifact,
  computeTypeCoverage,
  emitMarkdown,
  findMissingPropertyTypes,
} from "@safer/spec/artifact/emit.js";
export type {
  ExportEntry,
  ExportKind,
  FolderAnalysis,
  PropertyRow,
  SpecMeta,
} from "@safer/spec/artifact/emit.js";

export type { SpecArtifact } from "@safer/spec/artifact/sidecar.js";

export { serializeSidecar, sidecarSlug } from "@safer/spec/artifact/sidecar-writer.js";

export {
  decodeExecutionSidecar,
  hashTestTree,
} from "@safer/spec/artifact/reporter.js";
export type { ExecutionSidecar } from "@safer/spec/artifact/reporter.js";
