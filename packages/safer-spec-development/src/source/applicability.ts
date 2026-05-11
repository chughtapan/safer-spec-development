/**
 * @spec.purpose
 *   Resolves the required-kind set for each detected export. Consumes the
 *   kind-detector output and the static applicability matrix, applies escape
 *   hatches, and emits the per-export gap report consumed by the validate
 *   gate.
 *
 *   Tagged error `ApplicabilityResolutionError` is co-located here.
 */

import { Data, Effect } from "effect";
import type { DetectedExport } from "@safer/source/kind-detector.js";
import type { Kind } from "@safer/kinds/index.js";

export class ApplicabilityResolutionError extends Data.TaggedError(
  "ApplicabilityResolutionError",
)<{
  readonly exportName: string;
  readonly shape: string;
  readonly reason: string;
}> {}

export interface ResolvedExport {
  readonly export: DetectedExport;
  readonly requiredKinds: ReadonlyArray<Kind>;
  readonly skippedKinds: ReadonlyArray<{ readonly kind: Kind; readonly reason: string }>;
  readonly missingKinds: ReadonlyArray<Kind>;
  readonly overridden: boolean;
}

/**
 * @spec.guarantee "every kind in `requiredKinds` is from the closed `Kind` enum; the union of `requiredKinds | skippedKinds | missingKinds` covers the matrix row for the export's shape"
 *   reason: contract relied on by the validate gate's coverage check.
 * @spec.residual-contract "escape hatches (`@spec.skip`, `@spec.ignore-export`) are honored only with reason text; reason text is preserved in `skippedKinds[].reason`"
 *   reason: behavioral residue beyond ResolvedExport's structural shape.
 */
export const resolveExport = (
  _detected: DetectedExport,
): Effect.Effect<ResolvedExport, ApplicabilityResolutionError> =>
  Effect.die(new Error("Stage 1 stub: resolveExport not implemented"));

export { APPLICABILITY_MATRIX } from "@safer/source/applicability-matrix.js";
export { isOverridden } from "@safer/source/applicability-override.js";
