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
import { generate } from "@safer/commands/generate.js";
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

/**
 * @spec.property generate-folderless-discovers-every-index-folder
 * @spec.type Inclusion
 * @spec.exports generate
 * @spec.claim `safer-spec generate --write` (no --folder) writes a SPEC.md + sidecar to every directory under the project root that contains an index.ts barrel
 */
itSpec.todo("generate-folderless-discovers-every-index-folder", {
  type: "Inclusion",
  exports: [generate],
});

/**
 * @spec.property folder-input-canonicalized-before-stamping
 * @spec.type Constant Equality
 * @spec.exports generate
 * @spec.claim `--folder $PWD/src`, `--folder ./src/`, and `--folder src//commands` produce byte-identical SPEC.md and sidecar artifacts to their canonical cwd-relative forms
 */
itSpec.todo("folder-input-canonicalized-before-stamping", {
  type: "Constant Equality",
  exports: [generate],
});

/**
 * @spec.property root-folder-uses-root-sidecar-slug
 * @spec.type Constant Equality
 * @spec.exports generate
 * @spec.claim `--folder .` (project root) writes the sidecar to `.safer-spec/root.json`, never `.safer-spec/.json`; generate, validate, and the sidecar-writer all agree on the slug
 */
itSpec.todo("root-folder-uses-root-sidecar-slug", {
  type: "Constant Equality",
  exports: [generate],
});

/**
 * @spec.property validate-diagnostics-route-to-stderr
 * @spec.type Constant Equality
 * @spec.exports validate
 * @spec.claim `safer-spec validate` failures write the diagnostic body to stderr; stdout stays empty so success-path stdout-piping scripts aren't polluted
 */
itSpec.todo("validate-diagnostics-route-to-stderr", {
  type: "Constant Equality",
  exports: [validate],
});
