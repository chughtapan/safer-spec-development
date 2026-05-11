/**
 * @spec.purpose Property stubs for the `validate` mode entrypoint. Validate
 *   enforces four cross-checks: JSDoc directives exist on every itSpec call,
 *   JSDoc values match runtime metadata, committed SPEC.md equals regenerated
 *   output, and every implemented property has a non-empty body.
 */

import { itSpec } from "@safer/authoring/index.js";
import { formatDiagnostic, validate } from "@safer/modes/validate.js";

/**
 * @spec.property validate-gate-determ
 * @spec.kind Roundtrip
 * @spec.exports validate
 * @spec.claim two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha
 */
itSpec.todo("validate-gate-determ", {
  kind: "Roundtrip",
  exports: [validate],
});

/**
 * @spec.property validate-emits-gap-cls
 * @spec.kind Exception Raising
 * @spec.exports validate
 * @spec.claim every gate failure emits a typed ValidateError with gapClass in {11, 12, 13}
 */
itSpec.todo("validate-emits-gap-cls", {
  kind: "Exception Raising",
  exports: [validate],
});

/**
 * @spec.property validate-diagnostic-shape
 * @spec.kind Typechecking
 * @spec.exports validate, formatDiagnostic
 * @spec.claim every emitted diagnostic conforms to {problem, cause, fix, docsLink}
 */
itSpec.todo("validate-diagnostic-shape", {
  kind: "Typechecking",
  exports: [validate, formatDiagnostic],
});

/**
 * @spec.property properties-table-self-host
 * @spec.kind Inclusion
 * @spec.exports validate
 * @spec.claim the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc
 */
itSpec.todo("properties-table-self-host", {
  kind: "Inclusion",
  exports: [validate],
});

/**
 * @spec.property properties-table-self-host-bodied
 * @spec.kind Inclusion
 * @spec.exports validate
 * @spec.claim every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body)
 */
itSpec.todo("properties-table-self-host-bodied", {
  kind: "Inclusion",
  exports: [validate],
});
