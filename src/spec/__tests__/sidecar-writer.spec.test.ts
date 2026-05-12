/**
 * @spec.purpose Property stubs for the sidecar writer. Roundtrip: written
 *   JSON decodes back to the same SpecArtifact value. Trust-boundary: every
 *   string field is escape-on-emit.
 */

import * as fc from "fast-check";
import { itSpec } from "@safer/spec/it-spec.js";
import { decodeSpecArtifact } from "@safer/spec/sidecar.js";
import { serializeSidecar, sidecarSlug, writeSidecar } from "@safer/spec/sidecar-writer.js";

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
 * @spec.exports writeSidecar, sidecarSlug
 * @spec.claim folder `"."` (project root sentinel) writes to `.safer-spec/root.json`; the writer's slug helper agrees with `generate.ts`/`validate-pipeline.ts` so write and validate never disagree on the on-disk path
 */
itSpec.prop(
  "sidecar-writer-maps-root-folder-to-root-slug",
  { type: "Constant Equality", exports: [writeSidecar, sidecarSlug] },
  fc.constant("."),
  (folder) => {
    const got = sidecarSlug(folder);
    if (got !== "root") {
      throw new Error(`expected slug \"root\" for folder \".\", got ${JSON.stringify(got)}`);
    }
  },
);

/**
 * @spec.property sidecar-writer-coalesces-path-separators-into-slug
 * @spec.type Constant Equality
 * @spec.exports writeSidecar, sidecarSlug
 * @spec.claim folders containing `/` and `\` (Windows-style) produce a single-segment slug (`src_spec`, not a path with separators) so the sidecar file is one filename under `.safer-spec/`, never an unintended nested directory
 */
itSpec.prop(
  "sidecar-writer-coalesces-path-separators-into-slug",
  { type: "Constant Equality", exports: [writeSidecar, sidecarSlug] },
  fc.array(
    fc.stringMatching(/^[a-z][a-z0-9-]*$/),
    { minLength: 1, maxLength: 5 },
  ),
  (segments) => {
    const forward = segments.join("/");
    const backward = segments.join("\\");
    const mixed = segments.join("/\\");
    for (const folder of [forward, backward, mixed]) {
      const slug = sidecarSlug(folder);
      if (slug.includes("/") || slug.includes("\\")) {
        throw new Error(`slug ${JSON.stringify(slug)} contains a path separator for folder ${JSON.stringify(folder)}`);
      }
    }
    if (sidecarSlug(forward) !== segments.join("_")) {
      throw new Error(`slug mismatch for ${JSON.stringify(forward)}`);
    }
  },
);
