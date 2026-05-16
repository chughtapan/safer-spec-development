/**
 * @spec.purpose File-level directives — `@spec.purpose` and `@spec.ignore`.
 *   These attach to `index.ts` barrels; the parser treats their location
 *   `exportName` as `null`.
 */

import { Effect, Schema } from "effect";
import {
  CappedPurpose,
  type ParseCtx,
  type ParseError,
  checkBodyLen,
  failParse,
  PURPOSE_BODY_MAX_CHARS,
} from "@safer/spec/grammar/shared.js";

const PurposeDirectiveSchema = Schema.TaggedStruct("purpose", {
  body: CappedPurpose,
});
export type PurposeDirective = Schema.Schema.Type<typeof PurposeDirectiveSchema>;

const IgnoreFileDirectiveSchema = Schema.TaggedStruct("ignore", {});
export type IgnoreFileDirective = Schema.Schema.Type<typeof IgnoreFileDirectiveSchema>;

/**
 * Lines beginning a markdown block element: list items, blockquotes,
 * headings, fenced code, tables. Such lines stay on their own line and
 * never absorb a continuation from a previous prose line.
 */
const BLOCK_START_RE = /^(-|\*|\+|\d+\.|>|#|\||```)\s?/;

/**
 * Collapse JSDoc soft-wrap newlines inside prose paragraphs while
 * preserving real markdown structure. Consecutive non-block lines join
 * into one line (collapsing source column wrapping); blank lines remain
 * paragraph breaks; lines that open a markdown block stay independent.
 */
const canJoinProse = (line: string, prev: string | undefined): boolean => {
  if (line.length === 0 || BLOCK_START_RE.test(line)) return false;
  if (prev === undefined || prev.length === 0) return false;
  return !BLOCK_START_RE.test(prev);
};

const normalizePurpose = (body: string): string => {
  const lines = body.split("\n").map((l) => l.trimStart());
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (canJoinProse(line, prev)) {
      out[out.length - 1] = `${prev!} ${line}`;
    } else {
      out.push(line);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

export const parsePurpose = (
  ctx: ParseCtx,
): Effect.Effect<PurposeDirective, ParseError> =>
  Effect.gen(function* () {
    yield* checkBodyLen(ctx, PURPOSE_BODY_MAX_CHARS);
    const body = normalizePurpose(ctx.rawBody);
    if (body.length === 0) return yield* failParse(ctx, "missing body");
    return PurposeDirectiveSchema.make({ body });
  }).pipe(Effect.withSpan("spec/directives/parsePurpose"));

export const parseIgnore = (
  _ctx: ParseCtx,
): Effect.Effect<IgnoreFileDirective, ParseError> =>
  Effect.succeed(IgnoreFileDirectiveSchema.make({})).pipe(
    Effect.withSpan("spec/directives/parseIgnore"),
  );
