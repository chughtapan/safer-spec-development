/**
 * @chughtapan/safer-spec-development — per-folder SPEC.md codemod.
 *
 * @spec.purpose
 *   Curated library facade. Exposes the small contract every external caller
 *   needs: the two primary codemod entry points (`generate`, `validate`),
 *   the closed kinds taxonomy, the boundary decoders for sidecar and
 *   frontmatter contracts, the author-facing test helper, and the
 *   validate-mode error contract. Schema constructors, parser internals,
 *   detection helpers, pipeline-stage functions, and the four CLI-only
 *   modes (`init`, `doctor`, `migrate`, `explain`) are intentionally not
 *   re-exported — they are codemod / CLI internals and change without notice.
 *
 * @spec.residual-contract none
 *   reason: Stage 1 interface stubs only; runtime behavior lands in
 *           implement-staff (sub-issue #5).
 */

// Format version + closed kinds taxonomy + boundary decoders + helper.
export {
  SPEC_FORMAT_VERSION,
  KINDS,
  isKind,
  decodeSpecArtifact,
  decodeSpecFrontmatter,
  itSpec,
} from "./kernel/index.js";

export type {
  Kind,
  SpecArtifact,
  SpecExportEntry,
  SpecFrontmatter,
  ItSpec,
} from "./kernel/index.js";

// Codemod mode entries. Library consumers reach for `generate` and `validate`;
// CLI-only modes (init / doctor / migrate / explain) live behind the binary.
export { generate, validate, GAP_CLASS_EXIT_CODES } from "./codemod/index.js";
export type {
  GapClass,
  GapClassName,
} from "./codemod/index.js";

// Public error contract (callers Effect.catchTag the validate gate).
export { ValidateError } from "./errors/index.js";
