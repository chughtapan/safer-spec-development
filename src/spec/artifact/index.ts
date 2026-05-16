/**
 * @spec.purpose Public barrel for `spec/artifact/`. Re-exports the external
 *   surface — what other layers (analysis, commands) reach for, not what
 *   the folder uses internally. The parsers `decodeSpecFrontmatter` and
 *   `decodeSpecArtifact` are deliberately NOT re-exported: they exist for
 *   their own roundtrip tests + `sidecar-writer.ts`'s same-folder
 *   roundtrip assertion. `decodeExecutionSidecar` IS exposed because
 *   `analysis/pipeline.ts` parses execution sidecars during the
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

export {
  escapeForJson,
  escapeForMarkdown,
  escapeForMarkdownProse,
  escapeForYaml,
} from "@safer/spec/artifact/escape.js";

export type { SpecFrontmatter } from "@safer/spec/artifact/frontmatter.js";

export { relativeToFolder } from "@safer/spec/artifact/link-resolver.js";

export { SidecarSchemaError } from "@safer/spec/artifact/sidecar.js";
export type { SpecArtifact } from "@safer/spec/artifact/sidecar.js";

export {
  serializeSidecar,
  SidecarWriteError,
  sidecarSlug,
  writeSidecar,
} from "@safer/spec/artifact/sidecar-writer.js";

export {
  decodeExecutionSidecar,
  hashTestTree,
  SaferSpecExecutionReporter,
} from "@safer/spec/artifact/reporter.js";
export type { ExecutionSidecar } from "@safer/spec/artifact/reporter.js";
