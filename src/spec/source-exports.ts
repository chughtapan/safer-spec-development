/**
 * @spec.purpose
 *   Walks a TypeScript source file via ts-morph and returns the list of
 *   exported declaration names plus their source lines. Used by
 *   `generate.ts` to build the SPEC.md `## Public surface` rows and
 *   match per-export `@spec*` directives to their declarations.
 */

import { Node, Project, SyntaxKind, type JSDoc } from "ts-morph";
import type { Directive, LocatedDirective } from "@safer/spec/directives/index.js";
import type { ExportEntry, ExportKind } from "@safer/spec/emit.js";

export interface DeclaredExport {
  readonly name: string;
  readonly line: number;
  readonly path: string;
  readonly kind: ExportKind;
  readonly signature: string;
  readonly description: string;
}

interface DeclarationFacts {
  readonly kind: ExportKind;
  readonly signature: string;
  /** Node to read JSDocs + line number from (the enclosing statement). */
  readonly anchor: Node;
}

const stripFunctionBody = (
  text: string,
  bodyOffset: number,
  isBlock: boolean,
): string => {
  const ellipsis = isBlock ? "{ /* ... */ }" : "/* ... */";
  return `${text.slice(0, bodyOffset).trim()} ${ellipsis}`;
};

/**
 * Find the offset of the class body's opening `{` by walking braces
 * right-to-left from the closing `}`. This skips `{...}` that appear
 * inside type arguments (`<{ readonly code: number }>` etc.), which a
 * naive `indexOf("{")` would match first.
 */
const findClassBodyOpenBrace = (trimmed: string): number => {
  const CLOSE_BRACE = 125;
  const OPEN_BRACE = 123;
  let depth = 0;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const c = trimmed.charCodeAt(i);
    if (c === CLOSE_BRACE) depth++;
    else if (c === OPEN_BRACE) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const stripClassBody = (text: string): string => {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith("}")) return text;
  const braceStart = findClassBodyOpenBrace(trimmed);
  if (braceStart === -1) return text;
  return `${trimmed.slice(0, braceStart).trim()} { /* ... */ }`;
};

const factsFromVariable = (
  node: Node,
): DeclarationFacts | null => {
  if (!Node.isVariableDeclaration(node)) return null;
  const statement = node.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  const anchor = statement ?? node;
  const fullText = anchor.getText();
  const init = node.getInitializer();
  if (init !== undefined && Node.isArrowFunction(init)) {
    const body = init.getBody();
    const offset = body.getStart() - anchor.getStart();
    return {
      kind: "function",
      signature: stripFunctionBody(fullText, offset, Node.isBlock(body)),
      anchor,
    };
  }
  return { kind: "const", signature: fullText, anchor };
};

const factsFromFunction = (node: Node): DeclarationFacts | null => {
  if (!Node.isFunctionDeclaration(node)) return null;
  const text = node.getText();
  const body = node.getBody();
  if (body === undefined) {
    return { kind: "function", signature: text, anchor: node };
  }
  const offset = body.getStart() - node.getStart();
  return {
    kind: "function",
    signature: stripFunctionBody(text, offset, true),
    anchor: node,
  };
};

const factsFromClass = (node: Node): DeclarationFacts | null => {
  if (!Node.isClassDeclaration(node)) return null;
  return {
    kind: "class",
    signature: stripClassBody(node.getText()),
    anchor: node,
  };
};

const factsFromOther = (node: Node): DeclarationFacts => {
  if (Node.isTypeAliasDeclaration(node)) {
    return { kind: "type", signature: node.getText(), anchor: node };
  }
  if (Node.isInterfaceDeclaration(node)) {
    return { kind: "interface", signature: node.getText(), anchor: node };
  }
  if (Node.isEnumDeclaration(node)) {
    return { kind: "enum", signature: node.getText(), anchor: node };
  }
  return { kind: "other", signature: node.getText(), anchor: node };
};

const declarationFacts = (node: Node): DeclarationFacts =>
  factsFromVariable(node) ??
  factsFromFunction(node) ??
  factsFromClass(node) ??
  factsFromOther(node);

/**
 * JSDoc description prose is the text before any block tag. Per-export
 * `@specXxx` directives are not part of the description; this returns
 * only the free-form prose authors wrote above the declaration.
 */
const descriptionFromJsDocs = (anchor: Node): string => {
  const probe = anchor as { readonly getJsDocs?: () => readonly JSDoc[] };
  if (typeof probe.getJsDocs !== "function") return "";
  for (const jsdoc of probe.getJsDocs()) {
    const text = jsdoc.getDescription().trim();
    if (text.length > 0) return text;
  }
  return "";
};

/**
 * @spec.guarantee "result is sorted by source line (ascending); each name is the binding's actual identifier per ts-morph's getExportedDeclarations"
 *   reason: source-order is required by emit.ts's canonical sort.
 * @spec.residual-contract "re-exports inherit the line of their re-export statement, not their original declaration"
 *   reason: ts-morph returns the local binding's position.
 */
export const collectExports = (
  filePath: string,
  source: string,
): ReadonlyArray<DeclaredExport> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  const entries: DeclaredExport[] = [];
  for (const [name, nodes] of sf.getExportedDeclarations()) {
    const node = nodes[0];
    if (node === undefined) continue;
    const facts = declarationFacts(node);
    entries.push({
      name,
      line: facts.anchor.getStartLineNumber(),
      path: filePath,
      kind: facts.kind,
      signature: facts.signature,
      description: descriptionFromJsDocs(facts.anchor),
    });
  }
  entries.sort((a, b) => a.line - b.line);
  return entries;
};

const mergeOne = (entry: ExportEntry, d: Directive): ExportEntry => {
  switch (d._tag) {
    case "assume":
      return {
        ...entry,
        assumes: [...entry.assumes, { claim: d.claim, reason: d.reason }],
      };
    case "guarantee":
      return {
        ...entry,
        guarantees: [...entry.guarantees, { claim: d.claim, reason: d.reason }],
      };
    case "residual-contract":
      return {
        ...entry,
        residualContract:
          d.body === "none"
            ? { _tag: "none", reason: d.reason }
            : { _tag: "some", body: d.body, reason: d.reason },
      };
    case "skip":
      return {
        ...entry,
        skipped: [
          ...entry.skipped,
          { propertyType: d.propertyType, reason: d.reason },
        ],
      };
    default:
      return entry;
  }
};

/**
 * @spec.guarantee "every declared export appears in the result exactly once; directives whose location.exportName matches a declaration are merged into that entry"
 *   reason: contract for emit.ts's Public surface section.
 * @spec.residual-contract "directives whose exportName names a non-declared symbol are silently dropped"
 *   reason: validate gate surfaces these as MissingSpecPropertyError;
 *           generate just emits what it sees.
 */
export const buildExportEntries = (
  declarations: ReadonlyArray<DeclaredExport>,
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlyArray<ExportEntry> => {
  const byName = new Map<string, ExportEntry>(
    declarations.map((d) => [
      d.name,
      {
        name: d.name,
        kind: d.kind,
        signature: d.signature,
        description: d.description,
        sourceRef: { path: d.path, line: d.line },
        assumes: [],
        guarantees: [],
        residualContract: null,
        skipped: [],
      },
    ]),
  );
  for (const { directive, location } of directives) {
    const name = location.exportName;
    const entry = name === null ? undefined : byName.get(name);
    if (entry !== undefined && name !== null) {
      byName.set(name, mergeOne(entry, directive));
    }
  }
  return [...byName.values()];
};

/**
 * Folder purpose is canonical to the `<folder>/index.ts` barrel.
 * Per-file `@spec.purpose` directives on non-index sources describe the
 * file's local intent and do not represent the folder.
 */
export const findPurpose = (
  directives: ReadonlyArray<LocatedDirective>,
  indexFilePath: string,
): string | null => {
  for (const { directive, location } of directives) {
    if (directive._tag === "purpose" && location.path === indexFilePath) {
      return directive.body;
    }
  }
  return null;
};
