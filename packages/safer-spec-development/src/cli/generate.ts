/**
 * @spec.purpose `safer-spec generate [--folder X] [--write|--dry-run]
 *   [--watch]` subcommand.
 */

import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { generate } from "../codemod/generate.js";

const folderOpt = Options.text("folder").pipe(Options.optional);
const writeOpt = Options.boolean("write").pipe(Options.withDefault(false));
const dryRunOpt = Options.boolean("dry-run").pipe(Options.withDefault(false));
const watchOpt = Options.boolean("watch").pipe(Options.withDefault(false));

export const generateCommand = Command.make(
  "generate",
  { folder: folderOpt, write: writeOpt, dryRun: dryRunOpt, watch: watchOpt },
  ({ folder, write, dryRun, watch }) =>
    generate({
      folder: folder._tag === "Some" ? folder.value : null,
      write,
      dryRun,
      watch,
    }).pipe(
      Effect.flatMap((result) =>
        Effect.log(`generate touched ${result.foldersTouched.length} folders`),
      ),
    ),
);
