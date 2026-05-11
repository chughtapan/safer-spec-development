/**
 * @spec.purpose Stage 5 source-property stubs for the `validate` mode. Derived
 *   mechanically from the Stage 5 spec (sub-issue #3) `## Source properties`
 *   table. Stage 1 implement-staff fills the bodies; Stage 5 validate-gate
 *   asserts them per the Amendment 5 mapping.
 *
 *   Five properties, exact 1:1 with the Stage 5 spec table:
 *     - validate-gate-determ            (Roundtrip)
 *     - validate-emits-gap-cls          (Exception Raising)
 *     - validate-diagnostic-shape       (Typechecking)
 *     - properties-table-self-host      (Inclusion)
 *     - properties-table-self-host-bodied (Inclusion)
 */

import { itSpec } from "../../kernel/index.js";
import { formatDiagnostic, validate } from "../validate.js";

itSpec.todo("validate-gate-determ", {
  kind: "Roundtrip",
  exports: [validate],
});

itSpec.todo("validate-emits-gap-cls", {
  kind: "Exception Raising",
  exports: [validate],
});

itSpec.todo("validate-diagnostic-shape", {
  kind: "Typechecking",
  exports: [validate, formatDiagnostic],
});

itSpec.todo("properties-table-self-host", {
  kind: "Inclusion",
  exports: [validate],
});

itSpec.todo("properties-table-self-host-bodied", {
  kind: "Inclusion",
  exports: [validate],
});
