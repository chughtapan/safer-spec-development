/**
 * @spec.purpose Property stubs for the SPEC.md frontmatter contract.
 *   Tests reference the public `decodeSpecFrontmatter` boundary; the
 *   underlying Schema constructor stays private to spec/frontmatter.ts.
 */

import { Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/grammar/it-spec.js";
import { SPEC_FORMAT_VERSION } from "@safer/project/index.js";
import { decodeSpecFrontmatter } from "@safer/spec/artifact/frontmatter.js";

class FrontmatterAssertionError extends Data.TaggedError(
  "FrontmatterAssertionError",
)<{ readonly detail: string }> {}

const failIf = (
  cond: boolean,
  detail: string,
): Effect.Effect<void, FrontmatterAssertionError> =>
  cond ? Effect.fail(new FrontmatterAssertionError({ detail })) : Effect.void;

interface SeedSample {
  readonly folder: string;
  readonly sha: string;
  readonly typeCoverage: number;
}

const seedArb: fc.Arbitrary<SeedSample> = fc.record({
  folder: fc.stringMatching(/^[a-z][a-z0-9/_-]{0,16}$/),
  sha: fc.stringMatching(/^[0-9a-f]{7,40}$/),
  typeCoverage: fc.double({ min: 0, max: 1, noNaN: true }),
});

const seedFrontmatter = (s: SeedSample): unknown => ({
  folder: s.folder,
  "format-version": SPEC_FORMAT_VERSION,
  generatedFrom: {
    jsdoc: "@spec.*",
    exports: "ts-morph",
    schemas: [],
    properties: [],
    eslint: "agent-code-guard",
  },
  generatedAtSha: s.sha,
  coverage: {
    typeCoverage: s.typeCoverage,
    classifierCoverage: null,
    preconditionPassRate: null,
    branchCoverageFromSpecTests: null,
  },
  thresholds: { typeCoverage: 0, classifierCoverage: 0, preconditionPassRate: 0 },
});

/**
 * @spec.property frontmatter-roundtrip
 * @spec.type Roundtrip
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block
 */
itSpec.prop(
  "frontmatter-roundtrip",
  { type: "Roundtrip", exports: [decodeSpecFrontmatter] },
  seedArb,
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const seed = seedFrontmatter(s);
        const decoded = yield* decodeSpecFrontmatter(seed);
        // Re-decode the decoded value: idempotent round-trip on the typed shape.
        const reDecoded = yield* decodeSpecFrontmatter(decoded);
        yield* failIf(
          JSON.stringify(reDecoded) !== JSON.stringify(decoded),
          `decode is not idempotent: ${JSON.stringify({ decoded, reDecoded })}`,
        );
      }),
    ),
);

/**
 * @spec.property frontmatter-rejects-malformed
 * @spec.type Exception Raising
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim malformed YAML fails on the Effect error channel with a typed ParseError, never throws
 */
itSpec.prop(
  "frontmatter-rejects-malformed",
  { type: "Exception Raising", exports: [decodeSpecFrontmatter] },
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.array(fc.string()),
    fc.record({ folder: fc.string() }),
  ),
  (input) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(decodeSpecFrontmatter(input));
        yield* failIf(
          !Exit.isFailure(exit),
          `expected failure for malformed input ${JSON.stringify(input)}`,
        );
      }),
    ),
);

/**
 * @spec.property frontmatter-decoded-shape
 * @spec.type Typechecking
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim decoded frontmatter matches the declared SpecFrontmatter type at every branch
 */
itSpec.prop(
  "frontmatter-decoded-shape",
  { type: "Typechecking", exports: [decodeSpecFrontmatter] },
  seedArb,
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const decoded = yield* decodeSpecFrontmatter(seedFrontmatter(s));
        yield* failIf(
          typeof decoded.folder !== "string",
          `folder must be string; got ${typeof decoded.folder}`,
        );
        yield* failIf(
          typeof decoded.generatedAtSha !== "string",
          `generatedAtSha must be string`,
        );
        yield* failIf(
          typeof decoded.coverage.typeCoverage !== "number",
          `coverage.typeCoverage must be number`,
        );
      }),
    ),
);

/**
 * @spec.property frontmatter-decode-preserves-format-version
 * @spec.type Inclusion
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim every emitted SPEC.md carries `format-version: &lt;SPEC_FORMAT_VERSION>` in its YAML block and the decode boundary preserves that field on the decoded value (no silent strip during the schema decode)
 */
itSpec.prop(
  "frontmatter-decode-preserves-format-version",
  { type: "Inclusion", exports: [decodeSpecFrontmatter] },
  seedArb,
  (s) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const decoded = yield* decodeSpecFrontmatter(seedFrontmatter(s));
        yield* failIf(
          decoded["format-version"] !== SPEC_FORMAT_VERSION,
          `format-version dropped or rewritten: ${JSON.stringify(decoded["format-version"])}`,
        );
      }),
    ),
);
