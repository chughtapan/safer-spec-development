/**
 * @spec.purpose Closed grammar for `@spec.*` JSDoc directives. The directive
 *   surface has three populations per DESIGN.md "Section Population Rules"
 *   and the parent epic's Amendment 6:
 *
 *     File-level (on `index.ts` barrels):
 *       @spec.purpose <one-line>
 *       @spec.ignore                          (escape hatch, file-level)
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
 *   Schema constructors stay private to this module per
 *   agent-code-guard/no-exported-brand-constructor; downstream callers consume
 *   the derived `Directive` type and its location-tagged wrapper.
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

// --- File-level directives (on index.ts barrels) ---

const PurposeDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("purpose"),
  body: Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS)),
});

const IgnoreFileDirectiveSchema = Schema.Struct({
  _tag: Schema.Literal("ignore"),
});

// --- Per-export directives (on public-surface declarations) ---

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

// --- Per-test directives (above each itSpec.prop/itSpec.todo call) — Amendment 6 ---

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

// --- Union ---

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

type Directive = Schema.Schema.Type<typeof DirectiveSchema>;

/**
 * Anchor a directive to the source position it was parsed from. The
 * `exportName` field is null for file-level (`@spec.purpose`,
 * `@spec.ignore`) and per-test directives.
 */
interface DirectiveLocation {
  readonly path: string;
  readonly line: number;
  readonly exportName: string | null;
}

export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}
