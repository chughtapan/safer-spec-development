/**
 * @spec.purpose MODULE.md frontmatter contract — Effect Schema for the YAML
 *   block emitted at the top of each generated MODULE.md. Coverage fields are
 *   nullable for `--planned` state where classifier and
 *   precondition numbers are not yet observable.
 *
 *   Schema constructor is private to this module; the public boundary is
 *   `decodeSpecFrontmatter` (decode unknown YAML output into the typed
 *   shape). Shape and refinements are captured by Effect Schema — no
 *   residual contract beyond the schema is in scope here.
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
  typeCoverage: Schema.Number,
  classifierCoverage: Schema.NullOr(Schema.Number),
  preconditionPassRate: Schema.NullOr(Schema.Number),
  branchCoverageFromSpecTests: Schema.NullOr(Schema.Number),
});

const ThresholdsBlockSchema = Schema.Struct({
  typeCoverage: Schema.Number,
  preconditionPassRate: Schema.Number,
  // Optional + default 0 so MODULE.md files written by older 0.1.0
  // emitters (without this threshold field) still decode cleanly —
  // backwards compat within the same SPEC_FORMAT_VERSION boundary.
  branchCoverageFromSpecTests: Schema.optionalWith(Schema.Number, { default: () => 0 }),
});

const SpecFrontmatterSchemaInner = Schema.Struct({
  folder: Schema.String,
  // The dashed key matches the YAML emitted by `emitFrontmatter` (literal
  // `format-version: <SPEC_FORMAT_VERSION>`); decoding strips it otherwise,
  // which would break round-tripping and the migrate-tier version check.
  "format-version": Schema.String,
  generatedFrom: GeneratedFromSchema,
  generatedAtSha: Schema.String,
  coverage: CoverageBlockSchema,
  thresholds: ThresholdsBlockSchema,
});

export type SpecFrontmatter = Schema.Schema.Type<typeof SpecFrontmatterSchemaInner>;

/**
 * @spec.guarantee "rejects malformed input with a typed `ParseError`; never throws"
 *   reason: trust-boundary; the validate gate reads YAML from disk.
 * @spec.residual-contract "coverage fields are nullable for `--planned` state where classifier and precondition numbers are not yet observable"
 *   reason: lifecycle contract; behavioral residue not encoded in the
 *           Schema's null-permissive shape.
 */
export const decodeSpecFrontmatter = (
  input: unknown,
): Effect.Effect<SpecFrontmatter, ParseResult.ParseError> =>
  Schema.decodeUnknown(SpecFrontmatterSchemaInner)(input);
