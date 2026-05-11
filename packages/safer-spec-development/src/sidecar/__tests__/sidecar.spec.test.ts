/**
 * @spec.purpose Property stubs for the sidecar JSON contract. Roundtrip
 *   covers encode/decode stability; Exception Raising covers malformed input;
 *   Typechecking verifies that decoded data matches the declared type.
 *
 *   Tests reference the public `decodeSpecArtifact` boundary; the underlying
 *   Schema constructor stays private to sidecar/schema.ts.
 */

import { itSpec } from "@safer/authoring/index.js";
import { decodeSpecArtifact } from "@safer/sidecar/schema.js";

/**
 * @spec.property sidecar-roundtrip
 * @spec.kind Roundtrip
 * @spec.exports decodeSpecArtifact
 * @spec.claim encode(decode(json)) is byte-equal to the original well-formed json
 */
itSpec.todo("sidecar-roundtrip", {
  kind: "Roundtrip",
  exports: [decodeSpecArtifact],
});

/**
 * @spec.property sidecar-rejects-malformed
 * @spec.kind Exception Raising
 * @spec.exports decodeSpecArtifact
 * @spec.claim malformed input fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.todo("sidecar-rejects-malformed", {
  kind: "Exception Raising",
  exports: [decodeSpecArtifact],
});

/**
 * @spec.property sidecar-decoded-shape
 * @spec.kind Typechecking
 * @spec.exports decodeSpecArtifact
 * @spec.claim decoded artifact matches the declared SpecArtifact type at every branch of the union
 */
itSpec.todo("sidecar-decoded-shape", {
  kind: "Typechecking",
  exports: [decodeSpecArtifact],
});
