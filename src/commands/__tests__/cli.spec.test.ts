/**
 * @spec.purpose Property stubs for the CLI surface. Exception Raising: the
 *   CLI rejects invalid flag combos with a structured `CliUsageError`. The
 *   `validate` subcommand exits with one of {0, 11, 12, 13} according to the
 *   validate gap-class map.
 *
 *   The CLI subcommand handlers are inlined in `commands/index.ts`;
 *   properties reference the `validate` command as the export under test.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { validate } from "@safer/commands/validate.js";

/**
 * @spec.property cli-validate-rejects-conflicting-flags
 * @spec.type Exception Raising
 * @spec.exports validate
 * @spec.claim --planned and --implemented passed together fail with CliUsageError exit code 2
 */
itSpec.todo("cli-validate-rejects-conflicting-flags", {
  type: "Exception Raising",
  exports: [validate],
});

/**
 * @spec.property cli-validate-exit-code-contract
 * @spec.type Exception Raising
 * @spec.exports validate
 * @spec.claim ValidateGapError tags propagate to process.exit(N) with N in {11, 12, 13}
 */
itSpec.todo("cli-validate-exit-code-contract", {
  type: "Exception Raising",
  exports: [validate],
});
