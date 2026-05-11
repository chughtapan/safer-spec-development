/**
 * @spec.purpose Closed grammar for `@spec.*` JSDoc directives. The 5-directive
 *   surface defined in the design doc's "Directive Syntax (closed set of 5)"
 *   section.
 *
 * @spec.guarantee Directive body length is capped at DIRECTIVE_BODY_MAX_CHARS;
 *   parser emits `JsDocDirectiveOverflowError` on overflow.
 *   reason: trust-boundary defense against prompt-injection via residual
 *           contracts.
 */

import { Schema } from "effect";
import { KINDS } from "../kinds.js";

export const DIRECTIVE_BODY_MAX_CHARS = 500;

export const DIRECTIVE_NAMES = [
  "purpose",
  "skip",
  "residual-contract",
  "assume",
  "guarantee",
  "ignore",
  "ignore-export",
] as const;

export type DirectiveName = (typeof DIRECTIVE_NAMES)[number];

const KindSchema = Schema.Literal(...KINDS);

export const PurposeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("purpose"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

export const SkipDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("skip"),
  kind: KindSchema,
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

export const ResidualContractDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("residual-contract"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

export const AssumeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("assume"),
  claim: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

export const GuaranteeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("guarantee"),
  claim: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

export const IgnoreFileDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore"),
});

export const IgnoreExportDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore-export"),
  exportName: Schema.String,
  reason: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

export const DirectiveSchema = Schema.Union(
  PurposeDirectiveSchema,
  SkipDirectiveSchema,
  ResidualContractDirectiveSchema,
  AssumeDirectiveSchema,
  GuaranteeDirectiveSchema,
  IgnoreFileDirectiveSchema,
  IgnoreExportDirectiveSchema,
);

export type Directive = Schema.Schema.Type<typeof DirectiveSchema>;

export interface DirectiveLocation {
  readonly path: string;
  readonly line: number;
  readonly exportName: string | null;
}

export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}
