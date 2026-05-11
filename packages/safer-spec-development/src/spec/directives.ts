/* eslint-disable max-classes-per-file -- jsdoc-directive parsing emits
   three closely-related tagged errors (parse, overflow, unknown-directive);
   co-locating them with the grammar definition they belong to is exactly
   the per-domain ownership pattern. */
/**
 * @spec.purpose Closed grammar for `@spec.*` JSDoc directives + the parser
 *   that reads them off TypeScript source. Domain: SPEC.md authoring +
 *   on-disk artifact layout.
 *
 *   Directive surface (three populations per DESIGN.md "Section Population
 *   Rules" and parent epic Amendment 6):
 *
 *     File-level (on `index.ts` barrels):
 *       @spec.purpose <one-line>
 *       @spec.ignore                          (escape hatch)
 *
 *     Per-export declarations (on each public-surface export):
 *       @spec.assume "<behavioral residue>"
 *         reason: <why it isn't in the type system>
 *       @spec.guarantee "<side-effect / lifecycle contract>"
 *         reason: <why it isn't in the return type>
 *       @spec.residual-contract <none | "named contract">
 *         reason: <why>
 *       @spec.skip "<Kind>"                    (escape hatch, per-kind)
 *         reason: <why this kind is not applicable to this export>
 *       @spec.ignore-export <Name>             (escape hatch)
 *         reason: <why>
 *
 *     Per-test (above each `itSpec.prop`/`itSpec.todo` call) — Amendment 6:
 *       @spec.property <id>
 *       @spec.kind <Kind>
 *       @spec.exports <symbol-names>
 *       @spec.claim <one-line>
 *
 *   Schema constructors (`PurposeDirectiveSchema`, etc.) stay private to
 *   this module; downstream callers consume the derived `Directive` type and
 *   the `parseFileDirectives` boundary.
 *
 * @spec.guarantee Directive body length is capped at DIRECTIVE_BODY_MAX_CHARS;
 *   parser emits `JsDocDirectiveOverflowError` on overflow.
 *   reason: trust-boundary defense against prompt-injection via residual
 *           contracts.
 */

import { Data, Effect, Schema } from "effect";
import { KINDS } from "#kinds/index.js";

export const DIRECTIVE_BODY_MAX_CHARS = 500;

const KindSchema = Schema.Literal(...KINDS);

// File-level directives (on index.ts barrels).
const PurposeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("purpose"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});
const IgnoreFileDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore"),
});

// Per-export directives.
const AssumeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("assume"),
  claim: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});
const GuaranteeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("guarantee"),
  claim: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});
const ResidualContractDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("residual-contract"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});
const SkipDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("skip"),
  kind: KindSchema,
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});
const IgnoreExportDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore-export"),
  exportName: Schema.String,
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

// Per-test directives (Amendment 6).
const PropertyDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("property"),
  id: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});
const KindDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("kind"),
  kind: KindSchema,
});
const ExportsDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("exports"),
  symbols: Schema.Array(Schema.String).pipe(
    Schema.itemsCount(1, { exact: false }),
  ),
});
const ClaimDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("claim"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

const DirectiveSchema = Schema.Union(
  PurposeDirectiveSchema,
  IgnoreFileDirectiveSchema,
  AssumeDirectiveSchema,
  GuaranteeDirectiveSchema,
  ResidualContractDirectiveSchema,
  SkipDirectiveSchema,
  IgnoreExportDirectiveSchema,
  PropertyDirectiveSchema,
  KindDirectiveSchema,
  ExportsDirectiveSchema,
  ClaimDirectiveSchema,
);

export type Directive = Schema.Schema.Type<typeof DirectiveSchema>;

interface DirectiveLocation {
  readonly path: string;
  readonly line: number;
  /** null for file-level (`@spec.purpose`, `@spec.ignore`) and per-test directives. */
  readonly exportName: string | null;
}

export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}

// --- Tagged errors emitted by the parser ---

export class JsDocDirectiveParseError extends Data.TaggedError(
  "JsDocDirectiveParseError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly reason: string;
}> {}

export class JsDocDirectiveOverflowError extends Data.TaggedError(
  "JsDocDirectiveOverflowError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly length: number;
  readonly limit: number;
}> {}

export class JsDocUnknownDirectiveError extends Data.TaggedError(
  "JsDocUnknownDirectiveError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}> {}

type ParseError =
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError
  | JsDocDirectiveOverflowError;

/**
 * @spec.guarantee "every emitted directive validates against the closed grammar before downstream consumption; unknown names exit with `JsDocUnknownDirectiveError`, malformed bodies exit with `JsDocDirectiveParseError`"
 *   reason: trust-boundary; agents consume parsed directive bodies as
 *           context.
 * @spec.residual-contract "ts-morph (or equivalent) walks JSDoc nodes; the parser does not pre-strip whitespace beyond what ts-morph normalizes"
 *   reason: behavioral residue beyond the Effect signature.
 */
export const parseFileDirectives = (
  _path: string,
  _source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, ParseError> =>
  Effect.die(new Error("Stage 1 stub: parseFileDirectives not implemented"));
