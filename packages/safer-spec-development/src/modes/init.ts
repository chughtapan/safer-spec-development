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

interface InitInput {
  readonly folder: string | null;
}

interface InitResult {
  readonly folder: string;
  readonly filesCreated: ReadonlyArray<string>;
}

/**
 * @spec.assume "the target folder either exists empty OR exists with `index.ts`; init refuses on a folder that already has a SPEC.md"
 *   reason: lifecycle precondition; not encoded in the InitInput shape.
 * @spec.guarantee "writes are atomic per-file via FileSystem service; partial scaffolds are not left on disk on failure"
 *   reason: side-effect contract; the @effect/platform FileSystem layer
 *           handles the rollback semantics, not init's body.
 * @spec.residual-contract "scaffold templates are stable across patch versions; format-version bumps require migrate"
 *   reason: lifecycle contract beyond the Effect signature.
 */
export const init = (
  _input: InitInput,
): Effect.Effect<InitResult, InitError, FileSystem.FileSystem | Path.Path> =>
  Eff.die(new Error("Stage 1 stub: init not implemented"));
