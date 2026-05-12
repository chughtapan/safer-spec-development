/**
 * @spec.purpose
 *   Walks a TypeScript source file via ts-morph and returns the list of
 *   exported declaration names plus their source lines. Used by
 *   `generate.ts` to build the SPEC.md `## Public surface` rows and
 *   match per-export `@spec*` directives to their declarations.
 *
 *   `collectExports` accepts sibling source files + tsconfig `paths` via
 *   `CollectExportsOptions` so it can follow barrel re-exports across files
 *   and aliases. The caller (commands/validate-pipeline.ts's
 *   `loadProjectContext`) supplies that input.
 */

import { Node, Project, SyntaxKind, type JSDoc } from "ts-morph";
import type { Directive, LocatedDirective } from "@safer/spec/directives/index.js";
import type { ExportEntry, ExportKind } from "@safer/spec/emit.js";

export interface DeclaredExport {
  readonly name: string;

  /**
   * Underlying declaration's own name. For `export { foo as bar }`, `name`
   * is `bar` (the public alias) and `declaredName` is `foo` (the symbol
   * the JSDoc binds to). For direct exports, `declaredName === name`.
   * `buildExportEntries` uses this to route directives parsed against the
   * underlying name into the aliased export entry.
   */
  readonly declaredName: string;
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
 * inside type arguments (`&lt;{ readonly code: number }>` etc.), which a
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
  // Both `export const f = (x) => …` and `export const f = function (x) { … }`
  // are functional exports; without the function-expression branch the
  // second form fell through to the `const` case and emitted the whole
  // body into SPEC.md / sidecar.
  if (init !== undefined && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
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

export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

export interface CollectExportsOptions {
  /** Sibling source files registered on the in-memory ts-morph Project so re-exports resolve. */
  readonly siblings?: ReadonlyArray<SourceFile>;
  /** tsconfig `paths` mapping copied onto the in-memory Project's compilerOptions so aliased re-exports resolve. */
  readonly paths?: Readonly<Record<string, ReadonlyArray<string>>>;
  /** tsconfig `baseUrl` (where `paths` are resolved relative to). Defaults to "." when `paths` is set but `baseUrl` is omitted. */
  readonly baseUrl?: string;
}

/**
 * @spec.guarantee "result is source-ordered; barrel re-exports resolve to their target declarations when targets are supplied via siblings + paths"
 *   reason: emit.ts's canonical sort; re-export resolution needs target
 *           files registered and tsconfig aliases configured.
 * @spec.residual-contract "unresolvable re-exports are silently dropped"
 *   reason: ts-morph cannot follow `export ... from` without the target
 *           file registered on the same Project.
 */
// ts-morph's in-memory FileSystem reports paths with a leading "/" (the
// virtual root). Strip it so committed SPEC.md links + sidecar sourceRef
// paths are repo-relative (e.g. `src/commands/index.ts`, not
// `/src/commands/index.ts`).
const stripLeadingSlash = (p: string): string =>
  p.length > 0 && p.charCodeAt(0) === 47 ? p.slice(1) : p;

const buildCompilerOptions = (
  options: CollectExportsOptions,
): { baseUrl?: string; paths?: Record<string, string[]> } => {
  if (options.paths === undefined) return {};
  return {
    baseUrl: options.baseUrl ?? ".",
    paths: Object.fromEntries(
      Object.entries(options.paths).map(([k, v]) => [k, [...v]]),
    ),
  };
};

export const collectExports = (
  filePath: string,
  source: string,
  options: CollectExportsOptions = {},
): ReadonlyArray<DeclaredExport> => {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: buildCompilerOptions(options),
  });
  for (const file of options.siblings ?? []) {
    if (file.path === filePath) continue;
    project.createSourceFile(file.path, file.source, { overwrite: true });
  }
  const sf = project.createSourceFile(filePath, source, { overwrite: true });
  const entries: DeclaredExport[] = [];
  for (const [name, nodes] of sf.getExportedDeclarations()) {
    const node = nodes[0];
    if (node === undefined) continue;
    const facts = declarationFacts(node);
    const anchorFile = stripLeadingSlash(facts.anchor.getSourceFile().getFilePath());
    entries.push({
      name,
      declaredName: declaredNameOf(node, name),
      line: facts.anchor.getStartLineNumber(),
      path: anchorFile,
      kind: facts.kind,
      signature: facts.signature,
      description: descriptionFromJsDocs(facts.anchor),
    });
  }
  entries.sort((a, b) => a.line - b.line);
  return entries;
};

/**
 * Read the underlying declaration's own name. VariableDeclaration,
 * FunctionDeclaration, ClassDeclaration, TypeAliasDeclaration,
 * InterfaceDeclaration, and EnumDeclaration all expose `getName()`; nodes
 * without one (anonymous exports, ExportSpecifier targets that resolve to
 * unnamed entities) fall back to the public alias.
 */
const declaredNameOf = (node: Node, fallback: string): string => {
  const probe = node as { readonly getName?: () => string | undefined };
  if (typeof probe.getName !== "function") return fallback;
  const got = probe.getName();
  return got === undefined || got.length === 0 ? fallback : got;
};

/**
 * Source paths of declarations whose targets resolve outside the local
 * folder's source set. The directive parser walks these too so
 * `@spec.guarantee` etc. on cross-folder re-export targets survive into
 * the generated artifact.
 */
export const uniqueExternalSources = (
  declarations: ReadonlyArray<DeclaredExport>,
  localSources: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const local = new Set(localSources);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of declarations) {
    if (local.has(d.path) || seen.has(d.path)) continue;
    seen.add(d.path);
    out.push(d.path);
  }
  return out;
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

const collectIgnoredExportNames = (
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlySet<string> => {
  const ignored = new Set<string>();
  for (const { directive } of directives) {
    if (directive._tag === "ignore-export") ignored.add(directive.exportName);
  }
  return ignored;
};

/**
 * @spec.guarantee "every declared export not named by an `@spec.ignore-export` directive appears in the result exactly once; directives whose location.exportName matches a declaration are merged into that entry"
 *   reason: contract for emit.ts's Public surface section.
 * @spec.residual-contract "directives whose exportName names a non-declared symbol are silently dropped"
 *   reason: validate gate surfaces these as MissingSpecPropertyError;
 *           generate just emits what it sees.
 */
const seedEntry = (d: DeclaredExport): ExportEntry => ({
  name: d.name,
  kind: d.kind,
  signature: d.signature,
  description: d.description,
  sourceRef: { path: d.path, line: d.line },
  assumes: [],
  guarantees: [],
  residualContract: null,
  skipped: [],
});

/**
 * `export { foo as bar }`: JSDoc on `foo` is parsed with
 * `location.exportName = "foo"` but the entry is keyed under the public
 * alias `bar`. This index lets directive lookup reach the entry via
 * either name; first-declared wins on collision.
 */
const indexAliases = (kept: ReadonlyArray<DeclaredExport>): Map<string, string> => {
  const out = new Map<string, string>();
  for (const d of kept) {
    if (!out.has(d.declaredName)) out.set(d.declaredName, d.name);
  }
  return out;
};

const resolvePublicName = (
  targetName: string | null,
  byName: ReadonlyMap<string, ExportEntry>,
  aliases: ReadonlyMap<string, string>,
): string | null => {
  if (targetName === null) return null;
  if (byName.has(targetName)) return targetName;
  return aliases.get(targetName) ?? null;
};

export const buildExportEntries = (
  declarations: ReadonlyArray<DeclaredExport>,
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlyArray<ExportEntry> => {
  const ignored = collectIgnoredExportNames(directives);
  // `@spec.ignore-export foo` on `foo` is parsed under the underlying
  // name; matching both `name` (public alias) and `declaredName` drops the
  // export regardless of which name the author wrote in the directive.
  const kept = declarations.filter(
    (d) => !ignored.has(d.name) && !ignored.has(d.declaredName),
  );
  const byName = new Map<string, ExportEntry>(kept.map((d) => [d.name, seedEntry(d)]));
  const aliases = indexAliases(kept);
  for (const { directive, location } of directives) {
    const publicName = resolvePublicName(location.exportName, byName, aliases);
    if (publicName === null) continue;
    const entry = byName.get(publicName);
    if (entry !== undefined) byName.set(publicName, mergeOne(entry, directive));
  }
  return [...byName.values()];
};

/**
 * Per-file `@spec.purpose` index. First occurrence wins (matches emit's
 * source-order convention). Callers read the folder's index.ts purpose
 * as `map.get(indexFilePath) ?? null`; the SPEC.md Files section reads
 * per-file purposes the same way.
 */
export const indexFilePurposes = (
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlyMap<string, string> => {
  const out = new Map<string, string>();
  for (const { directive, location } of directives) {
    if (directive._tag !== "purpose") continue;
    if (!out.has(location.path)) out.set(location.path, directive.body);
  }
  return out;
};

