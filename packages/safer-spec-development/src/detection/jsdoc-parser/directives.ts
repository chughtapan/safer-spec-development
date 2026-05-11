/**
 * @spec.purpose Closed grammar for `@spec.*` JSDoc directives. The 7-directive
 *   surface (5 author-facing + 2 escape hatches) defined in the design doc's
 *   "Directive Syntax (closed set of 5)" section. Schema constructors stay
 *   private to this module; downstream callers consume the derived `Directive`
 *   type and its location-tagged wrapper.
 *
 * @spec.guarantee Directive body length is capped at DIRECTIVE_BODY_MAX_CHARS;
 *   parser emits `JsDocDirectiveOverflowError` on overflow.
 *   reason: trust-boundary defense against prompt-injection via residual
 *           contracts.
 */

import { Schema } from "effect";
import { KINDS } from "../../kernel/index.js";

export const DIRECTIVE_BODY_MAX_CHARS = 500;

const KindSchema = Schema.Literal(...KINDS);

const PurposeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("purpose"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

const SkipDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("skip"),
  kind: KindSchema,
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

const ResidualContractDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("residual-contract"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

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

const IgnoreFileDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore"),
});

const IgnoreExportDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore-export"),
  exportName: Schema.String,
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

const DirectiveSchema = Schema.Union(
  PurposeDirectiveSchema,
  SkipDirectiveSchema,
  ResidualContractDirectiveSchema,
  AssumeDirectiveSchema,
  GuaranteeDirectiveSchema,
  IgnoreFileDirectiveSchema,
  IgnoreExportDirectiveSchema,
);

type Directive = Schema.Schema.Type<typeof DirectiveSchema>;

interface DirectiveLocation {
  readonly path: string;
  readonly line: number;
  readonly exportName: string | null;
}

export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}

