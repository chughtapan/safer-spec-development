/**
 * @spec.purpose Property stubs for the sidecar JSON contract. Roundtrip
 *   covers encode/decode stability; Exception Raising covers malformed input;
 *   Typechecking verifies that decoded data matches the declared type.
 *
 *   Tests reference the public `decodeSpecArtifact` boundary; the underlying
 *   Schema constructor stays private to spec/sidecar.ts.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { decodeSpecArtifact } from "@safer/spec/sidecar.js";

/**
 * @spec.property sidecar-roundtrip
 * @spec.type Roundtrip
 * @spec.exports decodeSpecArtifact
 * @spec.claim encode(decode(json)) is byte-equal to the original well-formed json
 */
itSpec.todo("sidecar-roundtrip", {
  type: "Roundtrip",
  exports: [decodeSpecArtifact],
});

/**
 * @spec.property sidecar-rejects-malformed
 * @spec.type Exception Raising
 * @spec.exports decodeSpecArtifact
 * @spec.claim malformed input fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.todo("sidecar-rejects-malformed", {
  type: "Exception Raising",
  exports: [decodeSpecArtifact],
});

/**
 * @spec.property sidecar-decoded-shape
 * @spec.type Typechecking
 * @spec.exports decodeSpecArtifact
 * @spec.claim decoded artifact matches the declared SpecArtifact type at every branch of the union
 */
itSpec.todo("sidecar-decoded-shape", {
  type: "Typechecking",
  exports: [decodeSpecArtifact],
});

/**
 * @spec.property sidecar-preserves-skip-reason-and-residual-contract
 * @spec.type Inclusion
 * @spec.exports decodeSpecArtifact
 * @spec.claim sidecar JSON carries the full `@spec.skip` payload (propertyType + reason) and the `@spec.residual-contract` payload (tagged "none"/"some" with reason and optional body); JSON-only consumers can distinguish a deliberate opt-out from an incomplete required set
 */
itSpec.todo("sidecar-preserves-skip-reason-and-residual-contract", {
  type: "Inclusion",
  exports: [decodeSpecArtifact],
});

/**
 * @spec.property sidecar-classifies-function-expression-exports
 * @spec.type Constant Equality
 * @spec.exports decodeSpecArtifact
 * @spec.claim `export const f = function (...) { ... }` decodes with `shape: "function"` and the sidecar's signature is body-stripped, matching the arrow-form (`export const f = (...) => {...}`); the implementation body is never leaked through the sidecar
 */
itSpec.todo("sidecar-classifies-function-expression-exports", {
  type: "Constant Equality",
  exports: [decodeSpecArtifact],
});
