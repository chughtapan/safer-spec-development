/**
 * @spec.purpose
 *   Resolves the required-kind set for each detected export. Consumes the
 *   shape-detector output and the static applicability matrix, applies escape
 *   hatches, and emits the per-export gap report consumed by the validate
 *   gate.
 *
 *   Tagged error `ApplicabilityResolutionError` is co-located here.
 */

import { Data, Effect } from "effect";
import type { DetectedExport } from "@safer/source/shape-detector.js";
import type { PropertyType } from "@safer/property-types/index.js";

export class ApplicabilityResolutionError extends Data.TaggedError(
  "ApplicabilityResolutionError",
)<{
  readonly exportName: string;
  readonly shape: string;
  readonly reason: string;
}> {}

export interface ResolvedExport {
  readonly export: DetectedExport;
  readonly requiredPropertyTypes: ReadonlyArray<PropertyType>;
  readonly skippedPropertyTypes: ReadonlyArray<{ readonly kind: PropertyType; readonly reason: string }>;
  readonly missingPropertyTypes: ReadonlyArray<PropertyType>;
  readonly overridden: boolean;
}

/**
 * @spec.guarantee "every kind in `requiredPropertyTypes` is from the closed `Kind` enum; the union of `requiredPropertyTypes | skippedPropertyTypes | missingPropertyTypes` covers the matrix row for the export's shape"
 *   reason: contract relied on by the validate gate's coverage check.
 * @spec.residual-contract "escape hatches (`@spec.skip`, `@spec.ignore-export`) are honored only with reason text; reason text is preserved in `skippedPropertyTypes[].reason`"
 *   reason: behavioral residue beyond ResolvedExport's structural shape.
 */
export const resolveExport = (
  _detected: DetectedExport,
): Effect.Effect<ResolvedExport, ApplicabilityResolutionError> =>
  Effect.die(new Error("Not implemented: resolveExport"));

export { APPLICABILITY_MATRIX } from "@safer/property-types/index.js";
