/**
 * @spec.purpose `safer-spec validate [--folder X] [--planned|--implemented]
 *   [--format-version-check]` subcommand.
 *
 *   Returns exit codes 0 / 11 / 12 / 13 per the Stage 5 spec
 *   `## Amendment 5 mapping` (sub-issue #3). Catches `ValidateError` and
 *   maps its `exitCode` field to `process.exit`-style termination via
 *   `Effect.fail` with a structured payload; the runtime layer translates
 *   that to the OS exit code.
 */

import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { validate } from "../codemod/validate.js";

const folderOpt = Options.text("folder").pipe(Options.optional);
const plannedOpt = Options.boolean("planned").pipe(Options.withDefault(false));
const implementedOpt = Options.boolean("implemented").pipe(Options.withDefault(false));
const formatVersionCheckOpt = Options.boolean("format-version-check").pipe(
  Options.withDefault(false),
);

export const validateCommand = Command.make(
  "validate",
  {
    folder: folderOpt,
    planned: plannedOpt,
    implemented: implementedOpt,
    formatVersionCheck: formatVersionCheckOpt,
  },
  ({ folder, planned, implemented, formatVersionCheck }) => {
    const mode: "planned" | "implemented" = planned && !implemented ? "planned" : "implemented";
    return validate({
      folder: folder._tag === "Some" ? folder.value : null,
      mode,
      formatVersionCheck,
    }).pipe(
      Effect.flatMap((report) =>
        report._tag === "pass"
          ? Effect.log(`validate passed across ${report.foldersValidated.length} folders`)
          : Effect.log(
              `validate failed (exit ${report.exitCode}, ${report.gapClass}): ${report.diagnostic.problem}`,
            ),
      ),
    );
  },
);
