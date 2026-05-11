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

export const migrate = (
  _input: MigrateInput,
): Effect.Effect<
  MigrateResult,
  MigrateError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: migrate not implemented"));
