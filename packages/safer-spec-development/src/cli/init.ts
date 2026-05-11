/**
 * @spec.purpose `safer-spec init [folder]` subcommand. Wires the `init`
 *   codemod into the @effect/cli command tree.
 */

import { Args, Command } from "@effect/cli";
import { Effect } from "effect";
import { init } from "../codemod/init.js";

const folderArg = Args.text({ name: "folder" }).pipe(Args.optional);

export const initCommand = Command.make("init", { folder: folderArg }, ({ folder }) =>
  init({ folder: folder._tag === "Some" ? folder.value : null }).pipe(
    Effect.flatMap((result) =>
      Effect.log(`init scaffolded ${result.filesCreated.length} files in ${result.folder}`),
    ),
  ),
);
