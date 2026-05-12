/**
 * @spec.purpose Property stubs for the sidecar writer. Roundtrip: written
 *   JSON decodes back to the same SpecArtifact value. Trust-boundary: every
 *   string field is escape-on-emit.
 */

import { itSpec } from "@safer/spec/it-spec.js";
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

/**
 * @spec.property sidecar-writer-maps-root-folder-to-root-slug
 * @spec.type Constant Equality
 * @spec.exports writeSidecar
 * @spec.claim folder `"."` (project root sentinel) writes to `.safer-spec/root.json`; the writer's slug helper agrees with `generate.ts`/`validate-pipeline.ts` so write and validate never disagree on the on-disk path
 */
itSpec.todo("sidecar-writer-maps-root-folder-to-root-slug", {
  type: "Constant Equality",
  exports: [writeSidecar],
});

/**
 * @spec.property sidecar-writer-coalesces-path-separators-into-slug
 * @spec.type Constant Equality
 * @spec.exports writeSidecar
 * @spec.claim folders containing `/` and `\` (Windows-style) produce a single-segment slug (`src_spec`, not a path with separators) so the sidecar file is one filename under `.safer-spec/`, never an unintended nested directory
 */
itSpec.todo("sidecar-writer-coalesces-path-separators-into-slug", {
  type: "Constant Equality",
  exports: [writeSidecar],
});
