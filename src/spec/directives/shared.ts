/**
 * @spec.purpose Shared infrastructure for the per-population directive
 *   modules: size caps, the `ParseError` union, the three tagged errors
 *   the parser can emit, and the small string helpers each population
 *   uses (unquote, splitReason).
 */

/* eslint-disable max-classes-per-file -- the three closely-related
   directive parse errors live in one file because they share the same
   payload shape and lifecycle. */

import { Data, Effect, Schema } from "effect";

/**
 * Trust-boundary cap on directive bodies routed as agent context
 * (assume / guarantee / residual-contract / skip reasons / per-test
 * claim).
 */
export const DIRECTIVE_BODY_MAX_CHARS = 500;

/**
 * Larger cap for `@spec.purpose` — paragraph-scale documentation, not a
 * trust-boundary residue.
 */
export const PURPOSE_BODY_MAX_CHARS = 5000;

export const Capped = Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS));
export const CappedPurpose = Schema.String.pipe(Schema.maxLength(PURPOSE_BODY_MAX_CHARS));

export class JsDocDirectiveOverflowError extends Data.TaggedError(
  "JsDocDirectiveOverflowError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly length: number;
  readonly limit: number;
}> {}

export class JsDocDirectiveParseError extends Data.TaggedError(
  "JsDocDirectiveParseError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly reason: string;
}> {}

export class JsDocUnknownDirectiveError extends Data.TaggedError(
  "JsDocUnknownDirectiveError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}> {}

export type ParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;

export interface ParseCtx {
  readonly path: string;
  readonly line: number;
  readonly name: string;
  readonly rawBody: string;
}

export const failParse = (
  ctx: ParseCtx,
  reason: string,
): Effect.Effect<never, JsDocDirectiveParseError> =>
  Effect.fail(
    new JsDocDirectiveParseError({
      path: ctx.path,
      line: ctx.line,
      directive: ctx.name,
      reason,
    }),
  );

export const checkBodyLen = (
  ctx: ParseCtx,
  cap: number,
): Effect.Effect<void, JsDocDirectiveOverflowError> =>
  ctx.rawBody.length > cap
    ? Effect.fail(
        new JsDocDirectiveOverflowError({
          path: ctx.path,
          line: ctx.line,
          directive: ctx.name,
          length: ctx.rawBody.length,
          limit: cap,
        }),
      )
    : Effect.succeed(void 0);

/** Strip surrounding double-quotes from a body if present. */
export const unquote = (s: string): string => {
  if (s.length < 2) return s;
  if (s.charAt(0) !== '"' || s.charAt(s.length - 1) !== '"') return s;
  return s.slice(1, -1);
};

/**
 * Split a body into (head, reason) at the first `reason:` line. Both
 * parts are normalized to single-line form: continuation indentation
 * from JSDoc source (extra spaces after `* `) is collapsed so the
 * rendered SPEC.md doesn't carry whitespace residue from the comment
 * formatting.
 */
export const splitReason = (
  rawBody: string,
): { readonly head: string; readonly reason: string } => {
  const m = /\n[\t ]*reason:[\t ]*/.exec(rawBody);
  if (m === null || m.index === undefined) {
    return { head: collapseWhitespace(rawBody), reason: "" };
  }
  return {
    head: collapseWhitespace(rawBody.slice(0, m.index)),
    reason: collapseWhitespace(rawBody.slice(m.index + m[0].length)),
  };
};

const collapseWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();
