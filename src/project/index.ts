/**
 * @spec.purpose Barrel for the `project/` layer. Exposes the fully-resolved
 *   `ProjectContext` snapshot (with precomputed folder list, per-folder
 *   subfolder map, and threshold resolver), the one loader that builds it,
 *   the stable format version, and the three tagged errors the cli routes.
 *   Folder-discovery primitives, the threshold resolver, and the
 *   path normalizer are implementation details behind `ProjectContext`
 *   methods.
 */

export {
  FolderNotFoundError,
  ProjectContextError,
  loadProjectContext,
} from "@safer/project/context.js";
export type { ProjectContext, SourceFile } from "@safer/project/context.js";

export { ConfigError } from "@safer/project/config.js";
export type { Thresholds } from "@safer/project/config.js";

export { SPEC_FORMAT_VERSION } from "@safer/project/version.js";
