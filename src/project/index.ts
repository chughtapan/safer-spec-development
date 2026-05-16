/**
 * @spec.purpose Barrel for the `project/` layer. Re-exports `ProjectContext`
 *   and the loaders the analysis layer and commands depend on. Each file in
 *   this folder owns one slice of project setup (context, config, version,
 *   folders); this barrel is the single entry point downstream consumers
 *   import.
 */

export {
  loadProjectContext,
  loadValidateProjectContext,
  normalizeFolder,
  ProjectContextError,
} from "@safer/project/context.js";
export type { ProjectContext } from "@safer/project/context.js";

export {
  ConfigError,
  loadConfig,
  resolveThresholdsFor,
} from "@safer/project/config.js";
export type { Config, Thresholds } from "@safer/project/config.js";

export { SPEC_FORMAT_VERSION } from "@safer/project/version.js";

export {
  buildChildren,
  discoverFolders,
  discoverImmediateSubfolders,
} from "@safer/project/folders.js";
