/**
 * @spec.purpose Serializes the `.safer-spec/&lt;folder>.json` sidecar payload.
 *   `serializeSidecar` encodes a `SpecArtifact` through the canonical Schema
 *   constructor (private to `sidecar.ts`), producing a JSON string with a
 *   trailing newline; `regenerateSidecar` builds that artifact and returns
 *   the byte-for-byte form validate's drift check compares against disk.
 *   `sidecarSlug` is the single source of truth for the on-disk filename.
 *   Output JSON roundtrips through `decodeSpecArtifact`; the roundtrip
 *   property is enforced in the sidecar domain's `__tests__/`. Per-export
 *   guarantees are on the individual exports below.
 */

import { Effect, ParseResult } from "effect";
import {
  SidecarSchemaError,
  decodeSpecArtifact,
  type SpecArtifact,
} from "@safer/spec/artifact/sidecar.js";
import { buildSpecArtifact, type FolderAnalysis, type SpecMeta } from "@safer/spec/artifact/emit.js";

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
