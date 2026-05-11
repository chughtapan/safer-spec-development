/**
 * @spec.purpose SPEC.md frontmatter contract. Mirrors the YAML block defined
 *   in the design doc's canonical example. Coverage fields are nullable for
 *   `--planned` (architect-PR) state where classifier and precondition numbers
 *   are not yet observable. Schema constructor is private; public boundary is
 *   `decodeSpecFrontmatter`.
 *
 * @spec.residual-contract none
 *   reason: shape and refinements captured by Effect Schema.
 */

import { Effect, ParseResult, Schema } from "effect";

const GeneratedFromSchema = Schema.Struct({
  jsdoc: Schema.String,
  exports: Schema.String,
  schemas: Schema.Array(Schema.String),
  properties: Schema.Array(Schema.String),
  eslint: Schema.String,
});

const CoverageBlockSchema = Schema.Struct({
  kindCoverage: Schema.Number,
  classifierCoverage: Schema.NullOr(Schema.Number),
  preconditionPassRate: Schema.NullOr(Schema.Number),
  branchCoverageFromSpecTests: Schema.NullOr(Schema.Number),
});

const ThresholdsBlockSchema = Schema.Struct({
  kindCoverage: Schema.Number,
  classifierCoverage: Schema.Number,
  preconditionPassRate: Schema.Number,
});

const SpecFrontmatterSchemaInner = Schema.Struct({
  folder: Schema.String,
  generatedFrom: GeneratedFromSchema,
  generatedAtSha: Schema.String,
  coverage: CoverageBlockSchema,
  thresholds: ThresholdsBlockSchema,
});

export type SpecFrontmatter = Schema.Schema.Type<typeof SpecFrontmatterSchemaInner>;

/**
 * Decode unknown YAML-parsed input into `SpecFrontmatter`.
 *
 * @spec.guarantee "rejects malformed input with a typed `ParseError`; never throws"
 *   reason: trust-boundary; the validate gate reads YAML from disk.
 * @spec.residual-contract "coverage fields are nullable for `--planned` (architect-PR) state where classifier and precondition numbers are not yet observable"
 *   reason: lifecycle contract; behavioral residue not encoded in the
 *           Schema's null-permissive shape.
 */
export const decodeSpecFrontmatter = (
  input: unknown,
): Effect.Effect<SpecFrontmatter, ParseResult.ParseError> =>
  Schema.decodeUnknown(SpecFrontmatterSchemaInner)(input);
