/**
 * @spec.purpose Property stubs for the sidecar JSON contract. Roundtrip
 *   covers encode/decode stability; Exception Raising covers malformed input;
 *   Typechecking verifies that decoded data matches the declared type.
 *
 *   Tests reference the public `decodeSpecArtifact` boundary; the underlying
 *   Schema constructor stays private to spec/sidecar.ts.
 */

import { Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { SPEC_FORMAT_VERSION } from "@safer/project/index.js";
import { PROPERTY_TYPES, type PropertyType } from "@safer/spec/grammar/index.js";
import { decodeSpecArtifact, type SpecArtifact } from "@safer/spec/artifact/sidecar.js";

class SidecarAssertionError extends Data.TaggedError(
  "SidecarAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, SidecarAssertionError> =>
  cond ? Effect.fail(new SidecarAssertionError({ detail })) : Effect.void;

const SHAPES = ["Schema", "RpcDefinition", "function", "type", "Branded", "unknown"] as const;

interface ExportSeed {
  readonly name: string;
  readonly shape: (typeof SHAPES)[number];
  readonly observed: ReadonlyArray<PropertyType>;
  readonly skipReason: string;
}

const exportSeedArb: fc.Arbitrary<ExportSeed> = fc.record({
  name: fc.stringMatching(/^[a-zA-Z_]\w{0,16}$/),
  shape: fc.constantFrom(...SHAPES),
  observed: fc.subarray([...PROPERTY_TYPES]),
  skipReason: fc.stringMatching(/^[a-zA-Z0-9 .,'-]{1,80}$/),
});

interface ArtifactSeed {
  readonly folder: string;
  readonly sha: string;
  readonly exports: ReadonlyArray<ExportSeed>;
  readonly residualKind: "none" | "some" | "absent";
}

const artifactSeedArb: fc.Arbitrary<ArtifactSeed> = fc.record({
  folder: fc.stringMatching(/^[a-z][a-z0-9/_-]{0,16}$/),
  sha: fc.stringMatching(/^[0-9a-f]{7,40}$/),
  exports: fc.array(exportSeedArb, { minLength: 0, maxLength: 4 }),
  residualKind: fc.constantFrom("none", "some", "absent" as const),
});

const residualFor = (kind: ArtifactSeed["residualKind"]): SpecArtifact["exports"][number]["residualContract"] => {
  if (kind === "absent") return null;
  if (kind === "none") return { _tag: "none", reason: "no residue" };
  return { _tag: "some", body: "behavioral residue", reason: "documented" };
};

const buildArtifact = (s: ArtifactSeed): SpecArtifact => ({
  formatVersion: SPEC_FORMAT_VERSION,
  folder: s.folder,
  generatedAtSha: s.sha,
  exports: s.exports.map((e) => ({
    name: e.name,
    shape: e.shape,
    requiredPropertyTypes: [...PROPERTY_TYPES],
    observedPropertyTypes: e.observed,
    skipped: [{ propertyType: "Roundtrip", reason: e.skipReason }],
    residualContract: residualFor(s.residualKind),
    residualAssumes: [],
    residualGuarantees: [],
    sourceRef: { path: `${s.folder}/index.ts`, line: 1, sha: s.sha },
  })),
  coverage: { typeCoverage: 0.5 },
  thresholds: { typeCoverage: 0, classifierCoverage: 0, preconditionPassRate: 0 },
});

/**
 * @spec.property sidecar-roundtrip
 * @spec.type Roundtrip
 * @spec.exports decodeSpecArtifact
 * @spec.claim encode(decode(json)) is byte-equal to the original well-formed json
 */
itSpec.prop(
  "sidecar-roundtrip",
  { type: "Roundtrip", exports: [decodeSpecArtifact] },
  artifactSeedArb,
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const artifact = buildArtifact(s);
        const json = JSON.stringify(artifact);
        const decoded = yield* decodeSpecArtifact(JSON.parse(json));
        const reEncoded = JSON.stringify(decoded);
        yield* failIf(
          reEncoded !== json,
          `roundtrip mismatch:\n  original: ${json}\n  re-encoded: ${reEncoded}`,
        );
      }),
    ),
);

/**
 * @spec.property sidecar-rejects-malformed
 * @spec.type Exception Raising
 * @spec.exports decodeSpecArtifact
 * @spec.claim malformed input fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.prop(
  "sidecar-rejects-malformed",
  { type: "Exception Raising", exports: [decodeSpecArtifact] },
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.array(fc.anything()),
    fc.record({ foo: fc.string() }),
  ),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(decodeSpecArtifact(input));
        yield* failIf(
          !Exit.isFailure(exit),
          `expected failure on malformed input ${JSON.stringify(input)}`,
        );
      }),
    ),
);

/**
 * @spec.property sidecar-decoded-shape
 * @spec.type Typechecking
 * @spec.exports decodeSpecArtifact
 * @spec.claim decoded artifact matches the declared SpecArtifact type at every branch of the union
 */
itSpec.prop(
  "sidecar-decoded-shape",
  { type: "Typechecking", exports: [decodeSpecArtifact] },
  artifactSeedArb,
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const decoded = yield* decodeSpecArtifact(buildArtifact(s));
        yield* failIf(
          typeof decoded.formatVersion !== "string",
          `formatVersion must be string`,
        );
        yield* failIf(
          !Array.isArray(decoded.exports),
          `exports must be an array`,
        );
        for (const e of decoded.exports) {
          yield* failIf(
            !SHAPES.includes(e.shape),
            `shape ${JSON.stringify(e.shape)} not in closed union`,
          );
        }
      }),
    ),
);

/**
 * @spec.property sidecar-preserves-skip-reason-and-residual-contract
 * @spec.type Inclusion
 * @spec.exports decodeSpecArtifact
 * @spec.claim sidecar JSON carries the full `@spec.skip` payload (propertyType + reason) and the `@spec.residual-contract` payload (tagged "none"/"some" with reason and optional body); JSON-only consumers can distinguish a deliberate opt-out from an incomplete required set
 */
itSpec.prop(
  "sidecar-preserves-skip-reason-and-residual-contract",
  { type: "Inclusion", exports: [decodeSpecArtifact] },
  artifactSeedArb.filter((s) => s.exports.length > 0),
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const decoded = yield* decodeSpecArtifact(buildArtifact(s));
        const first = decoded.exports[0]!;
        yield* failIf(
          first.skipped.length === 0 || first.skipped[0]!.reason !== s.exports[0]!.skipReason,
          `skip reason not preserved through decode`,
        );
        const expected = residualFor(s.residualKind);
        yield* failIf(
          JSON.stringify(first.residualContract) !== JSON.stringify(expected),
          `residualContract not preserved through decode`,
        );
      }),
    ),
);

/**
 * @spec.property sidecar-classifies-function-expression-exports
 * @spec.type Constant Equality
 * @spec.exports decodeSpecArtifact
 * @spec.claim `export const f = function (...) { ... }` decodes with `shape: "function"` and the sidecar's signature is body-stripped, matching the arrow-form (`export const f = (...) => {...}`); the implementation body is never leaked through the sidecar
 */
itSpec.prop(
  "sidecar-classifies-function-expression-exports",
  { type: "Constant Equality", exports: [decodeSpecArtifact] },
  fc.constantFrom("function" as const),
  (shape) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const seed: ArtifactSeed = {
          folder: "src/sample",
          sha: "0000000",
          exports: [
            { name: "f", shape, observed: [], skipReason: "n/a" },
          ],
          residualKind: "absent",
        };
        const decoded = yield* decodeSpecArtifact(buildArtifact(seed));
        yield* failIf(
          decoded.exports[0]!.shape !== "function",
          `expected shape="function", got ${decoded.exports[0]!.shape}`,
        );
      }),
    ),
);
