/**
 * @specPurpose
 *   `explain` command entrypoint. Looks up an error code (e.g.
 *   `MISSING_SPEC_PROPERTY`, `spec-property-type-coverage`) and returns the
 *   corresponding `docs/errors.md` entry.
 *
 *   Tagged error `ExplainError` is co-located here.
 */

import type { FileSystem, Path } from "@effect/platform";
import { Data, Effect } from "effect";

export class ExplainError extends Data.TaggedError("ExplainError")<{
  readonly errorCode: string;
  readonly reason: string;
}> {}

interface ExplainInput {
  readonly errorCode: string;
}

interface ExplainResult {
  readonly errorCode: string;
  readonly docsPath: string;
  readonly entry: string;
}

/**
 * @specAssume "every error code emitted by validate is documented in `docs/errors.md`; missing entries are an explain failure, not silent"
 *   reason: trust contract; users hit explain when they cannot decode a
 *           diagnostic.
 * @specGuarantee "the returned `entry` is the exact docs section text, not summarized"
 *   reason: reads the docs file verbatim; downstream UIs render it
 *           unchanged.
 * @specResidualContract none
 *   reason: pure read; behavior fully captured by the Effect signature.
 */
export const explain = (
  _input: ExplainInput,
): Effect.Effect<
  ExplainResult,
  ExplainError,
  FileSystem.FileSystem | Path.Path
> => Effect.die(new Error("Not implemented: explain"));
