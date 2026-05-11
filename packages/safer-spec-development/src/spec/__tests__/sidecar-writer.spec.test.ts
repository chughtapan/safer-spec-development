/**
 * @spec.purpose Property stubs for the sidecar writer. Roundtrip: written
 *   JSON decodes back to the same SpecArtifact value. Trust-boundary: every
 *   string field is escape-on-emit.
 */

import { itSpec } from "@safer/authoring/index.js";
import { decodeSpecArtifact } from "@safer/spec/sidecar.js";
import { serializeSidecar, writeSidecar } from "@safer/spec/sidecar-writer.js";

/**
 * @spec.property sidecar-writer-roundtrip
 * @spec.type Roundtrip
 * @spec.exports serializeSidecar, decodeSpecArtifact
 * @spec.claim decode(parse(serialize(artifact))) returns the original artifact at every well-formed input
 */
itSpec.todo("sidecar-writer-roundtrip", {
  type: "Roundtrip",
  exports: [serializeSidecar, decodeSpecArtifact],
});

/**
 * @spec.property sidecar-writer-atomic-on-failure
 * @spec.type Exception Raising
 * @spec.exports writeSidecar
 * @spec.claim partial sidecars are not left on disk on filesystem failures
 */
itSpec.todo("sidecar-writer-atomic-on-failure", {
  type: "Exception Raising",
  exports: [writeSidecar],
});
