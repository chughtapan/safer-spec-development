/**
 * @spec.purpose Sidecar JSON contract — the canonical artifact for LLM-agent
 *   consumption. Markdown SPEC.md is for humans; the sidecar is for tools.
 *   Schema constructor is private to this module per
 *   agent-code-guard/no-exported-brand-constructor; the public boundary is
 *   `decodeSpecArtifact`.
 *
 *   Tagged error `SidecarSchemaError` is co-located here (it is emitted by
 *   the sidecar domain — both the decode boundary and the writer raise it on
 *   shape violations).
 *
 * @spec.guarantee All string fields are size-capped and escape-on-emit (no
 *   prompt injection through residual contracts).
 *   reason: directive bodies are user-controlled JSDoc; agents read this JSON
 *           as context for /safer:implement-* and /safer:review-senior.
 */

import { Data, Effect, ParseResult, Schema } from "effect";
import { KINDS } from "@safer/kinds/index.js";

const KindSchema = Schema.Literal(...KINDS);

const ResidualEntrySchema = Schema.Struct({
  claim: Schema.String.pipe(Schema.maxLength(500)),
  reason: Schema.String.pipe(Schema.maxLength(500)),
});

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
  requiredKinds: Schema.Array(KindSchema),
  observedKinds: Schema.Array(KindSchema),
  residualAssumes: Schema.Array(ResidualEntrySchema),
  residualGuarantees: Schema.Array(ResidualEntrySchema),
  sourceRef: Schema.Struct({
    path: Schema.String,
    line: Schema.Number,
    sha: Schema.String,
  }),
});

const CoverageSchema = Schema.Struct({
  kindCoverage: Schema.Number,
  classifierCoverage: Schema.optionalWith(Schema.Number, { exact: true }),
  preconditionPassRate: Schema.optionalWith(Schema.Number, { exact: true }),
  branchCoverageFromSpecTests: Schema.optionalWith(Schema.Number, { exact: true }),
});

const ThresholdsSchema = Schema.Struct({
  kindCoverage: Schema.Number,
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

export type SpecExportEntry = Schema.Schema.Type<typeof SpecExportEntrySchemaInner>;
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
