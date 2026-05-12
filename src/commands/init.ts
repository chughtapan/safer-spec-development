/**
 * @spec.purpose
 *   `init` command entrypoint. Scaffolds first SPEC.md + stub `*.spec.test.ts` +
 *   `safer-spec.config.{ts,json}` in a fresh repo. Picks a leaf folder with
 *   `index.ts` if no folder given. Lenient starter thresholds. Targets
 *   TTHW &lt;10 minutes.
 *
 *   Tagged error `InitError` is co-located here.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect, Option } from "effect";

export class InitError extends Data.TaggedError("InitError")<{
  readonly folder: string;
  readonly reason: string;
}> {}

interface InitInput {
  /** `Option.none()` picks a leaf folder with `index.ts`; `Option.some(path)` scopes to one. */
  readonly folder: Option.Option<string>;
}

interface InitResult {
  readonly folder: string;
  readonly filesCreated: ReadonlyArray<string>;
}

/**
 * @spec.assume "the target folder either exists empty OR exists with `index.ts`; init refuses on a folder that already has a SPEC.md"
 *   reason: lifecycle precondition; not encoded in the InitInput shape.
 * @spec.guarantee "writes are atomic per-file via FileSystem service; partial scaffolds are not left on disk on failure"
 *   reason: side-effect contract; the `@effect/platform` FileSystem layer
 *           handles rollback semantics.
 * @spec.residual-contract "scaffold templates are stable across patch versions; format-version bumps require migrate"
 *   reason: lifecycle contract beyond the Effect signature.
 */
export const init = (
  _input: InitInput,
): Effect.Effect<InitResult, InitError, FileSystem.FileSystem | Path.Path> =>
  Effect.die(new Error("Not implemented: init"));
