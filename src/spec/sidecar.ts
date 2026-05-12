/**
 * @spec.purpose Sidecar JSON contract — the canonical artifact for LLM-agent
 *   consumption. Markdown SPEC.md is for humans; the sidecar is for tools.
 *   The Schema constructor stays private; `decodeSpecArtifact` is the public
 *   boundary.
 *
 *   Tagged error `SidecarSchemaError` is co-located here (it is emitted by
 *   the sidecar domain — both the decode boundary and the writer raise it on
 *   shape violations). All string fields are size-capped and escape-on-emit
 *   (no prompt injection through residual contracts) — directive bodies are
 *   user-controlled JSDoc and agents read this JSON as downstream execution
 *   context. Per-export guarantees are on the individual exports below.
 */

import { Data, Effect, ParseResult, Schema } from "effect";
import { PROPERTY_TYPES } from "@safer/property-types/index.js";

const KindSchema = Schema.Literal(...PROPERTY_TYPES);

const ResidualEntrySchema = Schema.Struct({
  claim: Schema.String.pipe(Schema.maxLength(500)),
  reason: Schema.String.pipe(Schema.maxLength(500)),
});

const SkippedEntrySchema = Schema.Struct({
  propertyType: KindSchema,
  reason: Schema.String.pipe(Schema.maxLength(500)),
});

const ResidualContractSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("none"),
    reason: Schema.String.pipe(Schema.maxLength(500)),
  }),
  Schema.Struct({
    _tag: Schema.Literal("some"),
    body: Schema.String.pipe(Schema.maxLength(500)),
    reason: Schema.String.pipe(Schema.maxLength(500)),
  }),
);

const SpecExportEntrySchemaInner = Schema.Struct({
  name: Schema.String,
  shape: Schema.Literal(
    "Schema",
    "RpcDefinition",
    "function",
    "type",
    "Branded",
    "unknown",
  ),
  requiredPropertyTypes: Schema.Array(KindSchema),
  observedPropertyTypes: Schema.Array(KindSchema),
  // Each entry pairs the deliberately-opted-out `propertyType` with the
  // author's stated reason. JSON-only sidecar consumers need this so they
  // can distinguish an `@spec.skip` opt-out from an incomplete required set.
  skipped: Schema.Array(SkippedEntrySchema),
  // Null = no @spec.residual-contract directive; otherwise a tagged union
  // mirroring the in-memory shape ("none" with reason vs "some" with body +
  // reason). The markdown form already surfaces this; sidecar parity keeps
  // tool-facing consumers in sync with the human-readable spec.
  residualContract: Schema.NullOr(ResidualContractSchema),
  residualAssumes: Schema.Array(ResidualEntrySchema),
  residualGuarantees: Schema.Array(ResidualEntrySchema),
  sourceRef: Schema.Struct({
    path: Schema.String,
    line: Schema.Number,
    sha: Schema.String,
  }),
});

const CoverageSchema = Schema.Struct({
  typeCoverage: Schema.Number,
  classifierCoverage: Schema.optionalWith(Schema.Number, { exact: true }),
  preconditionPassRate: Schema.optionalWith(Schema.Number, { exact: true }),
  branchCoverageFromSpecTests: Schema.optionalWith(Schema.Number, { exact: true }),
});

const ThresholdsSchema = Schema.Struct({
  typeCoverage: Schema.Number,
  classifierCoverage: Schema.Number,
  preconditionPassRate: Schema.Number,
});

const SpecArtifactSchemaInner = Schema.Struct({
  formatVersion: Schema.String,
  folder: Schema.String,
  generatedAtSha: Schema.String,
  exports: Schema.Array(SpecExportEntrySchemaInner),
  coverage: CoverageSchema,
  thresholds: ThresholdsSchema,
});

type SpecExportEntry = Schema.Schema.Type<typeof SpecExportEntrySchemaInner>;
export type SpecArtifact = Schema.Schema.Type<typeof SpecArtifactSchemaInner>;

export class SidecarSchemaError extends Data.TaggedError("SidecarSchemaError")<{
  readonly path: string;
  readonly issues: ReadonlyArray<string>;
}> {}

/**
 * @spec.guarantee "rejects malformed input with a typed `ParseError` rather than throwing"
 *   reason: trust-boundary contract; the codemod's validate gate
 *           consumes the error channel, never a thrown exception.
 * @spec.residual-contract "decoded artifact's string fields are size-capped per the underlying Schema; the cap is enforced at decode time, not via runtime check"
 *   reason: refinements live in the Schema constructor (private to this
 *           module); callers see the refined types post-decode.
 */
export const decodeSpecArtifact = (
  input: unknown,
): Effect.Effect<SpecArtifact, ParseResult.ParseError> =>
  Schema.decodeUnknown(SpecArtifactSchemaInner)(input);
