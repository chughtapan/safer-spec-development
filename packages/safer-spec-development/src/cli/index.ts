#!/usr/bin/env node
/**
 * @spec.purpose CLI entry. Composes the six subcommands (`init`, `generate`,
 *   `validate`, `doctor`, `explain`, `migrate`) into the top-level
 *   `safer-spec` Command. Each subcommand lives in its own file; this barrel
 *   only composes.
 *
 *   Bodies are Stage 1 stubs: each subcommand fails with `Effect.die` until
 *   the implementer fills the codemod functions.
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
Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
);
