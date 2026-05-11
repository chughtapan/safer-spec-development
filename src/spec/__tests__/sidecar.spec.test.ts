/**
 * @specPurpose Property stubs for the sidecar JSON contract. Roundtrip
 *   covers encode/decode stability; Exception Raising covers malformed input;
 *   Typechecking verifies that decoded data matches the declared type.
 *
 *   Tests reference the public `decodeSpecArtifact` boundary; the underlying
 *   Schema constructor stays private to spec/sidecar.ts.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { decodeSpecArtifact } from "@safer/spec/sidecar.js";

/**
 * @specProperty sidecar-roundtrip
 * @specType Roundtrip
 * @specExports decodeSpecArtifact
 * @specClaim encode(decode(json)) is byte-equal to the original well-formed json
 */
itSpec.todo("sidecar-roundtrip", {
  type: "Roundtrip",
  exports: [decodeSpecArtifact],
});

/**
 * @specProperty sidecar-rejects-malformed
 * @specType Exception Raising
 * @specExports decodeSpecArtifact
 * @specClaim malformed input fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.todo("sidecar-rejects-malformed", {
  type: "Exception Raising",
  exports: [decodeSpecArtifact],
});

/**
 * @specProperty sidecar-decoded-shape
 * @specType Typechecking
 * @specExports decodeSpecArtifact
 * @specClaim decoded artifact matches the declared SpecArtifact type at every branch of the union
 */
itSpec.todo("sidecar-decoded-shape", {
  type: "Typechecking",
  exports: [decodeSpecArtifact],
});
