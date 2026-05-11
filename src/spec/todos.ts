/**
 * @specPurpose
 *   Walks `*.spec.test.ts` source via ts-morph and extracts each
 *   `itSpec.todo` / `itSpec.prop` call site plus the four Amendment-6
 *   directives (`@specProperty`, `@specType`, `@specExports`,
 *   `@specClaim`) that should immediately precede it.
 *
 *   Returned `PropertyRow` values feed the SPEC.md `## Properties` table
 *   emitted by `emit.ts`.
 */

import { Project, SyntaxKind, type CallExpression } from "ts-morph";
import type { Directive, LocatedDirective } from "@safer/spec/directives/index.js";
import type { PropertyRow } from "@safer/spec/emit.js";

const findClosestDirective = <T extends Directive["_tag"]>(
  directives: ReadonlyArray<LocatedDirective>,
  before: number,
  tag: T,
): Extract<Directive, { _tag: T }> | undefined => {
  let best: { line: number; directive: Extract<Directive, { _tag: T }> } | undefined;
  for (const { directive, location } of directives) {
    const matches = directive._tag === tag && location.line <= before;
    if (matches && (best === undefined || location.line > best.line)) {
      best = {
        line: location.line,
        directive: directive as Extract<Directive, { _tag: T }>,
      };
    }
  }
  return best?.directive;
};

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

const findRequiredDirectives = (
  directives: ReadonlyArray<LocatedDirective>,
  callLine: number,
): RequiredDirectives | null => {
  const property = findClosestDirective(directives, callLine, "property");
  if (property === undefined) return null;
  const type = findClosestDirective(directives, callLine, "type");
  if (type === undefined) return null;
  const exports = findClosestDirective(directives, callLine, "exports");
  if (exports === undefined) return null;
  const claim = findClosestDirective(directives, callLine, "claim");
  if (claim === undefined) return null;
  return { property, type, exports, claim };
};

const buildRow = (
  filePath: string,
  call: CallExpression,
  directives: ReadonlyArray<LocatedDirective>,
): PropertyRow | null => {
  const site = callSite(call);
  if (site === null) return null;
  const found = findRequiredDirectives(directives, site.line);
  if (found === null) return null;
  return {
    id: found.property.id,
    propertyType: found.type.propertyType,
    exports: found.exports.symbols,
    claim: found.claim.body,
    sourceRef: { path: filePath, line: site.line },
    stubbed: site.stubbed,
  };
};

/**
 * @specGuarantee "every returned row corresponds to exactly one itSpec call site and carries all four required directives"
 *   reason: contract; downstream `## Properties` table assumes
 *           one-to-one rows.
 * @specResidualContract "call sites that lack any of the four directives are silently skipped; validate-implemented surfaces them as MissingStubError"
 *   reason: lifecycle contract; generate emits what it finds, validate
 *           gates on completeness.
 */
export const extractProperties = (
  filePath: string,
  source: string,
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlyArray<PropertyRow> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  const rows: PropertyRow[] = [];
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const row = buildRow(filePath, call, directives);
    if (row !== null) rows.push(row);
  }
  return rows;
};
