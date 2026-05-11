/**
 * @specPurpose `@microsoft/tsdoc` adapter layer. Owns the TSDoc
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
const SPEC_TAG_TEXT_RE = /@(spec[A-Za-z]{0,32})/;

export interface UndefinedTagHit {
  readonly name: string;
  readonly offset: number;
}

const matchUndefinedSpecTag = (
  msg: ParserContext["log"]["messages"][number],
): UndefinedTagHit | null => {
  if (msg.messageId !== TSDOC_UNDEFINED_TAG_ID) return null;
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
