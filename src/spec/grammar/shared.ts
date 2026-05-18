/**
 * @spec.purpose Shared infrastructure for the per-population directive
 *   modules: size caps, the `ParseError` union, the three tagged errors
 *   the parser can emit, and the small string helpers each population
 *   uses (unquote, splitReason).
 */

 

import { Data, Effect, Schema } from "effect";

/**
 * @spec.guarantee "the value is 500 — the documented trust-boundary cap on directive bodies (assume/guarantee/residual-contract/skip reasons/claim) routed as agent context"
 *   reason: stable across the codemod and downstream consumers; the
 *           cap is enforced by the `Capped` schema in the same file.
 * @spec.skip "Roundtrip"
 *   reason: numeric constant; no encode/decode pair.
 * @spec.skip "Partial Roundtrip"
 *   reason: numeric constant; no normalize-then-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: constant value; no alternative path to derive it.
 * @spec.skip "Constant Non-Equality"
 *   reason: a single constant value; no distinct-output invariant applies.
 * @spec.skip "Exception Raising"
 *   reason: a constant; cannot fail.
 */
export const DIRECTIVE_BODY_MAX_CHARS = 500;

/**
 * Larger cap for `@spec.purpose` — paragraph-scale documentation, not a
 * trust-boundary residue.
 */
export const PURPOSE_BODY_MAX_CHARS = 5000;

export const Capped = Schema.String.pipe(Schema.maxLength(DIRECTIVE_BODY_MAX_CHARS));
export const CappedPurpose = Schema.String.pipe(Schema.maxLength(PURPOSE_BODY_MAX_CHARS));

/**
 * @spec.skip "Roundtrip"
 *   reason: tagged error class; the symmetric path is the parser raising the error from a JSDoc body.
 * @spec.skip "Partial Roundtrip"
 *   reason: no normalize-then-recover relation on the carried fields.
 * @spec.skip "Commutative Paths"
 *   reason: single constructor.
 * @spec.skip "Constant Non-Equality"
 *   reason: distinct overflows can produce identical (path, line, directive, length, limit) tuples.
 * @spec.skip "Inclusion"
 *   reason: not a collection.
 */
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
 * @spec.skip "Partial Roundtrip"
 *   reason: tagged error class; no normalize-then-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: single constructor.
 * @spec.skip "Constant Bounds Checking"
 *   reason: reason field is free-form and not length-bounded.
 * @spec.skip "Constant Non-Equality"
 *   reason: distinct parse failures can produce identical reason strings.
 * @spec.skip "Inclusion"
 *   reason: not a collection.
 */
export class JsDocDirectiveParseError extends Data.TaggedError(
  "JsDocDirectiveParseError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly reason: string;
}> {}

/**
 * @spec.skip "Partial Roundtrip"
 *   reason: tagged error class; no normalize-then-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: single constructor.
 * @spec.skip "Constant Bounds Checking"
 *   reason: directive string is user-controlled and length-unbounded.
 * @spec.skip "Constant Non-Equality"
 *   reason: distinct unknown directives can collapse to the same string after normalization.
 * @spec.skip "Inclusion"
 *   reason: not a collection.
 */
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
 * Split a body into (head, reason) at the first `reason:` keyword. Both
 * inline form (`@spec.skip "X" reason: &lt;why>`, single line) and the
 * multi-line form (`@spec.skip "X"\n  reason: &lt;why>`) are accepted.
 *
 * Parts are normalized to single-line form: continuation indentation
 * from JSDoc source (extra spaces after `* `) is collapsed so the
 * rendered SPEC.md doesn't carry whitespace residue from the comment
 * formatting.
 */
export const splitReason = (
  rawBody: string,
): { readonly head: string; readonly reason: string } => {
  const idx = findReasonIndex(rawBody);
  if (idx === null) {
    return { head: collapseWhitespace(rawBody), reason: "" };
  }
  return {
    head: collapseWhitespace(rawBody.slice(0, idx.start)),
    reason: collapseWhitespace(rawBody.slice(idx.afterColon)),
  };
};

const REASON_KEY = "reason:";

// Linear scan for `reason:` preceded by either a newline (with optional
// indent) or one-or-more spaces. Returns the start of the boundary plus
// the offset just past the colon and any post-colon whitespace.
// Linear-time so it doesn't trigger sonarjs/slow-regex.
const findReasonIndex = (
  body: string,
): { readonly start: number; readonly afterColon: number } | null => {
  let i = 0;
  while (i < body.length) {
    const found = body.indexOf(REASON_KEY, i);
    if (found < 0) return null;
    const boundary = scanBoundaryBefore(body, found);
    if (boundary !== null) {
      const afterColon = skipPostColonWhitespace(body, found + REASON_KEY.length);
      return { start: boundary, afterColon };
    }
    i = found + 1;
  }
  return null;
};

// True boundary = either a newline with any number of horizontal-whitespace
// chars after it, OR one-or-more spaces inline. Returns the index where the
// boundary starts (caller slices `head = body[..start]`).
const isLeftEdge = (body: string, i: number): boolean =>
  i < 0 || body.charCodeAt(i) === 10; // newline or start-of-buffer

// Boundary is valid if EITHER we consumed ≥1 horizontal-whitespace char
// (inline form: `claim" reason: y`) OR a newline / start-of-buffer sits
// immediately before the run (bare-newline form: `claim"\nreason: y`).
const scanBoundaryBefore = (body: string, found: number): number | null => {
  let i = found - 1;
  while (i >= 0 && isHWhite(body.charCodeAt(i))) i -= 1;
  const consumed = i + 1 < found;
  if (!consumed && !isLeftEdge(body, i)) return null;
  return Math.max(i + 1, 0);
};

const skipPostColonWhitespace = (body: string, start: number): number => {
  let i = start;
  while (i < body.length && isHWhite(body.charCodeAt(i))) i += 1;
  return i;
};

const isHWhite = (ch: number): boolean => ch === 9 /* "\t" */ || ch === 32; /* " " */

const collapseWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();
