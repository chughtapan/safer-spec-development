/**
 * @spec.purpose Per-file / per-export / per-glob escape hatches. Honors the
 *   `@spec.ignore` and `@spec.ignore-export` JSDoc directives and the
 *   `safer-spec.config.ts` ignore-globs list.
 */

import { Effect } from "effect";
import type { ApplicabilityResolutionError } from "@safer/source/applicability.js";

interface OverrideContext {
  readonly path: string;
  readonly exportName: string;
  readonly fileLevelIgnore: boolean;
  readonly exportLevelIgnoreReason: string | null;
  readonly globIgnoreMatch: boolean;
}

/**
 * @spec.guarantee "returns true iff at least one of fileLevelIgnore, exportLevelIgnoreReason (non-null), or globIgnoreMatch is set"
 *   reason: contract; the validate gate skips kind-coverage for overridden
 *           exports.
 * @spec.residual-contract none
 *   reason: pure predicate; behavior captured by signature.
 */
export const isOverridden = (
  _context: OverrideContext,
): Effect.Effect<boolean, ApplicabilityResolutionError> =>
  Effect.die(new Error("Stage 1 stub: isOverridden not implemented"));
