/**
 * @spec.purpose Writes `.safer-spec/<folder>.json` sidecar files. Sanitizes
 *   every string field on emit (size cap + escape) per the design doc's
 *   trust-boundary section.
 *
 * @spec.guarantee Output JSON decodes back into `SpecArtifact` via
 *   `Schema.decodeUnknown(SpecArtifactSchema)`. Roundtrip property is enforced
 *   in the reporter's `__tests__/`.
 *   reason: agents consume sidecar JSON; a non-roundtrip emitter would produce
 *           artifacts the downstream cannot parse.
 */

import type { FileSystem } from "@effect/platform";
import type { Effect } from "effect";
import { Effect as Eff } from "effect";
import type {
  SidecarSchemaError,
  SidecarWriteError,
} from "../errors/index.js";
import type { SpecArtifact } from "../sidecar.js";

export interface SidecarWritePayload {
  readonly folder: string;
  readonly artifact: SpecArtifact;
}

export const serializeSidecar = (
  _artifact: SpecArtifact,
): Effect.Effect<string, SidecarSchemaError> =>
  Eff.die(new Error("Stage 1 stub: serializeSidecar not implemented"));

export const writeSidecar = (
  _payload: SidecarWritePayload,
): Effect.Effect<void, SidecarSchemaError | SidecarWriteError, FileSystem.FileSystem> =>
  Eff.die(new Error("Stage 1 stub: writeSidecar not implemented"));

export const readSidecar = (
  _folder: string,
): Effect.Effect<SpecArtifact, SidecarSchemaError | SidecarWriteError, FileSystem.FileSystem> =>
  Eff.die(new Error("Stage 1 stub: readSidecar not implemented"));
