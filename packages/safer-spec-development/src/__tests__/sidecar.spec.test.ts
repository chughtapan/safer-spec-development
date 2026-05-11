/**
 * @spec.purpose Property stubs for the sidecar JSON contract. Roundtrip per
 *   the design doc's Recommended Approach §6 (encode→decode→encode stable);
 *   Exception Raising on malformed input; Typechecking that decoded shape
 *   matches the declared type.
 *
 *   Tests reference the public `decodeSpecArtifact` boundary; the underlying
 *   Schema constructor stays private to kernel/sidecar.ts.
 */

import { itSpec } from "../kernel/index.js";
import { decodeSpecArtifact } from "../kernel/index.js";

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
