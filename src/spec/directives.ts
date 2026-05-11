/**
 * @spec.purpose Closed grammar for `@spec.*` JSDoc directives + the parser
 *   that reads them off TypeScript source. Domain: SPEC.md authoring +
 *   on-disk artifact layout.
 *
 *   Directive surface has three populations:
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
 *       @spec.skip "<PropertyType>"                    (escape hatch, per-kind)
 *         reason: <why this kind is not applicable to this export>
 *       @spec.ignore-export <Name>             (escape hatch)
 *         reason: <why>
 *
 *     Per-test (above each `itSpec.prop`/`itSpec.todo` call):
 *       @spec.property <id>
 *       @spec.type <PropertyType>
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
import { PROPERTY_TYPES } from "@safer/property-types/index.js";

export const DIRECTIVE_BODY_MAX_CHARS = 500;

const KindSchema = Schema.Literal(...PROPERTY_TYPES);

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

// Per-test directives.
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

interface DirectiveLocation {
  readonly path: string;
  readonly line: number;
  /** null for file-level (`@spec.purpose`, `@spec.ignore`) and per-test directives. */
  readonly exportName: string | null;
}

export interface LocatedDirective {
  readonly directive: Schema.Schema.Type<typeof DirectiveSchema>;
  readonly location: DirectiveLocation;
}

// --- Tagged errors emitted by the parser ---
//
// Only `JsDocDirectiveOverflowError` is exported because `escape.ts` raises it
// from `enforceLengthCap`. Additional parser errors should be exported when
// parseFileDirectives produces them.

export class JsDocDirectiveOverflowError extends Data.TaggedError(
  "JsDocDirectiveOverflowError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly length: number;
  readonly limit: number;
}> {}

/**
 * @spec.guarantee "every emitted directive validates against the closed grammar before downstream consumption; oversize bodies exit with `JsDocDirectiveOverflowError`"
 *   reason: trust-boundary; agents consume parsed directive bodies as
 *           context.
 * @spec.residual-contract "ts-morph (or equivalent) walks JSDoc nodes; the parser does not pre-strip whitespace beyond what ts-morph normalizes"
 *   reason: behavioral residue beyond the Effect signature.
 */
export const parseFileDirectives = (
  _path: string,
  _source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, JsDocDirectiveOverflowError> =>
  Effect.die(new Error("Not implemented: parseFileDirectives"));
