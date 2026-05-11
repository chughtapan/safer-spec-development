/**
 * @specPurpose Directive grammar entry point. Walks TypeScript source via
 *   ts-morph and dispatches each parsed TSDoc block (via `tsdoc-bridge`)
 *   to its per-population parser. Returns the typed `LocatedDirective`
 *   stream.
 *
 *   The population modules (`file-level`, `per-export`, `per-test`)
 *   co-locate each directive's Schema with its parse function. The
 *   `tsdoc-bridge` module owns the TSDoc configuration and the
 *   byte-accurate body extraction.
 */

import { Effect } from "effect";
import { Project, SyntaxKind, type JSDoc, type Node } from "ts-morph";
import {
  type ParseCtx,
  type ParseError,
  JsDocUnknownDirectiveError,
} from "@safer/spec/directives/shared.js";
import {
  parseIgnore,
  parsePurpose,
  type IgnoreFileDirective,
  type PurposeDirective,
} from "@safer/spec/directives/file-level.js";
import {
  parseAssume,
  parseGuarantee,
  parseIgnoreExport,
  parseResidualContract,
  parseSkip,
  type AssumeDirective,
  type GuaranteeDirective,
  type IgnoreExportDirective,
  type ResidualContractDirective,
  type SkipDirective,
} from "@safer/spec/directives/per-export.js";
import {
  parseClaim,
  parseExports,
  parseProperty,
  parseType,
  type ClaimDirective,
  type ExportsDirective,
  type PropertyDirective,
  type TypeDirective,
} from "@safer/spec/directives/per-test.js";
import {
  TSDOC_LOWERCASE_TO_INTERNAL,
  blockSpans,
  firstUndefinedSpecTag,
  offsetToLine,
  parseJsDocText,
  rawBodyBetween,
  rewriteDottedTags,
  type BlockSpan,
} from "@safer/spec/directives/tsdoc-bridge.js";

export {
  DIRECTIVE_BODY_MAX_CHARS,
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
} from "@safer/spec/directives/shared.js";
export { JsDocUnknownDirectiveError } from "@safer/spec/directives/shared.js";
export type { ParseError } from "@safer/spec/directives/shared.js";

export type Directive =
  | PurposeDirective
  | IgnoreFileDirective
  | AssumeDirective
  | GuaranteeDirective
  | ResidualContractDirective
  | SkipDirective
  | IgnoreExportDirective
  | PropertyDirective
  | TypeDirective
  | ExportsDirective
  | ClaimDirective;

interface DirectiveLocation {
  readonly path: string;
  readonly line: number;
  /** null for file-level and per-test directives. */
  readonly exportName: string | null;
}

export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}

type Parser = (ctx: ParseCtx) => Effect.Effect<Directive, ParseError>;

const PARSERS: ReadonlyMap<string, Parser> = new Map<string, Parser>([
  ["purpose", parsePurpose],
  ["ignore", parseIgnore],
  ["assume", parseAssume],
  ["guarantee", parseGuarantee],
  ["residual-contract", parseResidualContract],
  ["skip", parseSkip],
  ["ignore-export", parseIgnoreExport],
  ["property", parseProperty],
  ["type", parseType],
  ["exports", parseExports],
  ["claim", parseClaim],
]);

const FILE_LEVEL_OR_PER_TEST = new Set<Directive["_tag"]>([
  "purpose",
  "ignore",
  "property",
  "type",
  "exports",
  "claim",
]);

const isFileLevelOrPerTest = (d: Directive): boolean =>
  FILE_LEVEL_OR_PER_TEST.has(d._tag);

const enclosingExportName = (jsdoc: JSDoc): string | null => {
  const parent = jsdoc.getParent() as Node | undefined;
  if (parent === undefined) return null;
  // Variable statements hold one or more variable declarations; the export
  // name lives on the inner declaration. Function/class/type aliases carry
  // their own name on the parent itself.
  const varDecls = parent.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  if (varDecls.length > 0) {
    const n = varDecls[0]!.getName();
    if (n.length > 0) return n;
  }
  // ts-morph's NameableNode/NamedNode share a `getName()` method, but the
  // base `Node` type doesn't expose it. Probe by feature without an
  // unsound cast: only call `getName` if the runtime shape has it.
  const probe = parent as { readonly getName?: () => string | undefined };
  if (typeof probe.getName === "function") {
    const n = probe.getName();
    if (n !== undefined && n.length > 0) return n;
  }
  return null;
};

interface JsDocCtx {
  readonly path: string;
  readonly jsdocText: string;
  readonly jsdocStartLine: number;
  readonly exportName: string | null;
}

const lookupParser = (
  span: BlockSpan,
): { readonly internalName: string; readonly parser: Parser } | null => {
  const internalName = TSDOC_LOWERCASE_TO_INTERNAL.get(
    span.block.blockTag.tagName.toLowerCase(),
  );
  if (internalName === undefined) return null;
  const parser = PARSERS.get(internalName);
  if (parser === undefined) return null;
  return { internalName, parser };
};

const parseOneSpan = (
  ctx: JsDocCtx,
  span: BlockSpan,
  nextTagStart: number | null,
): Effect.Effect<LocatedDirective | null, ParseError> =>
  Effect.gen(function* () {
    const lookup = lookupParser(span);
    if (lookup === null) return null;
    const line = offsetToLine(ctx.jsdocText, span.tagStart, ctx.jsdocStartLine);
    const directive = yield* lookup.parser({
      path: ctx.path,
      line,
      name: lookup.internalName,
      rawBody: rawBodyBetween(ctx.jsdocText, span.tagEnd, nextTagStart),
    });
    return {
      directive,
      location: {
        path: ctx.path,
        line,
        exportName: isFileLevelOrPerTest(directive) ? null : ctx.exportName,
      },
    };
  });

const parseOneJsDoc = (
  path: string,
  jsdoc: JSDoc,
): Effect.Effect<readonly LocatedDirective[], ParseError> =>
  Effect.gen(function* () {
    const rawText = rewriteDottedTags(jsdoc.getText());
    const jsdocStartLine = jsdoc.getStartLineNumber();
    const parsed = parseJsDocText(rawText);
    const unknown = firstUndefinedSpecTag(parsed);
    if (unknown !== null) {
      return yield* Effect.fail(
        new JsDocUnknownDirectiveError({
          path,
          line: offsetToLine(rawText, unknown.offset, jsdocStartLine),
          directive: unknown.name,
        }),
      );
    }
    const ctx: JsDocCtx = {
      path,
      jsdocText: rawText,
      jsdocStartLine,
      exportName: enclosingExportName(jsdoc),
    };
    const spans = blockSpans(parsed.docComment.customBlocks);
    const out: LocatedDirective[] = [];
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i]!;
      const next = spans[i + 1]?.tagStart ?? null;
      const located = yield* parseOneSpan(ctx, span, next);
      if (located !== null) out.push(located);
    }
    return out;
  });

/**
 * @specGuarantee "every emitted directive validates against the closed grammar before downstream consumption"
 *   reason: trust-boundary; agents consume parsed directive bodies as context.
 */
export const parseFileDirectives = (
  path: string,
  source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, ParseError> =>
  Effect.gen(function* () {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile(path, source, { overwrite: true });
    const located: LocatedDirective[] = [];
    for (const jsdoc of sf.getDescendantsOfKind(SyntaxKind.JSDoc)) {
      const blocks = yield* parseOneJsDoc(path, jsdoc);
      for (const b of blocks) located.push(b);
    }
    return located;
  }).pipe(Effect.withSpan("spec/directives/parseFileDirectives"));
