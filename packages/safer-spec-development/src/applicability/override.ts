/**
 * @spec.purpose Per-file / per-export / per-glob escape hatches. Honors the
 *   `@spec.ignore` and `@spec.ignore-export` JSDoc directives and the
 *   `safer-spec.config.ts` ignore-globs list.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { ApplicabilityResolutionError } from "../errors/index.js";

export interface OverrideContext {
  readonly path: string;
  readonly exportName: string;
  readonly fileLevelIgnore: boolean;
  readonly exportLevelIgnoreReason: string | null;
  readonly globIgnoreMatch: boolean;
}

export const isOverridden = (
  _context: OverrideContext,
): Effect.Effect<boolean, ApplicabilityResolutionError> =>
  Eff.die(new Error("Stage 1 stub: isOverridden not implemented"));
