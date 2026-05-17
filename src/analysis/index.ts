/**
 * @spec.purpose Barrel for the `analysis/` layer. Exposes two high-level
 *   per-folder operations — `generateFolder` and `validateFolder` — plus
 *   the `collectFolderInputs` enumeration helper commands use to loop
 *   over discovered folders. Pipeline primitives (`buildSpecMeta`,
 *   `regenerateMarkdown`, `regenerateSidecar`, individual gap-checks,
 *   directive parsers, etc.) stay internal to this folder; commands at
 *   `commands/{generate,validate}.ts` compose only the two high-level
 *   functions, not the underlying machinery.
 *
 *   `diagnosticLines` and `unresolvedFolderError` are exposed because the
 *   cli renders gap-class errors itself (string formatting + the
 *   no-folders-resolved guard for `--folder X` typos).
 *
 *   `buildKnownExports` is the project-level setup the generate command
 *   computes once before looping over folders; calling it inside
 *   `generateFolder` would re-scan every project source on every folder.
 */

export {
  buildKnownExports,
  computeProjectNewestMtime,
  generateFolder,
  validateFolder,
  GenerateFolderError,
  GenerateFolderIOError,
} from "@safer/analysis/orchestrate.js";
export type { GenerateFolderAnyError } from "@safer/analysis/orchestrate.js";

export { diagnosticLines } from "@safer/analysis/checks.js";
export type { ValidateGapError } from "@safer/analysis/checks.js";
