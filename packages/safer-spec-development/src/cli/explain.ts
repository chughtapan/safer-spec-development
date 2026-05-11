/**
 * @spec.purpose `safer-spec explain <error-code>` subcommand.
 */

import { Args, Command } from "@effect/cli";
import { Effect } from "effect";
import { explain } from "../codemod/explain.js";

const errorCodeArg = Args.text({ name: "error-code" });

export const explainCommand = Command.make("explain", { errorCode: errorCodeArg }, ({ errorCode }) =>
  explain({ errorCode }).pipe(Effect.flatMap((result) => Effect.log(result.entry))),
);
