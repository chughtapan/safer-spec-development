/**
 * @spec.purpose Per-test directives — `@spec.property`, `@spec.type`,
 *   `@spec.exports`, `@spec.claim`. These attach above each
 *   `itSpec.prop`/`itSpec.todo` call site; the parser records
 *   `location.exportName` as `null`.
 */

import { Effect, Schema } from "effect";
import { PROPERTY_TYPES, type PropertyType } from "@safer/property-types/index.js";
import {
  Capped,
  DIRECTIVE_BODY_MAX_CHARS,
  type ParseCtx,
  type ParseError,
  checkBodyLen,
  failParse,
  unquote,
} from "@safer/spec/directives/shared.js";

const PropertyTypeSchema = Schema.Literal(...PROPERTY_TYPES);

const PropertyDirectiveSchema = Schema.TaggedStruct("property", {
  id: Capped,
});
export type PropertyDirective = Schema.Schema.Type<typeof PropertyDirectiveSchema>;

const TypeDirectiveSchema = Schema.TaggedStruct("type", {
  propertyType: PropertyTypeSchema,
});
export type TypeDirective = Schema.Schema.Type<typeof TypeDirectiveSchema>;

const ExportsDirectiveSchema = Schema.TaggedStruct("exports", {
  symbols: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
});
export type ExportsDirective = Schema.Schema.Type<typeof ExportsDirectiveSchema>;

const ClaimDirectiveSchema = Schema.TaggedStruct("claim", {
  body: Capped,
});
export type ClaimDirective = Schema.Schema.Type<typeof ClaimDirectiveSchema>;

const isPropertyType = (s: string): s is PropertyType =>
  (PROPERTY_TYPES as readonly string[]).includes(s);

export const parseProperty = (
  ctx: ParseCtx,
): Effect.Effect<PropertyDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const head = ctx.rawBody.trim();
    if (head.length === 0) return yield* failParse(ctx, "missing property id");
    return PropertyDirectiveSchema.make({ id: head });
  }).pipe(Effect.withSpan("spec/directives/parseProperty"));

export const parseType = (
  ctx: ParseCtx,
): Effect.Effect<TypeDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const pt = unquote(ctx.rawBody.trim());
    if (!isPropertyType(pt))
      return yield* failParse(ctx, `unknown PropertyType: ${pt}`);
    return TypeDirectiveSchema.make({ propertyType: pt });
  }).pipe(Effect.withSpan("spec/directives/parseType"));

export const parseExports = (
  ctx: ParseCtx,
): Effect.Effect<ExportsDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const symbols = ctx.rawBody
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (symbols.length === 0)
      return yield* failParse(ctx, "missing export names");
    return ExportsDirectiveSchema.make({ symbols });
  }).pipe(Effect.withSpan("spec/directives/parseExports"));

export const parseClaim = (
  ctx: ParseCtx,
): Effect.Effect<ClaimDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const head = ctx.rawBody.trim();
    if (head.length === 0) return yield* failParse(ctx, "missing claim text");
    return ClaimDirectiveSchema.make({ body: head });
  }).pipe(Effect.withSpan("spec/directives/parseClaim"));
