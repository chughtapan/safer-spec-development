/**
 * @spec.purpose
 *   `explain` mode entrypoint. Looks up an error code (e.g.
 *   `MISSING_SPEC_PROPERTY`, `spec-kind-coverage`) and returns the
 *   corresponding `docs/errors.md` entry. Closes the loop on every diagnostic
 *   the validate gate emits.
 */

import type { FileSystem, Path } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type { ExplainError } from "../errors/index.js";

interface ExplainInput {
  readonly errorCode: string;
}

interface ExplainResult {
  readonly errorCode: string;
  readonly docsPath: string;
  readonly entry: string;
}

export const explain = (
  _input: ExplainInput,
): Effect.Effect<
  ExplainResult,
  ExplainError,
  FileSystem.FileSystem | Path.Path
> => Eff.die(new Error("Stage 1 stub: explain not implemented"));
