// @agent-code-guard/architecture-exception: no-inventory-barrel
// reason: the codemod folder's semantic contract IS the six mode entries
// (generate, validate, init, doctor, migrate, explain); re-exporting all
// sibling modules through one facade is the contract, not inventory drift.
// The individual files are mode entries by design, not internal features.
/**
 * @spec.purpose Codemod modes facade. Re-exports the six mode entry points so
 *   downstream consumers (CLI, library facade) reach them through one
 *   `codemod` import instead of six file-level imports.
 */

export { generate } from "./generate.js";
export {
  GAP_CLASS_EXIT_CODES,
  formatDiagnostic,
  validate,
} from "./validate.js";
export type { GapClass, GapClassName } from "./validate.js";
export { init } from "./init.js";
export { doctor } from "./doctor.js";
export { migrate } from "./migrate.js";
export { explain } from "./explain.js";
