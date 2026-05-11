/**
 * @spec.purpose Writes `.safer-spec/<folder>.json` sidecar files. Sanitizes
 *   every string field on emit (size cap + escape) per the design doc's
 *   trust-boundary section.
 *
 *   Tagged error `SidecarWriteError` is co-located here (this is the file
 *   that emits it via Effect.fail on filesystem failures).
 *
 * @spec.guarantee Output JSON decodes back into `SpecArtifact` via
 *   `decodeSpecArtifact`. Roundtrip property is enforced in the sidecar
 *   domain's `__tests__/`.
 *   reason: agents consume sidecar JSON; a non-roundtrip emitter would produce
 *           artifacts the downstream cannot parse.
 */

import type { FileSystem } from "@effect/platform";
import { Data, Effect } from "effect";
import {
  type SidecarSchemaError,
  type SpecArtifact,
} from "@safer/sidecar/schema.js";

export class SidecarWriteError extends Data.TaggedError("SidecarWriteError")<{
  readonly folder: string;
  readonly cause: unknown;
}> {}

interface SidecarWritePayload {
  readonly folder: string;
  readonly artifact: SpecArtifact;
}

/**
 * @spec.guarantee "serialized JSON validates against the sidecar Schema; downstream `decodeSpecArtifact(parse(output))` round-trips"
 *   reason: contract relied on by the sidecar's roundtrip property test.
 * @spec.residual-contract none
 *   reason: pure transformation; behavior captured by signature.
 */
export const serializeSidecar = (
  _artifact: SpecArtifact,
): Effect.Effect<string, SidecarSchemaError> =>
  Effect.die(new Error("Not implemented: serializeSidecar"));

/**
 * @spec.guarantee "atomic per-file write via @effect/platform FileSystem; no partial sidecars on failure"
 *   reason: trust contract; downstream validate gate must not see
 *           half-written sidecars.
 * @spec.residual-contract ".safer-spec/<folder>.json directory is created if missing; pre-existing sidecar is overwritten"
 *   reason: side-effect contract; users see the directory created on
 *           first run.
 */
export const writeSidecar = (
  _payload: SidecarWritePayload,
): Effect.Effect<void, SidecarSchemaError | SidecarWriteError, FileSystem.FileSystem> =>
  Effect.die(new Error("Not implemented: writeSidecar"));
