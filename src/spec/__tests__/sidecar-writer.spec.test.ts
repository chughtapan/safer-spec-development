/**
 * @specPurpose Property stubs for the sidecar writer. Roundtrip: written
 *   JSON decodes back to the same SpecArtifact value. Trust-boundary: every
 *   string field is escape-on-emit.
 */

import { itSpec } from "@safer/spec/it-spec.js";
import { decodeSpecArtifact } from "@safer/spec/sidecar.js";
import { serializeSidecar, writeSidecar } from "@safer/spec/sidecar-writer.js";

/**
 * @specProperty sidecar-writer-roundtrip
 * @specType Roundtrip
 * @specExports serializeSidecar, decodeSpecArtifact
 * @specClaim decode(parse(serialize(artifact))) returns the original artifact at every well-formed input
 */
itSpec.todo("sidecar-writer-roundtrip", {
  type: "Roundtrip",
  exports: [serializeSidecar, decodeSpecArtifact],
});

/**
 * @specProperty sidecar-writer-atomic-on-failure
 * @specType Exception Raising
 * @specExports writeSidecar
 * @specClaim partial sidecars are not left on disk on filesystem failures
 */
itSpec.todo("sidecar-writer-atomic-on-failure", {
  type: "Exception Raising",
  exports: [writeSidecar],
});
