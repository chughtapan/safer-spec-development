/**
 * @spec.purpose
 *   `migrate` command entrypoint. Walks SPEC.md + config files for
 *   format-version transitions; emits a diff for human review; idempotent.
 *   Format-version bumps are signposted in CHANGELOG before migration support
 *   changes.
 *
 *   Tagged error `MigrateError` is co-located here.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";

export class MigrateError extends Data.TaggedError("MigrateError")<{
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly reason: string;
}> {}

interface MigrateInput {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly dryRun: boolean;
}

interface MigrateResult {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly filesUpdated: ReadonlyArray<string>;
  readonly diff: string;
}

/**
 * @spec.assume "the on-disk SPEC.md format-version field matches `fromVersion`; mismatched files are skipped, not converted in-place"
 *   reason: lifecycle precondition; not encoded in the input shape.
 * @spec.guarantee "running migrate twice with the same input produces the same `filesUpdated` set on the second run as the first plus the new converts (idempotent on already-migrated files)"
 *   reason: roundtrip-style contract; allows safe retry.
 * @spec.residual-contract "dry-run never writes; non-dry-run writes atomically per-file"
 *   reason: side-effect contract beyond the Effect signature.
 */
export const migrate = (
  _input: MigrateInput,
): Effect.Effect<
  MigrateResult,
  MigrateError,
  FileSystem.FileSystem | Path.Path
> => Effect.die(new Error("Not implemented: migrate"));
