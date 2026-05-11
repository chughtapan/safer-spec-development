/**
 * @spec.purpose
 *   Walks `*.spec.test.ts` source via ts-morph and extracts each
 *   `itSpec.todo` / `itSpec.prop` call site plus the four Amendment-6
 *   directives (`@spec.property`, `@spec.type`, `@spec.exports`,
 *   `@spec.claim`) that should immediately precede it.
 *
 *   Per-test directives bind to the JSDoc block IMMEDIATELY preceding the
 *   call (via ts-morph's `Statement.getJsDocs()` on the call's enclosing
 *   statement); the previous "closest earlier" search across the whole
 *   file silently inherited directives from unrelated blocks.
 *
 *   Returns rows for downstream emit + an `issues` list. Issues are surfaced
 *   to `validate` as MissingStub / MissingSpecProperty / MissingImpl gap
 *   errors with stable exit codes.
 */

import { Node, Project, SyntaxKind, type CallExpression, type JSDoc, type Expression } from "ts-morph";
import type { Directive, LocatedDirective } from "@safer/spec/directives/index.js";
import type { PropertyRow } from "@safer/spec/emit.js";

export interface ItSpecIssue {
  readonly kind: "missing-directive" | "directive-mismatch" | "empty-body";
  readonly path: string;
  readonly line: number;
  readonly detail: string;
}

export interface ExtractResult {
  readonly rows: ReadonlyArray<PropertyRow>;
  readonly issues: ReadonlyArray<ItSpecIssue>;
}

interface CallSite {
  readonly stubbed: boolean;
  readonly line: number;
}

const callSite = (call: CallExpression): CallSite | null => {
  const text = call.getExpression().getText();
  if (text !== "itSpec.todo" && text !== "itSpec.prop") return null;
  return { stubbed: text === "itSpec.todo", line: call.getStartLineNumber() };
};

interface RequiredDirectives {
  readonly property: Extract<Directive, { _tag: "property" }>;
  readonly type: Extract<Directive, { _tag: "type" }>;
  readonly exports: Extract<Directive, { _tag: "exports" }>;
  readonly claim: Extract<Directive, { _tag: "claim" }>;
}

const findTagged = <T extends Directive["_tag"]>(
  directives: ReadonlyArray<Directive>,
  tag: T,
): Extract<Directive, { _tag: T }> | undefined => {
  for (const d of directives) {
    if (d._tag === tag) return d as Extract<Directive, { _tag: T }>;
  }
  return undefined;
};

const REQUIRED_TAGS = ["property", "type", "exports", "claim"] as const;

const collectRequired = (
  directives: ReadonlyArray<Directive>,
): { found: RequiredDirectives | null; missing: ReadonlyArray<string> } => {
  const slots: Partial<Record<(typeof REQUIRED_TAGS)[number], Directive>> = {};
  const missing: string[] = [];
  for (const tag of REQUIRED_TAGS) {
    const d = findTagged(directives, tag);
    if (d === undefined) missing.push(`@spec.${tag}`);
    else slots[tag] = d;
  }
  if (missing.length > 0) return { found: null, missing };
  return {
    found: {
      property: slots.property as RequiredDirectives["property"],
      type: slots.type as RequiredDirectives["type"],
      exports: slots.exports as RequiredDirectives["exports"],
      claim: slots.claim as RequiredDirectives["claim"],
    },
    missing: [],
  };
};

const enclosingStatement = (call: CallExpression): Node | null => {
  const stmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  return stmt ?? null;
};

const immediateJsDoc = (call: CallExpression): JSDoc | null => {
  const stmt = enclosingStatement(call);
  if (stmt === null) return null;
  const probe = stmt as { readonly getJsDocs?: () => readonly JSDoc[] };
  if (typeof probe.getJsDocs !== "function") return null;
  const docs = probe.getJsDocs();
  return docs.at(-1) ?? null;
};

const directivesInJsDoc = (
  jsdoc: JSDoc,
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlyArray<Directive> => {
  const start = jsdoc.getStartLineNumber();
  const end = jsdoc.getEndLineNumber();
  const out: Directive[] = [];
  for (const { directive, location } of directives) {
    if (location.line >= start && location.line <= end) out.push(directive);
  }
  return out;
};

const stringLiteralText = (node: Node | undefined): string | null => {
  if (node === undefined) return null;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return null;
};

const optsProperty = (
  call: CallExpression,
  name: string,
): Expression | null => {
  const args = call.getArguments();
  const opts = args[1];
  if (opts === undefined || !Node.isObjectLiteralExpression(opts)) return null;
  for (const prop of opts.getProperties()) {
    if (Node.isPropertyAssignment(prop) && prop.getName() === name) {
      return prop.getInitializer() ?? null;
    }
  }
  return null;
};

const runtimeExportsNames = (call: CallExpression): ReadonlyArray<string> => {
  const expr = optsProperty(call, "exports");
  if (expr === null || !Node.isArrayLiteralExpression(expr)) return [];
  const names: string[] = [];
  for (const el of expr.getElements()) {
    if (Node.isIdentifier(el)) names.push(el.getText());
    else if (Node.isPropertyAccessExpression(el)) names.push(el.getName());
  }
  return names;
};

const sameArray = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

interface CrossCheckCtx {
  readonly path: string;
  readonly line: number;
}

const mismatch = (ctx: CrossCheckCtx, detail: string): ItSpecIssue => ({
  kind: "directive-mismatch",
  path: ctx.path,
  line: ctx.line,
  detail,
});

const checkProperty = (
  call: CallExpression,
  found: RequiredDirectives,
  ctx: CrossCheckCtx,
): ItSpecIssue | null => {
  const id = stringLiteralText(call.getArguments()[0]);
  if (id === null || id === found.property.id) return null;
  return mismatch(ctx, `JSDoc @spec.property "${found.property.id}" vs itSpec id "${id}"`);
};

const checkType = (
  call: CallExpression,
  found: RequiredDirectives,
  ctx: CrossCheckCtx,
): ItSpecIssue | null => {
  const expr = optsProperty(call, "type");
  if (expr === null) return null;
  const value = stringLiteralText(expr);
  if (value === null || value === found.type.propertyType) return null;
  return mismatch(ctx, `JSDoc @spec.type "${found.type.propertyType}" vs itSpec opts.type "${value}"`);
};

const checkExports = (
  call: CallExpression,
  found: RequiredDirectives,
  ctx: CrossCheckCtx,
): ItSpecIssue | null => {
  const runtime = runtimeExportsNames(call);
  const declared = [...found.exports.symbols];
  // Empty runtime exports = either the test author forgot `exports: [...]`
  // OR passed `exports: []` literally; both mask missing metadata. Surface
  // as a cross-check mismatch so the documented gate (MissingSpecPropertyError
  // routing) fires.
  if (runtime.length === 0) {
    return mismatch(
      ctx,
      `JSDoc @spec.exports [${declared.join(", ")}] vs itSpec opts.exports [] (runtime metadata empty or omitted)`,
    );
  }
  if (sameArray([...runtime].sort(), [...declared].sort())) return null;
  return mismatch(ctx, `JSDoc @spec.exports [${declared.join(", ")}] vs itSpec opts.exports [${runtime.join(", ")}]`);
};

const crossCheckIssues = (
  call: CallExpression,
  found: RequiredDirectives,
  path: string,
  line: number,
): ReadonlyArray<ItSpecIssue> => {
  const ctx: CrossCheckCtx = { path, line };
  const issues: ItSpecIssue[] = [];
  for (const check of [checkProperty, checkType, checkExports]) {
    const i = check(call, found, ctx);
    if (i !== null) issues.push(i);
  }
  return issues;
};

const isStubExpression = (node: Node): boolean => {
  if (Node.isIdentifier(node) && node.getText() === "undefined") return true;
  if (
    Node.isCallExpression(node) &&
    node.getExpression().getText() === "Effect.die"
  ) {
    return true;
  }
  return false;
};

const isTriviallyEmptyBody = (call: CallExpression): boolean => {
  const body = call.getArguments()[3];
  if (body === undefined) return true;
  if (!Node.isArrowFunction(body) && !Node.isFunctionExpression(body)) return false;
  const fnBody = body.getBody();
  if (Node.isBlock(fnBody)) return fnBody.getStatements().length === 0;
  return isStubExpression(fnBody);
};

interface BuildContext {
  readonly filePath: string;
  readonly directives: ReadonlyArray<LocatedDirective>;
}

const buildForCall = (
  ctx: BuildContext,
  call: CallExpression,
): { row: PropertyRow | null; issues: ReadonlyArray<ItSpecIssue> } => {
  const site = callSite(call);
  if (site === null) return { row: null, issues: [] };
  const issues: ItSpecIssue[] = [];
  const jsdoc = immediateJsDoc(call);
  const localDirectives =
    jsdoc === null ? [] : directivesInJsDoc(jsdoc, ctx.directives);
  const { found, missing } = collectRequired(localDirectives);
  if (found === null) {
    issues.push({
      kind: "missing-directive",
      path: ctx.filePath,
      line: site.line,
      detail: `itSpec.${site.stubbed ? "todo" : "prop"} missing JSDoc: ${missing.join(", ")}`,
    });
    return { row: null, issues };
  }
  issues.push(...crossCheckIssues(call, found, ctx.filePath, site.line));
  if (!site.stubbed && isTriviallyEmptyBody(call)) {
    issues.push({
      kind: "empty-body",
      path: ctx.filePath,
      line: site.line,
      detail: `itSpec.prop("${found.property.id}", ...) body is empty`,
    });
  }
  return {
    row: {
      id: found.property.id,
      propertyType: found.type.propertyType,
      exports: found.exports.symbols,
      claim: found.claim.body,
      sourceRef: { path: ctx.filePath, line: site.line },
      stubbed: site.stubbed,
    },
    issues,
  };
};

/**
 * @spec.guarantee "every returned row has all four required directives bound to the JSDoc immediately preceding the itSpec call; issues surface missing directives, JSDoc↔runtime mismatches, and empty itSpec.prop bodies"
 *   reason: contract; `## Properties` table assumes one-to-one rows;
 *           validate's gap-class errors are derived from issues.
 * @spec.residual-contract "calls under nested ExpressionStatements (e.g. inside an iife) are not bound; their JSDoc lookup returns null and falls into missing-directive"
 *   reason: ts-morph's getJsDocs is a property of the immediate parent
 *           statement; nested forms are not in scope for this slice.
 */
export const extractProperties = (
  filePath: string,
  source: string,
  directives: ReadonlyArray<LocatedDirective>,
): ExtractResult => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  const rows: PropertyRow[] = [];
  const issues: ItSpecIssue[] = [];
  const ctx: BuildContext = { filePath, directives };
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const { row, issues: callIssues } = buildForCall(ctx, call);
    if (row !== null) rows.push(row);
    issues.push(...callIssues);
  }
  return { rows, issues };
};
