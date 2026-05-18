/**
 * @spec.purpose
 *   Walks a TypeScript source file via ts-morph and returns the list of
 *   exported declaration names plus their source lines. Used by
 *   `generate.ts` to build the MODULE.md `## Public surface` rows and
 *   match per-export `@spec*` directives to their declarations.
 *
 *   `collectExports` accepts sibling source files + tsconfig `paths` via
 *   `CollectExportsOptions` so it can follow barrel re-exports across files
 *   and aliases. The caller (commands/validate-pipeline.ts's
 *   `loadProjectContext`) supplies that input.
 */

import { Node, Project, SyntaxKind, type JSDoc } from "ts-morph";
import type { Directive, LocatedDirective } from "@safer/spec/grammar/index.js";
import type { ExportEntry, ExportKind } from "@safer/spec/artifact/index.js";
import type { SourceFile } from "@safer/project/index.js";

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
  // body into MODULE.md / sidecar.
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

const otherKind = (node: Node): ExportKind => {
  if (Node.isTypeAliasDeclaration(node)) return "type";
  if (Node.isInterfaceDeclaration(node)) return "interface";
  if (Node.isEnumDeclaration(node)) return "enum";
  return "other";
};
const factsFromOther = (node: Node): DeclarationFacts =>
  ({ kind: otherKind(node), signature: node.getText(), anchor: node });

const declarationFacts = (node: Node): DeclarationFacts =>
  factsFromVariable(node) ??
  factsFromFunction(node) ??
  factsFromClass(node) ??
  factsFromOther(node);

// Declaration-merging tie-breaker: prefer the value node when a name
// has both type and value declarations (e.g. `interface Foo` + `class Foo`,
// or `interface Foo` + `namespace Foo`) so the symbol counts toward
// typeCoverage. `ModuleDeclaration` covers `namespace`/`module`.
const VALUE_NODE_CHECKS: ReadonlyArray<(n: Node) => boolean> = [
  Node.isVariableDeclaration, Node.isFunctionDeclaration,
  Node.isClassDeclaration, Node.isEnumDeclaration, Node.isModuleDeclaration,
];
const isValueNode = (n: Node): boolean => VALUE_NODE_CHECKS.some((f) => f(n));

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

export interface CollectExportsOptions {
  /** Sibling source files registered on the in-memory ts-morph Project so re-exports resolve. */
  readonly siblings?: ReadonlyArray<SourceFile>;
  /** tsconfig `paths` mapping copied onto the in-memory Project's compilerOptions so aliased re-exports resolve. */
  readonly paths?: Readonly<Record<string, ReadonlyArray<string>>>;
  /** tsconfig `baseUrl` (where `paths` are resolved relative to). Defaults to "." when `paths` is set but `baseUrl` is omitted. */
  readonly baseUrl?: string;
}

// ts-morph's in-memory FileSystem reports paths with a leading "/" (the
// virtual root). Strip it so committed MODULE.md links + sidecar sourceRef
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

/**
 * @spec.guarantee "result is source-ordered; barrel re-exports resolve to their target declarations when targets are supplied via siblings + paths"
 *   reason: emit.ts's canonical sort; re-export resolution needs target
 *           files registered and tsconfig aliases configured.
 * @spec.residual-contract "unresolvable re-exports are silently dropped"
 *   reason: ts-morph cannot follow `export ... from` without the target
 *           file registered on the same Project.
 */
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
    if (nodes.length === 0) continue;
    // See `isValueNode` — picks the value half on declaration merging.
    const node = nodes.find(isValueNode) ?? nodes[0]!;
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
  if (d._tag === "assume") {
    return { ...entry, assumes: [...entry.assumes, { claim: d.claim, reason: d.reason }] };
  }
  if (d._tag === "guarantee") {
    return { ...entry, guarantees: [...entry.guarantees, { claim: d.claim, reason: d.reason }] };
  }
  if (d._tag === "residual-contract") {
    const rc = d.body === "none"
      ? { _tag: "none" as const, reason: d.reason }
      : { _tag: "some" as const, body: d.body, reason: d.reason };
    return { ...entry, residualContract: rc };
  }
  if (d._tag === "skip") {
    return { ...entry, skipped: [...entry.skipped, { propertyType: d.propertyType, reason: d.reason }] };
  }
  return entry;
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

export interface BuildExportEntriesResult {
  readonly entries: ReadonlyArray<ExportEntry>;

  /**
   * Per-export directives flagged as drift: located in a local source
   * file but with an `exportName` that isn't part of the folder's
   * known-exports set (renamed/deleted symbol, misplaced directive).
   * External (cross-folder re-export target) directives are merged into
   * entries when they match an alias, but never flagged as drift for
   * this folder; that responsibility belongs to the owning folder's
   * validate run.
   */
  readonly unmatched: ReadonlyArray<LocatedDirective>;
}

/**
 * Optional strict-mode inputs for the drift gate. Validate passes
 * both; generate omits the bundle entirely.
 */
export interface BuildStrictOptions {
  /** Union of every symbol exported by any source file in the folder. */
  readonly folderKnownExports: ReadonlySet<string>;
  /** Paths of files inside the folder; drift only fires for these. */
  readonly localSources: ReadonlySet<string>;
}

interface BuildState {
  readonly byName: Map<string, ExportEntry>;
  readonly aliases: ReadonlyMap<string, string>;
  readonly strict: boolean;
  readonly known: ReadonlySet<string>;
  readonly localSources: ReadonlySet<string>;
  readonly unmatched: LocatedDirective[];
}

const resolvePublic = (
  name: string,
  byName: ReadonlyMap<string, ExportEntry>,
  aliases: ReadonlyMap<string, string>,
): string | null => byName.has(name) ? name : aliases.get(name) ?? null;

// Per-export tags whose contract is meaningless without a target
// declaration. When one appears with `location.exportName === null`
// (placed in file-level JSDoc or above a bare `export { ... }`
// statement), strict validate flags it as misplaced.
const PER_EXPORT_TAGS: ReadonlySet<Directive["_tag"]> = new Set([
  "assume", "guarantee", "residual-contract", "skip",
]);

// True when an unmatched directive is real drift in THIS folder: must
// be located in a local source file, then either a per-export tag with
// no exportName, OR a per-export tag whose exportName isn't in the
// folder's known-exports set. Always false in non-strict mode, for
// `ignore-export`, and for directives in external (cross-folder)
// source files (those are drift for some OTHER folder, not this one).
const isDrift = (located: LocatedDirective, state: BuildState): boolean => {
  if (!state.strict) return false;
  if (!state.localSources.has(located.location.path)) return false;
  const { directive, location } = located;
  if (location.exportName === null) return PER_EXPORT_TAGS.has(directive._tag);
  return directive._tag !== "ignore-export" && !state.known.has(location.exportName);
};

const resolveOrFlag = (located: LocatedDirective, state: BuildState): void => {
  const name = located.location.exportName;
  const publicName = name === null ? null : resolvePublic(name, state.byName, state.aliases);
  if (publicName !== null) {
    const entry = state.byName.get(publicName);
    if (entry !== undefined) state.byName.set(publicName, mergeOne(entry, located.directive));
    return;
  }
  if (isDrift(located, state)) state.unmatched.push(located);
};

/**
 * @spec.guarantee "every declared export not named by an `@spec.ignore-export` directive appears in entries exactly once; directives matching a declaration are merged; unmatched per-export directives are returned via `unmatched` when `folderKnownExports` is supplied"
 *   reason: contract for emit.ts's Public surface section + validate's
 *           drift gate (MissingSpecPropertyError routing).
 * @spec.residual-contract "callers that pass `folderKnownExports = undefined` skip the drift gate entirely; the returned `unmatched` is then always empty"
 *   reason: generate is a producer (no gate); validate is the gate. The
 *           parameter is the discriminator.
 */
export const buildExportEntries = (
  declarations: ReadonlyArray<DeclaredExport>,
  directives: ReadonlyArray<LocatedDirective>,
  strict?: BuildStrictOptions,
): BuildExportEntriesResult => {
  const ignored = collectIgnoredExportNames(directives);
  const kept = declarations.filter(
    (d) => !ignored.has(d.name) && !ignored.has(d.declaredName),
  );
  const state: BuildState = {
    byName: new Map(kept.map((d) => [d.name, seedEntry(d)])),
    aliases: indexAliases(kept),
    strict: strict !== undefined,
    known: strict?.folderKnownExports ?? new Set<string>(),
    localSources: strict?.localSources ?? new Set<string>(),
    unmatched: [],
  };
  for (const located of directives) resolveOrFlag(located, state);
  return { entries: [...state.byName.values()], unmatched: state.unmatched };
};

/**
 * Per-file `@spec.purpose` index. First occurrence wins (matches emit's
 * source-order convention). Callers read the folder's index.ts purpose
 * as `map.get(indexFilePath) ?? null`; the MODULE.md Files section reads
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

