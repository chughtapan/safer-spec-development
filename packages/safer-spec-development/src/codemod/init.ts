/**
 * @spec.purpose
 *   `init` mode entrypoint. Scaffolds first SPEC.md + stub `*.spec.test.ts` +
 *   `safer-spec.config.{ts,json}` in a fresh repo. Picks a leaf folder with
 *   `index.ts` if no folder given. Lenient starter thresholds. Targets
 *   TTHW <10 minutes.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { InitError } from "../errors/index.js";

export interface InitInput {
  readonly folder: string | null;
}

export interface InitResult {
  readonly folder: string;
  readonly filesCreated: ReadonlyArray<string>;
}

export const init = (
  _input: InitInput,
): Effect.Effect<InitResult, InitError, FileSystem.FileSystem | Path.Path> =>
  Eff.die(new Error("Stage 1 stub: init not implemented"));
