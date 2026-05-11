/**
 * @spec.purpose Property stubs for the required-kind applicability matrix and
 *   override resolution. Inclusion: every declared shape in the matrix yields
 *   the right required kind set per the design doc table.
 */

import { itSpec } from "../../../kernel/index.js";
import { APPLICABILITY_MATRIX, isOverridden, resolveExport } from "../index.js";

itSpec.todo("applicability-matrix-inclusion", {
  kind: "Inclusion",
  exports: [APPLICABILITY_MATRIX, resolveExport],
});

itSpec.todo("applicability-override-skips", {
  kind: "Exception Raising",
  exports: [isOverridden],
});
