#!/usr/bin/env node
/**
 * @spec.purpose CLI entry. Dispatches to: init, generate, validate, doctor,
 *   explain, migrate.
 *
 * Stage 0 — Effect-native stub. The single `safer-spec` Command dies with a
 * tagged `NotImplemented` defect; Stage 1 introduces the subcommand tree.
 */

import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Data, Effect } from "effect";

class NotImplemented extends Data.TaggedError("NotImplemented")<{
  readonly stage: string;
}> {}

const command = Command.make("safer-spec", {}, () =>
  Effect.die(new NotImplemented({ stage: "Stage 0 scaffold" })),
);

const cli = Command.run(command, {
  name: "safer-spec",
  version: "0.0.0",
});

// eslint-disable-next-line agent-code-guard/prefer-effect-platform -- @effect/cli's Command.run consumes argv at the bootstrap entrypoint; no Effect-native source exists before the runtime starts
Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
);
