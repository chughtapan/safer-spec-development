/**
 * @spec.purpose Property stubs for the CLI surface. Exception Raising: the
 *   CLI rejects invalid flag combos with a structured `CliUsageError`. The
 *   `validate` subcommand exits with one of {0, 11, 12, 13} per the Stage 5
 *   spec Amendment 5 mapping.
 */

import { itSpec } from "../../helper.js";
import { validateCommand } from "../validate.js";

itSpec.todo("cli-validate-rejects-conflicting-flags", {
  kind: "Exception Raising",
  exports: [validateCommand],
});

itSpec.todo("cli-validate-exit-code-contract", {
  kind: "Exception Raising",
  exports: [validateCommand],
});
