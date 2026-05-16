/**
 * @spec.purpose Per-export directives — `@spec.assume`, `@spec.guarantee`,
 *   `@spec.residual-contract`, `@spec.skip`, `@spec.ignore-export`.
 *   These attach to public-surface exported declarations; the parser
 *   records the declaration's name in `location.exportName`. Each
 *   directive in this population carries a required `reason:` line.
 */

import { Effect, Schema } from "effect";
import { PROPERTY_TYPES, type PropertyType } from "@safer/spec/grammar/property-types.js";
import {
  Capped,
  DIRECTIVE_BODY_MAX_CHARS,
  type ParseCtx,
  type ParseError,
  checkBodyLen,
  failParse,
  splitReason,
  unquote,
} from "@safer/spec/grammar/shared.js";

const PropertyTypeSchema = Schema.Literal(...PROPERTY_TYPES);

const AssumeDirectiveSchema = Schema.TaggedStruct("assume", {
  claim: Capped,
  reason: Capped,
});
export type AssumeDirective = Schema.Schema.Type<typeof AssumeDirectiveSchema>;

const GuaranteeDirectiveSchema = Schema.TaggedStruct("guarantee", {
  claim: Capped,
  reason: Capped,
});
export type GuaranteeDirective = Schema.Schema.Type<typeof GuaranteeDirectiveSchema>;

const ResidualContractDirectiveSchema = Schema.TaggedStruct("residual-contract", {
  body: Capped,
  reason: Capped,
});
export type ResidualContractDirective = Schema.Schema.Type<typeof ResidualContractDirectiveSchema>;

const SkipDirectiveSchema = Schema.TaggedStruct("skip", {
  propertyType: PropertyTypeSchema,
  reason: Capped,
});
export type SkipDirective = Schema.Schema.Type<typeof SkipDirectiveSchema>;

const IgnoreExportDirectiveSchema = Schema.TaggedStruct("ignore-export", {
  exportName: Schema.String,
  reason: Capped,
});
export type IgnoreExportDirective = Schema.Schema.Type<typeof IgnoreExportDirectiveSchema>;

const requireReason = (
  ctx: ParseCtx,
  reason: string,
): Effect.Effect<string, ParseError> =>
  reason.length > 0
    ? Effect.succeed(reason)
    : failParse(ctx, "missing `reason:` line");

const requireHead = (
  ctx: ParseCtx,
  head: string,
  what: string,
): Effect.Effect<string, ParseError> =>
  head.length > 0 ? Effect.succeed(head) : failParse(ctx, `missing ${what}`);

const isPropertyType = (s: string): s is PropertyType =>
  (PROPERTY_TYPES as readonly string[]).includes(s);

export const parseAssume = (
  ctx: ParseCtx,
): Effect.Effect<AssumeDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const { head, reason } = splitReason(ctx.rawBody);
    const claim = yield* requireHead(ctx, head, "claim");
    const r = yield* requireReason(ctx, reason);
    return AssumeDirectiveSchema.make({ claim: unquote(claim), reason: r });
  }).pipe(Effect.withSpan("spec/directives/parseAssume"));

export const parseGuarantee = (
  ctx: ParseCtx,
): Effect.Effect<GuaranteeDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const { head, reason } = splitReason(ctx.rawBody);
    const claim = yield* requireHead(ctx, head, "claim");
    const r = yield* requireReason(ctx, reason);
    return GuaranteeDirectiveSchema.make({ claim: unquote(claim), reason: r });
  }).pipe(Effect.withSpan("spec/directives/parseGuarantee"));

export const parseResidualContract = (
  ctx: ParseCtx,
): Effect.Effect<ResidualContractDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const { head, reason } = splitReason(ctx.rawBody);
    const body = yield* requireHead(ctx, head, "body");
    const r = yield* requireReason(ctx, reason);
    return ResidualContractDirectiveSchema.make({ body: unquote(body), reason: r });
  }).pipe(Effect.withSpan("spec/directives/parseResidualContract"));

export const parseSkip = (
  ctx: ParseCtx,
): Effect.Effect<SkipDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const { head, reason } = splitReason(ctx.rawBody);
    const r = yield* requireReason(ctx, reason);
    const pt = unquote(head);
    if (!isPropertyType(pt))
      return yield* failParse(ctx, `unknown PropertyType: ${pt}`);
    return SkipDirectiveSchema.make({ propertyType: pt, reason: r });
  }).pipe(Effect.withSpan("spec/directives/parseSkip"));

export const parseIgnoreExport = (
  ctx: ParseCtx,
): Effect.Effect<IgnoreExportDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, DIRECTIVE_BODY_MAX_CHARS);
    const { head, reason } = splitReason(ctx.rawBody);
    const exportName = yield* requireHead(ctx, head, "export name");
    const r = yield* requireReason(ctx, reason);
    return IgnoreExportDirectiveSchema.make({ exportName, reason: r });
  }).pipe(Effect.withSpan("spec/directives/parseIgnoreExport"));
