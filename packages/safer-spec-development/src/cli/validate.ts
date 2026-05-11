/**
 * @spec.purpose `safer-spec validate [--folder X] [--planned|--implemented]
 *   [--format-version-check]` subcommand.
 *
 *   Translates `ValidateError.gapClass` (11 / 12 / 13) into a `CliExitCode`
 *   tagged failure that the `cli/index.ts` boundary maps to `process.exit(N)`.
 *   The `--planned --implemented` combo is rejected structurally with
 *   `CliUsageError` (exit code 2, POSIX usage convention).
 */

import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { validate, formatDiagnostic, GAP_CLASS_EXIT_CODES } from "../codemod/validate.js";
import type { ValidateError } from "../errors/index.js";
import { CliExitCode, CliUsageError } from "../errors/index.js";

const folderOpt = Options.text("folder").pipe(Options.optional);
const plannedOpt = Options.boolean("planned").pipe(Options.withDefault(false));
const implementedOpt = Options.boolean("implemented").pipe(Options.withDefault(false));
const formatVersionCheckOpt = Options.boolean("format-version-check").pipe(
  Options.withDefault(false),
);

export const CLI_USAGE_EXIT_CODE = 2 as const;

const handleValidateFailure = (e: ValidateError): Effect.Effect<never, CliExitCode> =>
  Effect.gen(function* () {
    const formatted = yield* formatDiagnostic(e.gapClass, e.diagnostic);
    yield* Effect.logError(formatted);
    return yield* Effect.fail(new CliExitCode({ code: e.gapClass }));
  });

const handleUsageError = (e: CliUsageError): Effect.Effect<never, CliExitCode> =>
  Effect.logError(`usage error in ${e.subcommand}: ${e.reason}`).pipe(
    Effect.zipRight(Effect.fail(new CliExitCode({ code: CLI_USAGE_EXIT_CODE }))),
  );

export const validateCommand = Command.make(
  "validate",
  {
    folder: folderOpt,
    planned: plannedOpt,
    implemented: implementedOpt,
    formatVersionCheck: formatVersionCheckOpt,
  },
  ({ folder, planned, implemented, formatVersionCheck }) =>
    Effect.gen(function* () {
      if (planned && implemented) {
        return yield* Effect.fail(
          new CliUsageError({
            subcommand: "validate",
            reason: "--planned and --implemented are mutually exclusive",
          }),
        );
      }
      const mode: "planned" | "implemented" = planned ? "planned" : "implemented";
      const report = yield* validate({
        folder: folder._tag === "Some" ? folder.value : null,
        mode,
        formatVersionCheck,
      });
      yield* Effect.log(`validate passed across ${report.foldersValidated.length} folders`);
      return report;
    }).pipe(
      Effect.catchTag("ValidateError", handleValidateFailure),
      Effect.catchTag("CliUsageError", handleUsageError),
      Effect.withSpan("validateCommand"),
    ),
);

export { GAP_CLASS_EXIT_CODES };
