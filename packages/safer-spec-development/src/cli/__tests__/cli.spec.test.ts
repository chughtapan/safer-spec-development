/**
 * @spec.purpose Property stubs for the CLI surface. Exception Raising: the
 *   CLI rejects invalid flag combos with a structured `CliUsageError`. The
 *   `validate` subcommand exits with one of {0, 11, 12, 13} per the Stage 5
 *   spec Amendment 5 mapping.
 *
 *   The CLI subcommand handlers are inlined in `cli/index.ts`; properties
 *   reference the codemod `validate` mode entry as the export under test.
 */

import { itSpec } from "../../kernel/index.js";
import { validate } from "../../codemod/index.js";

itSpec.todo("cli-validate-rejects-conflicting-flags", {
  kind: "Exception Raising",
  exports: [validate],
});

itSpec.todo("cli-validate-exit-code-contract", {
  kind: "Exception Raising",
  exports: [validate],
});
