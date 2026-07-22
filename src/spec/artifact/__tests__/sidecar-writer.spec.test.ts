/**
 * @spec.purpose Property stubs for the sidecar writer. Roundtrip: written
 *   JSON decodes back to the same SpecArtifact value. Trust-boundary: every
 *   string field is escape-on-emit.
 */

import { Data, Effect } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { SPEC_FORMAT_VERSION } from "@safer/project/index.js";
import { PROPERTY_TYPES } from "@safer/spec/grammar/index.js";
import { decodeSpecArtifact, type SpecArtifact } from "@safer/spec/artifact/sidecar.js";
import { serializeSidecar, sidecarSlug } from "@safer/spec/artifact/sidecar-writer.js";

class SidecarWriterAssertionError extends Data.TaggedError(
  "SidecarWriterAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, SidecarWriterAssertionError> =>
  cond ? Effect.fail(new SidecarWriterAssertionError({ detail })) : Effect.void;

const sampleArtifact = (folder: string): SpecArtifact => ({
  formatVersion: SPEC_FORMAT_VERSION,
  folder,
  generatedAtSha: "0000000",
  exports: [
    {
      name: "foo",
      shape: "function",
      requiredPropertyTypes: [...PROPERTY_TYPES],
      observedPropertyTypes: [],
      skipped: [],
      residualContract: null,
      residualAssumes: [],
      residualGuarantees: [],
      sourceRef: { path: `${folder}/index.ts`, line: 1, sha: "0000000" },
    },
  ],
  coverage: { typeCoverage: 0 },
  thresholds: { typeCoverage: 0, preconditionPassRate: 0, branchCoverageFromSpecTests: 0 },
});

/**
 * @spec.property sidecar-writer-roundtrip
 * @spec.type Roundtrip
 * @spec.exports serializeSidecar, decodeSpecArtifact
 * @spec.claim decode(parse(serialize(artifact))) returns the original artifact at every well-formed input
 */
itSpec.prop(
  "sidecar-writer-roundtrip",
  { type: "Roundtrip", exports: [serializeSidecar, decodeSpecArtifact] },
  fc.stringMatching(/^[a-z][a-z0-9_-]{0,12}$/),
  (folder) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const artifact = sampleArtifact(folder);
        const json = yield* serializeSidecar(artifact);
        const decoded = yield* decodeSpecArtifact(JSON.parse(json));
        yield* failIf(
          JSON.stringify(decoded) !== JSON.stringify(artifact),
          `roundtrip mismatch:\n  original: ${JSON.stringify(artifact)}\n  decoded:  ${JSON.stringify(decoded)}`,
        );
        yield* failIf(
          !json.endsWith("\n"),
          `serialized JSON must end with a newline`,
        );
      }),
    ),
);

/**
 * @spec.property sidecar-writer-maps-root-folder-to-root-slug
 * @spec.type Constant Equality
 * @spec.exports sidecarSlug
 * @spec.claim folder `"."` (project root sentinel) maps to `root` so the sidecar writes to `.safer-spec/root.json`; the slug helper agrees with `generate.ts`/`validate-pipeline.ts` so write and validate never disagree on the on-disk path
 */
itSpec.prop(
  "sidecar-writer-maps-root-folder-to-root-slug",
  { type: "Constant Equality", exports: [sidecarSlug] },
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
 * @spec.exports sidecarSlug
 * @spec.claim folders containing `/` and `\` (Windows-style) produce a single-segment slug (`src_spec`, not a path with separators) so the sidecar file is one filename under `.safer-spec/`, never an unintended nested directory
 */
itSpec.prop(
  "sidecar-writer-coalesces-path-separators-into-slug",
  { type: "Constant Equality", exports: [sidecarSlug] },
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
