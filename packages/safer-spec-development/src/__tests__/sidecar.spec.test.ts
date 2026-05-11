/**
 * @spec.purpose Property stubs for the sidecar Effect Schema. Roundtrip per
 *   the design doc's Recommended Approach §6 (encode→decode→encode stable);
 *   Exception Raising on malformed input; Typechecking that decoded shape
 *   matches the declared type.
 */

import { itSpec } from "../helper.js";
import { SpecArtifactSchema } from "../sidecar.js";

itSpec.todo("sidecar-roundtrip", {
  kind: "Roundtrip",
  exports: [SpecArtifactSchema],
});

itSpec.todo("sidecar-rejects-malformed", {
  kind: "Exception Raising",
  exports: [SpecArtifactSchema],
});

itSpec.todo("sidecar-decoded-shape", {
  kind: "Typechecking",
  exports: [SpecArtifactSchema],
});
