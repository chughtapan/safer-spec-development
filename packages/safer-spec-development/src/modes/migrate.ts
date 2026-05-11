/**
 * @spec.purpose
 *   `migrate` mode entrypoint. Walks SPEC.md + config files for
 *   format-version transitions; emits a diff for human review; idempotent.
 *   Deprecation policy per design doc: format-version bumps signposted in
 *   CHANGELOG ≥1 version ahead.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { MigrateError } from "../errors/index.js";

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
> => Eff.die(new Error("Stage 1 stub: migrate not implemented"));
