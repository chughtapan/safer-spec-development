/**
 * @spec.purpose `safer-spec doctor` subcommand.
 */

import { Command } from "@effect/cli";
import { Effect } from "effect";
import { doctor } from "../codemod/doctor.js";

export const doctorCommand = Command.make("doctor", {}, () =>
  doctor().pipe(
    Effect.flatMap((report) =>
      Effect.log(`doctor ${report.overall} (${report.checks.length} checks)`),
    ),
  ),
);
