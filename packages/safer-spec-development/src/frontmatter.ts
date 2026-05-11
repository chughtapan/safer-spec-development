/**
 * @spec.purpose Effect Schema for SPEC.md frontmatter. Mirrors the YAML block
 *   defined in the design doc's canonical example. Coverage fields are nullable
 *   for `--planned` (architect-PR) state where classifier and precondition
 *   numbers are not yet observable.
 *
 * @spec.residual-contract none
 *   reason: shape and refinements captured by Effect Schema.
 */

import { Schema } from "effect";

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

export const SpecFrontmatterSchema = Schema.Struct({
  folder: Schema.String,
  generatedFrom: GeneratedFromSchema,
  generatedAtSha: Schema.String,
  coverage: CoverageBlockSchema,
  thresholds: ThresholdsBlockSchema,
});

export type SpecFrontmatter = Schema.Schema.Type<typeof SpecFrontmatterSchema>;
