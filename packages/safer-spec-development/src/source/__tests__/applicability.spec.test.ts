/**
 * @spec.purpose Property stubs for the required-kind applicability matrix and
 *   override resolution. Inclusion: every declared shape in the matrix yields
 *   a known kind set. Exception Raising on unresolved overrides.
 */

import { itSpec } from "@safer/authoring/index.js";
import { resolveExport, APPLICABILITY_MATRIX } from "@safer/source/applicability.js";

/**
 * @spec.property applicability-matrix-closed
 * @spec.kind Inclusion
 * @spec.exports APPLICABILITY_MATRIX
 * @spec.claim every ExportShape value has exactly one row in the matrix
 */
itSpec.todo("applicability-matrix-closed", {
  kind: "Inclusion",
  exports: [APPLICABILITY_MATRIX],
});

/**
 * @spec.property applicability-resolve-export-typechecks
 * @spec.kind Typechecking
 * @spec.exports resolveExport
 * @spec.claim resolveExport returns ResolvedExport with requiredKinds + skippedKinds + missingKinds covering the matrix row
 */
itSpec.todo("applicability-resolve-export-typechecks", {
  kind: "Typechecking",
  exports: [resolveExport],
});
