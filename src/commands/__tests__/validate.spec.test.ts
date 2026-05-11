/**
 * @specPurpose Property stubs for the `validate` command entrypoint. Validate
 *   enforces four cross-checks: JSDoc directives exist on every itSpec call,
 *   JSDoc values match runtime metadata, committed SPEC.md equals regenerated
 *   output, and every implemented property has a non-empty body.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { formatDiagnostic, validate } from "@safer/commands/validate.js";

/**
 * @specProperty validate-gate-determ
 * @specType Roundtrip
 * @specExports validate
 * @specClaim two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha
 */
itSpec.todo("validate-gate-determ", {
  type: "Roundtrip",
  exports: [validate],
});

/**
 * @specProperty validate-emits-gap-cls
 * @specType Exception Raising
 * @specExports validate
 * @specClaim every gate failure emits a typed ValidateError with gapClass in {11, 12, 13}
 */
itSpec.todo("validate-emits-gap-cls", {
  type: "Exception Raising",
  exports: [validate],
});

/**
 * @specProperty validate-diagnostic-shape
 * @specType Typechecking
 * @specExports validate, formatDiagnostic
 * @specClaim every emitted diagnostic conforms to {problem, cause, fix, docsLink}
 */
itSpec.todo("validate-diagnostic-shape", {
  type: "Typechecking",
  exports: [validate, formatDiagnostic],
});

/**
 * @specProperty properties-table-self-host
 * @specType Inclusion
 * @specExports validate
 * @specClaim the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc
 */
itSpec.todo("properties-table-self-host", {
  type: "Inclusion",
  exports: [validate],
});

/**
 * @specProperty properties-table-self-host-bodied
 * @specType Inclusion
 * @specExports validate
 * @specClaim every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body)
 */
itSpec.todo("properties-table-self-host-bodied", {
  type: "Inclusion",
  exports: [validate],
});
