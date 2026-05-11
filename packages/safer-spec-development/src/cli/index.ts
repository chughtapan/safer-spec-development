#!/usr/bin/env node
/**
 * @spec.purpose CLI entry. Composes the six subcommands (`init`, `generate`,
 *   `validate`, `doctor`, `explain`, `migrate`) into the top-level
 *   `safer-spec` Command, then translates the `CliExitCode` tagged failure
 *   into `process.exit(N)` at the runtime boundary.
 *
 *   Exit-code mapping at this boundary:
 *     - `CliExitCode({ code })` → `process.exit(code)`.
 *     - any other defect / failure → `NodeRuntime.runMain` default (non-zero).
 *
 *   Bodies of subcommand handlers are Stage 1 stubs; Stage 1 implement-staff
 *   fills the codemod functions.
 */

import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { initCommand } from "./init.js";
import { generateCommand } from "./generate.js";
import { validateCommand } from "./validate.js";
import { doctorCommand } from "./doctor.js";
import { explainCommand } from "./explain.js";
import { migrateCommand } from "./migrate.js";
import { SPEC_FORMAT_VERSION } from "../version.js";

const root = Command.make("safer-spec", {}, () =>
  Effect.log("safer-spec — per-folder SPEC.md codemod. Pass --help."),
);

const command = root.pipe(
  Command.withSubcommands([
    initCommand,
    generateCommand,
    validateCommand,
    doctorCommand,
    explainCommand,
    migrateCommand,
  ]),
);

const cli = Command.run(command, {
  name: "safer-spec",
  version: SPEC_FORMAT_VERSION,
});

// eslint-disable-next-line agent-code-guard/prefer-effect-platform -- @effect/cli's Command.run consumes argv at the bootstrap entrypoint; no Effect-native source exists before the runtime starts
Effect.suspend(() => cli(process.argv))
  .pipe(
    Effect.catchTag("CliExitCode", (e) =>
      Effect.sync(() => {
        process.exit(e.code);
      }),
    ),
    Effect.provide(NodeContext.layer),
  )
  .pipe(NodeRuntime.runMain);
