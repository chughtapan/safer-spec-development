---
folder: src/analysis
format-version: 0.1.0
generatedAtSha: 7ed6a36cac8eb995251a294e9b5f009d5fcd700b
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0
  classifierCoverage: 0
  preconditionPassRate: 0
---

# SPEC

## Purpose

Barrel for the `analysis/` layer. Re-exports the analysis pipeline + cross-checks + the project-source readers that commands compose. The four files in this folder cover: project-source ingestion (exports, properties), the shared analysis pipeline (pipeline.ts), and the gap-class cross-checks (checks.ts).

## Public surface

### [`DeclaredExport`](./exports.ts#L19)

```ts
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
```

### [`sidecarSlug`](../spec/artifact/sidecar-writer.ts#L42)

```ts
export const sidecarSlug = (folder: string): string => { /* ... */ }
```

**Guarantees:**
- "folder \`.\` maps to \`\\"root\\"\`; folders with \`/\` or \`\\\\\` are coalesced into a single-segment slug with \`\_\` separators; otherwise the folder string is returned unchanged after stripping leading \`./\`" — _single source of truth for the sidecar slug across generate, validate, and reporter. Three call sites previously inlined this logic; agreement is the contract._

**Residual contract:** none — _pure transformation captured by signature._

### [`FolderInputs`](./pipeline.ts#L51)

```ts
export interface FolderInputs {
  readonly sources: ReadonlyArray<string>;
  readonly tests: ReadonlyArray<string>;
  readonly indexFilePath: string;
}
```

### [`collectFolderInputs`](./pipeline.ts#L74)

```ts
export const collectFolderInputs = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<FolderInputs | null, never> => /* ... */
```

**Guarantees:**
- "returns folder inputs (sources, tests, index path) or null if no index.ts barrel exists" — _contract for validate's per-folder iteration._

### [`ValidateGapError`](./checks.ts#L83)

```ts
export type ValidateGapError =
  | MissingSpecPropertyError
  | MissingStubError
  | MissingImplError
  | NoFoldersResolvedError;
```

### [`catchDirectiveErrors`](./checks.ts#L117)

```ts
export const catchDirectiveErrors = <A, R>(
  eff: Effect.Effect<
    A,
    JsDocDirectiveOverflowError | JsDocDirectiveParseError | JsDocUnknownDirectiveError,
    R
  >,
): Effect.Effect<A, MissingStubError, R> => /* ... */
```

### [`checkDrift`](./checks.ts#L147)

```ts
export const checkDrift = (
  fs: FileSystem.FileSystem,
  specPath: string,
  regenerated: string,
): Effect.Effect<void, MissingSpecPropertyError> => /* ... */
```

### [`checkSidecarDrift`](./checks.ts#L177)

```ts
export const checkSidecarDrift = (
  fs: FileSystem.FileSystem,
  sidecarPath: string,
  regenerated: string,
): Effect.Effect<void, MissingSpecPropertyError> => /* ... */
```

### [`inspectFolder`](./pipeline.ts#L193)

```ts
export const inspectFolder = ({ fs, path, folder, inputs, ctx }: InspectArgs): Effect.Effect<FolderInspection, DirectiveParseError> => /* ... */
```

**Guarantees:**
- "produces the same FolderAnalysis shape \`generate\` emits plus a per-test issues list; regenerate-and-compare on \`analysis\` is byte-deterministic" — _roundtrip contract; validate's drift check relies on it._

### [`collectExports`](./exports.ts#L196)

```ts
export const collectExports = (
  filePath: string,
  source: string,
  options: CollectExportsOptions = {},
): ReadonlyArray<DeclaredExport> => { /* ... */ }
```

**Guarantees:**
- "result is source-ordered; barrel re-exports resolve to their target declarations when targets are supplied via siblings + paths" — _emit.ts's canonical sort; re-export resolution needs target files registered and tsconfig aliases configured._

**Residual contract:** "unresolvable re-exports are silently dropped" — _ts-morph cannot follow \`export ... from\` without the target file registered on the same Project._

### [`checkThresholds`](./checks.ts#L220)

```ts
export const checkThresholds = (
  folder: string,
  analysis: FolderAnalysis,
  meta: SpecMeta,
): Effect.Effect<void, MissingImplError> => { /* ... */ }
```

### [`checkImplBodies`](./checks.ts#L235)

```ts
export const checkImplBodies = (
  analysis: FolderAnalysis,
): Effect.Effect<void, MissingImplError> => { /* ... */ }
```

### [`uniqueExternalSources`](./exports.ts#L250)

```ts
export const uniqueExternalSources = (
  declarations: ReadonlyArray<DeclaredExport>,
  localSources: ReadonlyArray<string>,
): ReadonlyArray<string> => { /* ... */ }
```

Source paths of declarations whose targets resolve outside the local
folder's source set. The directive parser walks these too so
`@spec.guarantee` etc. on cross-folder re-export targets survive into
the generated artifact.

### [`buildSpecMeta`](./pipeline.ts#L252)

```ts
export const buildSpecMeta = (
  analysis: FolderAnalysis,
  ctx: ProjectContext,
  execution?: ExecutionSidecar | null,
): SpecMeta => /* ... */
```

**Guarantees:**
- "builds a \`SpecMeta\` from run-level context + analysis-derived type coverage; populates classifierCoverage / preconditionPassRate from \`execution\` sidecar when present" — _emit's frontmatter + sidecar both require meta; \`--implemented\` mode merges Vitest reporter stats into the gate inputs._

**Residual contract:** "branchCoverageFromSpecTests stays null until a v8 coverage hook is wired up (follow-up slice)" — _lifecycle contract._

### [`loadExecutionSidecar`](./pipeline.ts#L273)

```ts
export const loadExecutionSidecar = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<ExecutionSidecar | null, never> => /* ... */
```

**Guarantees:**
- "loads the per-folder execution sidecar emitted by the Vitest reporter, decoded through \`ExecutionSidecarSchema\`; returns null when absent or malformed" — _validate's \`--implemented\` gate consumes the coverage values; absence is surfaced separately as a typed gap error._

### [`checkExecutionSidecarPresent`](./checks.ts#L274)

```ts
export const checkExecutionSidecarPresent = (
  analysis: FolderAnalysis,
  folder: string,
  execution: ExecutionSidecarCheck | null,
  currentTestTreeHash: string,
): Effect.Effect<void, MissingImplError> => { /* ... */ }
```

### [`regenerateMarkdown`](./pipeline.ts#L292)

```ts
export const regenerateMarkdown = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): string => /* ... */
```

Alias for `emitMarkdown(analysis, meta)`; keeps validate.ts's import block compact.

### [`BuildExportEntriesResult`](./exports.ts#L320)

```ts
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
```

### [`failOnIssues`](./checks.ts#L333)

```ts
export const failOnIssues = (
  issues: ReadonlyArray<ItSpecIssue>,
  mode: "planned" | "implemented",
): Effect.Effect<void, ValidateGapError> => { /* ... */ }
```

### [`unresolvedFolderError`](./checks.ts#L344)

```ts
export const unresolvedFolderError = (
  requested: string,
): NoFoldersResolvedError => /* ... */
```

### [`extractProperties`](./properties.ts#L347)

```ts
export const extractProperties = (
  filePath: string,
  source: string,
  directives: ReadonlyArray<LocatedDirective>,
  declaredExports: ReadonlySet<string> = new Set(),
): ExtractResult => { /* ... */ }
```

**Guarantees:**
- "rows carry all four required directives bound to the JSDoc immediately preceding the itSpec call; issues cover missing directives, JSDoc↔runtime mismatch, opts.exports outside \`declaredExports\`, and empty prop bodies" — _validate's gap-class errors derive from issues; \`declaredExports\` empty skips the barrel-membership gate (back-compat)._

**Residual contract:** "calls under nested ExpressionStatements are not bound; JSDoc lookup returns null and the call falls into missing-directive" — _ts-morph's getJsDocs is a property of the immediate parent statement; nested forms are not in scope for this slice._

### [`diagnosticLines`](./checks.ts#L357)

```ts
export const diagnosticLines = (
  tag: ValidateGapError["_tag"],
  payload: GapErrorPayload,
): ReadonlyArray<string> => /* ... */
```

### [`regenerateSidecar`](./pipeline.ts#L358)

```ts
export const regenerateSidecar = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): Effect.Effect<string, never> => /* ... */
```

**Guarantees:**
- "regenerates the SpecArtifact and returns the pretty-printed JSON used for on-disk diff; SidecarSchemaError is a defect (artifact our own emitter produced)" — _validate's sidecar-drift cross-check needs the byte-for-byte regenerated form._

### [`buildExportEntries`](./exports.ts#L402)

```ts
export const buildExportEntries = (
  declarations: ReadonlyArray<DeclaredExport>,
  directives: ReadonlyArray<LocatedDirective>,
  strict?: BuildStrictOptions,
): BuildExportEntriesResult => { /* ... */ }
```

**Guarantees:**
- "every declared export not named by an \`@spec.ignore-export\` directive appears in entries exactly once; directives matching a declaration are merged; unmatched per-export directives are returned via \`unmatched\` when \`folderKnownExports\` is supplied" — _contract for emit.ts's Public surface section + validate's drift gate (MissingSpecPropertyError routing)._

**Residual contract:** "callers that pass \`folderKnownExports = undefined\` skip the drift gate entirely; the returned \`unmatched\` is then always empty" — _generate is a producer (no gate); validate is the gate. The parameter is the discriminator._

### [`indexFilePurposes`](./exports.ts#L429)

```ts
export const indexFilePurposes = (
  directives: ReadonlyArray<LocatedDirective>,
): ReadonlyMap<string, string> => { /* ... */ }
```

Per-file `@spec.purpose` index. First occurrence wins (matches emit's
source-order convention). Callers read the folder's index.ts purpose
as `map.get(indexFilePath) ?? null`; the SPEC.md Files section reads
per-file purposes the same way.

## Children

- [`checks.ts`](./checks.ts) — Validate's gap-class cross-checks. Co-locates the four tagged errors (MissingSpecPropertyError, MissingStubError, MissingImplError, NoFoldersResolvedError) with the check effects that emit them and the diagnostic-builder helpers that shape their bodies.  Extracted from \`validate.ts\` to keep the orchestration file under the strict max-lines cap; the public surface still routes through \`validate.ts\` (this module is internal to the commands layer).
- [`exports.ts`](./exports.ts) — Walks a TypeScript source file via ts-morph and returns the list of exported declaration names plus their source lines. Used by \`generate.ts\` to build the SPEC.md \`## Public surface\` rows and match per-export \`@spec\*\` directives to their declarations.  \`collectExports\` accepts sibling source files + tsconfig \`paths\` via \`CollectExportsOptions\` so it can follow barrel re-exports across files and aliases. The caller (commands/validate-pipeline.ts's \`loadProjectContext\`) supplies that input.
- [`index.ts`](./index.ts) — Barrel for the \`analysis/\` layer. Re-exports the analysis pipeline + cross-checks + the project-source readers that commands compose. The four files in this folder cover: project-source ingestion (exports, properties), the shared analysis pipeline (pipeline.ts), and the gap-class cross-checks (checks.ts).
- [`pipeline.ts`](./pipeline.ts) — Shared analysis pipeline for \`validate\`. Walks the same inputs as \`generate\` (sources, tests, index barrel) and returns the \`FolderAnalysis\` that the markdown emitter consumes plus the per-test issues list (\`ItSpecIssue\[\]\`) that \`validate.ts\` maps to its gap-class exit codes.
- [`properties.ts`](./properties.ts) — Walks \`\*.spec.test.ts\` source via ts-morph and extracts each \`itSpec.todo\` / \`itSpec.prop\` call site plus the four Amendment-6 directives (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`) that should immediately precede it.  Per-test directives bind to the JSDoc block IMMEDIATELY preceding the call (via ts-morph's \`Statement.getJsDocs()\` on the call's enclosing statement); the previous "closest earlier" search across the whole file silently inherited directives from unrelated blocks.  Returns rows for downstream emit + an \`issues\` list. Issues are surfaced to \`validate\` as MissingStub / MissingSpecProperty / MissingImpl gap errors with stable exit codes.

## Properties

_No `itSpec` calls in test files._
