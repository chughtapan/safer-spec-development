/**
 * @spec.purpose `@microsoft/tsdoc` adapter layer. Owns the TSDoc
 *   configuration (closed set of `@specXxx` block-tag definitions), the
 *   parser singleton, the TSDoc-tag ↔ internal-name map, and the byte-
 *   accurate body extraction that bypasses TSDoc's content tree (so
 *   embedded `@`-references and angle-bracketed placeholders in prose
 *   bodies survive intact).
 */

import {
  TSDocParser,
  TSDocConfiguration,
  TSDocTagDefinition,
  TSDocTagSyntaxKind,
  type DocBlock,
  type ParserContext,
} from "@microsoft/tsdoc";

/**
 * Bidirectional map between TSDoc camelCase tag names and the short
 * internal names that per-population parsers and `_tag` Schema literals
 * use.
 */
const TAG_MAP = [
  { tsdoc: "@specPurpose", internal: "purpose" },
  { tsdoc: "@specIgnore", internal: "ignore" },
  { tsdoc: "@specAssume", internal: "assume" },
  { tsdoc: "@specGuarantee", internal: "guarantee" },
  { tsdoc: "@specResidualContract", internal: "residual-contract" },
  { tsdoc: "@specSkip", internal: "skip" },
  { tsdoc: "@specIgnoreExport", internal: "ignore-export" },
  { tsdoc: "@specProperty", internal: "property" },
  { tsdoc: "@specType", internal: "type" },
  { tsdoc: "@specExports", internal: "exports" },
  { tsdoc: "@specClaim", internal: "claim" },
] as const;

/** TSDoc lowercases tagName; lookups normalize to match. */
export const TSDOC_LOWERCASE_TO_INTERNAL: ReadonlyMap<string, string> = new Map(
  TAG_MAP.map(({ tsdoc, internal }) => [tsdoc.toLowerCase(), internal]),
);

const buildTsdocConfig = (): TSDocConfiguration => {
  const cfg = new TSDocConfiguration();
  for (const { tsdoc } of TAG_MAP) {
    cfg.addTagDefinition(
      new TSDocTagDefinition({
        tagName: tsdoc,
        syntaxKind: TSDocTagSyntaxKind.BlockTag,
        allowMultiple: true,
      }),
    );
  }
  return cfg;
};

const TSDOC_CONFIG = buildTsdocConfig();
const TSDOC_PARSER = new TSDocParser(TSDOC_CONFIG);

export const parseJsDocText = (rawText: string): ParserContext =>
  TSDOC_PARSER.parseString(rawText);

export interface BlockSpan {
  readonly block: DocBlock;
  /** Offset of the `@` in `@specXxx` within the raw JSDoc text. */
  readonly tagStart: number;
  /** Offset immediately after the tag name (where body content begins). */
  readonly tagEnd: number;
}

export const blockSpans = (
  blocks: readonly DocBlock[],
): readonly BlockSpan[] =>
  blocks.map((block) => {
    const tokens = block.blockTag.getTokenSequence().tokens;
    const first = tokens[0];
    const last = tokens.at(-1);
    if (first === undefined || last === undefined) {
      return { block, tagStart: 0, tagEnd: 0 };
    }
    return {
      block,
      tagStart: first.range.pos,
      tagEnd: last.range.end,
    };
  });

const STRIP_JSDOC_PREFIX_RE = /^[\t ]{0,16}\*[\t ]?/;
const STRIP_TRAILING_COMMENT_CLOSE_RE = /[\t\n ]{0,16}\*\/[\t ]{0,16}$/;

/**
 * Slice the raw JSDoc text between this block's tag end and the next
 * block's tag start (or end of comment). Strips per-line JSDoc
 * continuation prefix (`* `) without consuming embedded `@`-references
 * or angle-bracketed placeholders that TSDoc's content tree would
 * otherwise interpret.
 */
export const rawBodyBetween = (
  rawText: string,
  thisTagEnd: number,
  nextTagStart: number | null,
): string => {
  const end = nextTagStart ?? rawText.length;
  let slice = rawText.slice(thisTagEnd, end);
  if (nextTagStart === null) {
    slice = slice.replace(STRIP_TRAILING_COMMENT_CLOSE_RE, "");
  }
  return slice
    .split("\n")
    .map((line) => line.replace(STRIP_JSDOC_PREFIX_RE, ""))
    .join("\n")
    .trim();
};

const TSDOC_UNDEFINED_TAG_ID = "tsdoc-undefined-tag";
// Malformed dotted spec tags (e.g. `@spec.residual_contract` with `_`
// instead of `-`) bypass `rewriteDottedTags` and reach TSDoc as `@spec`
// followed by invalid characters; TSDoc emits this message rather than
// `tsdoc-undefined-tag`. Surface it as JsDocUnknownDirectiveError too so
// the closed-grammar promise actually holds.
const TSDOC_CHARS_AFTER_TAG_ID = "tsdoc-characters-after-block-tag";
const SPEC_TAG_TEXT_RE = /@(spec[A-Za-z._-]{0,32})/;

export interface UndefinedTagHit {
  readonly name: string;
  readonly offset: number;
}

const SPEC_TAG_ERROR_IDS: ReadonlySet<string> = new Set([
  TSDOC_UNDEFINED_TAG_ID,
  TSDOC_CHARS_AFTER_TAG_ID,
]);

const matchUndefinedSpecTag = (
  msg: ParserContext["log"]["messages"][number],
): UndefinedTagHit | null => {
  if (!SPEC_TAG_ERROR_IDS.has(msg.messageId)) return null;
  const m = SPEC_TAG_TEXT_RE.exec(msg.tokenSequence?.toString() ?? "");
  if (m === null) return null;
  return {
    name: m[1]!,
    offset: msg.tokenSequence?.tokens[0]?.range.pos ?? msg.textRange.pos,
  };
};

/**
 * Surface only undefined `@spec*` tags from TSDoc's parser log. TSDoc
 * emits "tsdoc-undefined-tag" warnings exclusively for tags at block-tag
 * position; references in prose or backticked code spans never trigger
 * the message, so prose mentions are correctly ignored.
 */
export const firstUndefinedSpecTag = (
  parsed: ParserContext,
): UndefinedTagHit | null => {
  for (const msg of parsed.log.messages) {
    const hit = matchUndefinedSpecTag(msg);
    if (hit !== null) return hit;
  }
  return null;
};

// After `rewriteDottedTags` runs, any remaining `@spec.<…>` at a block-tag
// position is malformed — the rewrite handles only `[a-z][a-z-]*` bodies,
// so `@spec.foo_bar`, `@spec.foo.bar`, `@spec.Type`, etc. survive in
// dotted form. TSDoc treats those as `@spec` + invalid trailing chars or
// truncates the token, so the parser-message path misses them. Catch
// them with a direct scan so malformed directives fail closed.
const MALFORMED_DOTTED_SPEC_RE =
  /(?:^[\t ]*\*[\t ]?|^\/\*\*[\t ]?)@spec\.\S+/gm;

export const firstMalformedDottedSpecTag = (
  rewrittenText: string,
): UndefinedTagHit | null => {
  MALFORMED_DOTTED_SPEC_RE.lastIndex = 0;
  const m = MALFORMED_DOTTED_SPEC_RE.exec(rewrittenText);
  if (m === null) return null;
  const atPos = m.index + m[0].indexOf("@");
  return { name: rewrittenText.slice(atPos + 1, m.index + m[0].length), offset: atPos };
};

// First block-tag-position `@<letter>` start in `rawText` at offset
// >= `from`. A block tag = `@` at the start of the JSDoc opener
// (`/**`) or immediately after a continuation prefix (`\n[\t ]*\*[\t ]?`).
// Used by the directive parser to bound a spec block's body at the next
// JSDoc tag regardless of whether that tag is a `@spec*` block or a
// standard `@param`/`@returns`/etc.
const BLOCK_TAG_RE = /(?:^|\n)[\t ]*(?:\*[\t ]?)?(@[A-Za-z])/g;

export const nextBlockTagStart = (rawText: string, from: number): number | null => {
  BLOCK_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCK_TAG_RE.exec(rawText)) !== null) {
    const atPos = m.index + m[0].lastIndexOf("@");
    if (atPos >= from) return atPos;
  }
  return null;
};

export const offsetToLine = (
  text: string,
  offset: number,
  baseLine: number,
): number => {
  const limit = Math.min(offset, text.length);
  let newlines = 0;
  for (let i = 0; i < limit; i++) {
    if (text.charCodeAt(i) === 10) newlines++;
  }
  return baseLine + newlines;
};

const DOTTED_TAG_AT_TAG_POSITION_RE =
  /(^[\t ]*\*[\t ]*|^\/\*\*[\t ]*)@spec\.([a-z][a-z-]*)/gm;

const hyphensToCamel = (body: string): string =>
  body.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Rewrites dotted spec tags (`@spec.purpose`, `@spec.residual-contract`) to
 * the TSDoc-conformant camelCase form ONLY at block-tag positions — the
 * first non-whitespace token on a JSDoc continuation line (after `* `) or
 * immediately after the `/**` opener. Mentions inside prose (e.g.
 * `` `@spec.skip` `` in a Purpose paragraph) are left intact so the
 * rendered MODULE.md prose stays faithful to the author's text.
 *
 * The rewrite is length-reducing; byte offsets shift left but newline
 * positions are preserved. Downstream `offsetToLine` and `rawBodyBetween`
 * remain consistent as long as the SAME rewritten text is used for both
 * TSDoc parsing AND raw-body slicing.
 */
export const rewriteDottedTags = (text: string): string =>
  text.replace(
    DOTTED_TAG_AT_TAG_POSITION_RE,
    (_match, prefix: string, body: string) => {
      const camel = hyphensToCamel(body);
      return `${prefix}@spec${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
    },
  );
