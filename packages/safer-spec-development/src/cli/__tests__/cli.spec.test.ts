/**
 * @spec.purpose Property stubs for the CLI surface. Exception Raising: the
 *   CLI rejects invalid flag combos with a structured `CliUsageError`. The
 *   `validate` subcommand exits with one of {0, 11, 12, 13} per the Stage 5
 *   spec Amendment 5 mapping.
 *
 *   The CLI subcommand handlers are inlined in `cli/index.ts`; properties
 *   reference the codemod `validate` mode entry as the export under test.
 */

import { itSpec } from "@safer/authoring/index.js";
import { validate } from "@safer/modes/validate.js";

/**
 * @spec.property cli-validate-rejects-conflicting-flags
 * @spec.kind Exception Raising
 * @spec.exports validate
 * @spec.claim --planned and --implemented passed together fail with CliUsageError exit code 2
 */
itSpec.todo("cli-validate-rejects-conflicting-flags", {
  kind: "Exception Raising",
  exports: [validate],
});

/**
 * @spec.property cli-validate-exit-code-contract
 * @spec.kind Exception Raising
 * @spec.exports validate
 * @spec.claim ValidateError.gapClass propagates to process.exit(N) with N in {11, 12, 13}
 */
itSpec.todo("cli-validate-exit-code-contract", {
  kind: "Exception Raising",
  exports: [validate],
});
