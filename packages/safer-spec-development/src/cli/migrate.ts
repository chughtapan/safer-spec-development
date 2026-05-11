/**
 * @spec.purpose `safer-spec migrate` subcommand.
 */

import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { migrate } from "../codemod/migrate.js";
import { SPEC_FORMAT_VERSION } from "../version.js";

const fromOpt = Options.text("from").pipe(Options.withDefault(SPEC_FORMAT_VERSION));
const toOpt = Options.text("to").pipe(Options.withDefault(SPEC_FORMAT_VERSION));
const dryRunOpt = Options.boolean("dry-run").pipe(Options.withDefault(true));

export const migrateCommand = Command.make(
  "migrate",
  { from: fromOpt, to: toOpt, dryRun: dryRunOpt },
  ({ from, to, dryRun }) =>
    migrate({ fromVersion: from, toVersion: to, dryRun }).pipe(
      Effect.flatMap((result) =>
        Effect.log(
          `migrate ${result.fromVersion} → ${result.toVersion} (${result.filesUpdated.length} files)`,
        ),
      ),
    ),
);
