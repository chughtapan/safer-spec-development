/**
 * @spec.purpose
 *   `@chughtapan/safer-spec-development` library facade. Exposes the small
 *   contract every external caller needs:
 *     - the kinds taxonomy (`Kind` type + `KINDS` array),
 *     - the author-facing test helper (`itSpec`),
 *     - the boundary decoders for sidecar + frontmatter contracts,
 *     - the two primary codemod entry points (`generate`, `validate`) +
 *       their typed error contract.
 *
 *   Schema constructors, parser internals, detection helpers, pipeline-stage
 *   functions, and the four CLI-only modes (`init`, `doctor`, `migrate`,
 *   `explain`) are intentionally NOT re-exported — they are codemod / CLI
 *   internals and change without notice.
 *
 *   Per DESIGN.md "Section Population Rules" (lines 213-228), this barrel
 *   carries `@spec.purpose` only; per-export `@spec.assume` /
 *   `@spec.guarantee` / `@spec.residual-contract` directives live on each
 *   re-exported declaration in its source module (kinds/, authoring/,
 *   spec/, sidecar/, modes/).
 */

// Kinds taxonomy (terminal domain).
export type { Kind } from "@safer/kinds/index.js";
export { KINDS } from "@safer/kinds/index.js";

// Author-facing test helper (terminal domain).
export { itSpec, type ItSpec } from "@safer/authoring/index.js";

// Sidecar contract + boundary decoder (sidecar domain).
export type { SpecArtifact, SpecExportEntry } from "@safer/sidecar/schema.js";
export { decodeSpecArtifact } from "@safer/sidecar/schema.js";

// Frontmatter contract + boundary decoder (spec domain).
export type { SpecFrontmatter } from "@safer/spec/frontmatter.js";
export { decodeSpecFrontmatter } from "@safer/spec/frontmatter.js";

// Primary codemod modes (modes domain).
export { generate, GenerateError } from "@safer/modes/generate.js";
export {
  GAP_CLASS_EXIT_CODES,
  validate,
  ValidateError,
  type GapClass,
  type GapClassName,
} from "@safer/modes/validate.js";
