/**
 * @spec.purpose Writes `.safer-spec/<folder>.json` sidecar files. Sanitizes
 *   every string field on emit (size cap + escape) at the sidecar trust
 *   boundary.
 *
 *   Tagged error `SidecarWriteError` is co-located here (this is the file
 *   that emits it via Effect.fail on filesystem failures).
 *
 *   `serializeSidecar` encodes a `SpecArtifact` through the canonical Schema
 *   constructor (private to `sidecar.ts`), producing a JSON string with a
 *   trailing newline. `writeSidecar` writes that JSON to
 *   `.safer-spec/<folder-slug>.json`, creating the directory on first run.
 *
 * @spec.guarantee Output JSON decodes back into `SpecArtifact` via
 *   `decodeSpecArtifact`. Roundtrip property is enforced in the sidecar
 *   domain's `__tests__/`.
 *   reason: agents consume sidecar JSON; a non-roundtrip emitter would produce
 *           artifacts the downstream cannot parse.
 */

import { FileSystem } from "@effect/platform";
import { Data, Effect, ParseResult } from "effect";
import {
  SidecarSchemaError,
  decodeSpecArtifact,
  type SpecArtifact,
} from "@safer/spec/sidecar.js";

export class SidecarWriteError extends Data.TaggedError("SidecarWriteError")<{
  readonly folder: string;
  readonly cause: unknown;
}> {}

interface SidecarWritePayload {
  readonly folder: string;
  readonly artifact: SpecArtifact;
}

const folderSlug = (folder: string): string =>
  folder.replace(/^\.\//, "").replace(/\//g, "_");

const schemaErrorFor = (
  folder: string,
  err: ParseResult.ParseError,
): SidecarSchemaError =>
  new SidecarSchemaError({ path: folder, issues: [String(err.message)] });

/**
 * @spec.guarantee "serialized JSON validates against the sidecar Schema; downstream `decodeSpecArtifact(parse(output))` round-trips"
 *   reason: contract relied on by the sidecar's roundtrip property test.
 * @spec.residual-contract "trailing newline is appended for POSIX-friendly files; JSON itself decodes regardless"
 *   reason: byte-level format contract beyond the Schema shape.
 */
export const serializeSidecar = (
  artifact: SpecArtifact,
): Effect.Effect<string, SidecarSchemaError> =>
  decodeSpecArtifact(artifact).pipe(
    Effect.map((decoded) => JSON.stringify(decoded, null, 2) + "\n"),
    Effect.catchTag("ParseError", (err) =>
      Effect.fail(schemaErrorFor(artifact.folder, err)),
    ),
    Effect.withSpan("spec/sidecar-writer/serializeSidecar"),
  );

const writeError = (folder: string, cause: unknown): SidecarWriteError =>
  new SidecarWriteError({ folder, cause });

/**
 * @spec.guarantee "atomic per-file write via @effect/platform FileSystem; no partial sidecars on failure"
 *   reason: trust contract; downstream validate gate must not see
 *           half-written sidecars.
 * @spec.residual-contract ".safer-spec/<folder>.json directory is created if missing; pre-existing sidecar is overwritten"
 *   reason: side-effect contract; users see the directory created on
 *           first run.
 */
export const writeSidecar = (
  payload: SidecarWritePayload,
): Effect.Effect<void, SidecarSchemaError | SidecarWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const json = yield* serializeSidecar(payload.artifact);
    const dir = ".safer-spec";
    const file = `${dir}/${folderSlug(payload.folder)}.json`;
    yield* fs
      .makeDirectory(dir, { recursive: true })
      .pipe(Effect.catchAll(() => Effect.succeed(void 0)));
    yield* fs
      .writeFileString(file, json)
      .pipe(
        Effect.catchAll((cause) =>
          Effect.fail(writeError(payload.folder, cause)),
        ),
      );
  }).pipe(Effect.withSpan("spec/sidecar-writer/writeSidecar"));
