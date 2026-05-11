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

itSpec.todo("sidecar-roundtrip", {
  kind: "Roundtrip",
  exports: [decodeSpecArtifact],
});

itSpec.todo("sidecar-rejects-malformed", {
  kind: "Exception Raising",
  exports: [decodeSpecArtifact],
});

itSpec.todo("sidecar-decoded-shape", {
  kind: "Typechecking",
  exports: [decodeSpecArtifact],
});
