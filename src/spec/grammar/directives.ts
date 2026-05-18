/**
 * @spec.purpose Directive grammar entry point. Walks TypeScript source via
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
import { Node as TsNode, Project, SyntaxKind, type JSDoc, type Node } from "ts-morph";
import {
  type ParseCtx,
  type ParseError,
  JsDocUnknownDirectiveError,
} from "@safer/spec/grammar/shared.js";
import {
  parseIgnore,
  parsePurpose,
  type IgnoreFileDirective,
  type PurposeDirective,
} from "@safer/spec/grammar/file-level.js";
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
} from "@safer/spec/grammar/per-export.js";
import {
  parseClaim,
  parseExports,
  parseProperty,
  parseType,
  type ClaimDirective,
  type ExportsDirective,
  type PropertyDirective,
  type TypeDirective,
} from "@safer/spec/grammar/per-test.js";
import {
  TSDOC_LOWERCASE_TO_INTERNAL,
  blockSpans,
  firstMalformedDottedSpecTag,
  nextBlockTagStart,
  firstUndefinedSpecTag,
  offsetToLine,
  parseJsDocText,
  rawBodyBetween,
  rewriteDottedTags,
  type BlockSpan,
} from "@safer/spec/grammar/tsdoc-bridge.js";

export {
  DIRECTIVE_BODY_MAX_CHARS,
  JsDocDirectiveOverflowError,
  JsDocDirectiveParseError,
} from "@safer/spec/grammar/shared.js";
export { JsDocUnknownDirectiveError } from "@safer/spec/grammar/shared.js";
export type { ParseError } from "@safer/spec/grammar/shared.js";

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

// Variable statements hold their declarations as direct children of a
// VariableDeclarationList; we use getChildrenOfKind (NOT
// getDescendantsOfKind) so local `const`s inside an exported function/class
// body don't get picked up.
const firstVarDeclName = (parent: Node): string | null => {
  for (const list of parent.getChildrenOfKind(SyntaxKind.VariableDeclarationList)) {
    for (const d of list.getChildrenOfKind(SyntaxKind.VariableDeclaration)) {
      const n = d.getName();
      if (n.length > 0) return n;
    }
  }
  return null;
};

// Function/class/type aliases carry their own name on the parent. ts-morph's
// NameableNode/NamedNode share `getName()`; the base `Node` doesn't expose
// it. Feature-probe to avoid an unsound cast.
const namedNodeName = (parent: Node): string | null => {
  const probe = parent as { readonly getName?: () => string | undefined };
  if (typeof probe.getName !== "function") return null;
  const n = probe.getName();
  return n !== undefined && n.length > 0 ? n : null;
};

// Anonymous default exports (`export default function () {}`,
// `export default class {}`, `export default <expr>`) carry no name on
// the declaration node, so namedNodeName/firstVarDeclName both fall
// through. ts-morph's `getExportedDeclarations()` maps these under the
// public name `default`; returning that string here lets directive
// lookup in `buildExportEntries` reach the matching entry.
const isDefaultExport = (node: Node): boolean => {
  if (TsNode.isExportAssignment(node)) return true;
  const probe = node as { readonly hasDefaultKeyword?: () => boolean };
  return typeof probe.hasDefaultKeyword === "function" && probe.hasDefaultKeyword();
};

// Member nodes (method/property signatures or implementations inside an
// interface/class) carry their own name, but per-export directives are
// supposed to bind to the CONTAINING declaration, not the member. Walk
// up past these to the enclosing exportable node.
const MEMBER_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.MethodSignature,
  SyntaxKind.PropertySignature,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.PropertyDeclaration,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
]);
const isMember = (node: Node): boolean => MEMBER_KINDS.has(node.getKind());

const enclosingExportName = (jsdoc: JSDoc): string | null => {
  let parent: Node | undefined = jsdoc.getParent() as Node | undefined;
  while (parent !== undefined && isMember(parent)) {
    parent = parent.getParent();
  }
  if (parent === undefined) return null;
  const direct = firstVarDeclName(parent) ?? namedNodeName(parent);
  if (direct !== null) return direct;
  return isDefaultExport(parent) ? "default" : null;
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
    // Pre-flight: any `@spec.<…>` left in dotted form after the rewrite
    // is a malformed directive name. The rewrite only handles
    // `[a-z][a-z-]*` bodies; underscores, uppercase, and double-dotted
    // forms slip through to TSDoc as something it can't classify as a
    // tag, so the parser-message path doesn't always surface them.
    const malformed = firstMalformedDottedSpecTag(rawText);
    if (malformed !== null) {
      return yield* Effect.fail(
        new JsDocUnknownDirectiveError({
          path,
          line: offsetToLine(rawText, malformed.offset, jsdocStartLine),
          directive: malformed.name,
        }),
      );
    }
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
    for (const span of spans) {
      // Bound the body at the next JSDoc block tag of ANY kind — using
      // only the next spec block let a trailing `@param`/`@returns`/etc.
      // get absorbed into the spec body and serialized as part of the
      // contract.
      const next = nextBlockTagStart(rawText, span.tagEnd);
      const located = yield* parseOneSpan(ctx, span, next);
      if (located !== null) out.push(located);
    }
    return out;
  });

/**
 * @spec.guarantee "every emitted directive validates against the closed grammar before downstream consumption"
 *   reason: trust-boundary; agents consume parsed directive bodies as context.
 * @spec.skip "Roundtrip"
 *   reason: parser-only; no `unparseDirectives` companion (SPEC.md is emitted by `emitMarkdown`, not from raw directives).
 * @spec.skip "Partial Roundtrip"
 *   reason: source comments carry formatting (indentation, line breaks) the parser intentionally normalizes away; no partial-recover relation.
 * @spec.skip "Commutative Paths"
 *   reason: single entry point; no alternative API yields the same directive list.
 * @spec.skip "Constant Non-Equality"
 *   reason: two distinct sources can intentionally produce identical directive lists (e.g., whitespace-only diffs).
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
