/**
 * @spec.purpose
 *   Resolves the required-kind set for each detected export. Consumes the
 *   kind-detector output and the static applicability matrix, applies escape
 *   hatches, and emits the per-export gap report consumed by the validate
 *   gate.
 */

import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { ApplicabilityResolutionError } from "../../errors/index.js";
import type { DetectedExport } from "../../detection/kind-detector/index.js";
import type { Kind } from "../../kernel/index.js";

export interface ResolvedExport {
  readonly export: DetectedExport;
  readonly requiredKinds: ReadonlyArray<Kind>;
  readonly skippedKinds: ReadonlyArray<{ readonly kind: Kind; readonly reason: string }>;
  readonly missingKinds: ReadonlyArray<Kind>;
  readonly overridden: boolean;
}

export const resolveExport = (
  _detected: DetectedExport,
): Effect.Effect<ResolvedExport, ApplicabilityResolutionError> =>
  Eff.die(new Error("Stage 1 stub: resolveExport not implemented"));

export { APPLICABILITY_MATRIX } from "./matrix.js";
export { isOverridden } from "./override.js";
