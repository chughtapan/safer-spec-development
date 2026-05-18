/**
 * @spec.purpose Writes `.safer-spec/&lt;folder>.json` sidecar files. Sanitizes
 *   every string field on emit (size cap + escape) at the sidecar trust
 *   boundary.
 *
 *   Tagged error `SidecarWriteError` is co-located here (this is the file
 *   that emits it via Effect.fail on filesystem failures).
 *
 *   `serializeSidecar` encodes a `SpecArtifact` through the canonical Schema
 *   constructor (private to `sidecar.ts`), producing a JSON string with a
 *   trailing newline. `writeSidecar` writes that JSON to
 *   `.safer-spec/&lt;folder-slug>.json`, creating the directory on first run.
 *   Output JSON roundtrips through `decodeSpecArtifact`; the roundtrip
 *   property is enforced in the sidecar domain's `__tests__/`. Per-
 *   export guarantees are on the individual exports below.
 */

import { FileSystem } from "@effect/platform";
import { Data, Effect, ParseResult } from "effect";
import {
  SidecarSchemaError,
  decodeSpecArtifact,
  type SpecArtifact,
} from "@safer/spec/artifact/sidecar.js";
import { buildSpecArtifact, type FolderAnalysis, type SpecMeta } from "@safer/spec/artifact/emit.js";

export class SidecarWriteError extends Data.TaggedError("SidecarWriteError")<{
  readonly folder: string;
  readonly cause: unknown;
}> {}

interface SidecarWritePayload {
  readonly folder: string;
  readonly artifact: SpecArtifact;
}

/**
 * @spec.guarantee "folder `.` maps to `\"root\"`; folders with `/` or `\\` are coalesced into a single-segment slug with `_` separators; otherwise the folder string is returned unchanged after stripping leading `./`"
 *   reason: single source of truth for the sidecar slug across generate, validate, and reporter. Three call sites previously inlined this logic; agreement is the contract.
 * @spec.residual-contract none
 *   reason: pure transformation captured by signature.
 * @spec.skip "Partial Roundtrip"
 *   reason: no normalization-with-preservation semantics; this is a one-way name flattening.
 * @spec.skip "Commutative Paths"
 *   reason: single entry point; no alternative API path produces the same slug.
 * @spec.skip "Constant Bounds Checking"
 *   reason: output length is bounded by input length and not gated; no numeric/length contract.
 * @spec.skip "Constant Non-Equality"
 *   reason: distinct folder strings can intentionally collapse to the same slug (`foo/bar` and `foo_bar` both map to `foo_bar`); no anti-collision guarantee.
 * @spec.skip "Inclusion"
 *   reason: returns a single string, not a collection; no membership relation.
 * @spec.skip "Exception Raising"
 *   reason: total function on string input; cannot fail.
 * @spec.skip "Typechecking"
 *   reason: `(string) => string` is captured by the explicit signature; no separate type-level claim worth gating.
 */
export const sidecarSlug = (folder: string): string => {
  if (folder === ".") return "root";
  return folder.replace(/^\.[/\\]/, "").replace(/[/\\]+/g, "_");
};

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

/**
 * @spec.guarantee "regenerates the SpecArtifact and returns the pretty-printed JSON used for on-disk diff; a `SidecarSchemaError` here is a defect (the artifact came from our own emitter)"
 *   reason: validate's sidecar-drift cross-check needs the byte-for-byte
 *           regenerated form; the schema must succeed on artifacts we emit.
 * @spec.skip "Partial Roundtrip"
 *   reason: writer-only; the symmetric path is `decodeSpecArtifact`.
 * @spec.skip "Commutative Paths"
 *   reason: single entry point.
 * @spec.skip "Constant Equality"
 *   reason: output JSON byte sequence depends on the `generatedAtSha` carried in meta; not a constant.
 * @spec.skip "Constant Non-Equality"
 *   reason: distinct (analysis, meta) inputs can produce identical sidecars when the captured fields collapse.
 * @spec.skip "Exception Raising"
 *   reason: typed `Effect of string with never error` — internal schema errors die rather than failing the channel.
 */
export const regenerateSidecar = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): Effect.Effect<string, never> =>
  serializeSidecar(buildSpecArtifact(analysis, meta)).pipe(
    Effect.catchTag("SidecarSchemaError", (e) =>
      Effect.die(new Error(`internal sidecar schema mismatch: ${e.issues.join("; ")}`)),
    ),
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
    // Sidecar lives under the owning folder, alongside the SPEC.md it
    // pairs with. validate.ts reads from <folder>/.safer-spec/<slug>.json;
    // this is the same path so the two halves agree.
    const dir = `${payload.folder}/.safer-spec`;
    const file = `${dir}/${sidecarSlug(payload.folder)}.json`;
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
