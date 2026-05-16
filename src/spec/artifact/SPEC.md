---
folder: src/spec/artifact
format-version: 0.1.0
generatedAtSha: 4a84c8a158ef9e717ac64d92d72ea82c1daa7ccd
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0.04888888888888889
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

Public barrel for `spec/artifact/`. Re-exports the external surface — what other layers (analysis, commands) reach for, not what the folder uses internally. The parsers `decodeSpecFrontmatter` and `decodeSpecArtifact` are deliberately NOT re-exported: they exist for their own roundtrip tests + `sidecar-writer.ts`'s same-folder roundtrip assertion. `decodeExecutionSidecar` IS exposed because `analysis/pipeline.ts` parses execution sidecars during the `--implemented` freshness check.

## Public surface

### [`ExportKind`](./emit.ts#L26)

```ts
export type ExportKind =
  | "const"
  | "function"
  | "type"
  | "interface"
  | "class"
  | "enum"
  | "other";
```

### [`SidecarWriteError`](./sidecar-writer.ts#L26)

```ts
export class SidecarWriteError extends Data.TaggedError("SidecarWriteError")<{
  readonly folder: string;
  readonly cause: unknown;
}> { /* ... */ }
```

### [`ExportEntry`](./emit.ts#L35)

```ts
export interface ExportEntry {
  readonly name: string;
  readonly kind: ExportKind;
  readonly signature: string;
  readonly description: string;
  readonly sourceRef: { readonly path: string; readonly line: number };
  readonly assumes: ReadonlyArray<ResidualEntry>;
  readonly guarantees: ReadonlyArray<ResidualEntry>;
  readonly residualContract: ResidualContract | null;
  readonly skipped: ReadonlyArray<{
    readonly propertyType: PropertyType;
    readonly reason: string;
  }>;
}
```

### [`escapeForMarkdown`](./escape.ts#L36)

```ts
export const escapeForMarkdown = (
  input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> => /* ... */
```

**Guarantees:**
- "output is markdown-safe; backticks, code-fences, link syntax characters, HTML angle brackets are escaped" — _trust contract; emitted into SPEC.md prose where attacker-controlled directive bodies could otherwise inject markup._

**Residual contract:** "the escaping is one-way; round-trip through \`decode\` does not return the original string" — _behavioral residue; downstream readers see escaped form._

### [`sidecarSlug`](./sidecar-writer.ts#L42)

```ts
export const sidecarSlug = (folder: string): string => { /* ... */ }
```

**Guarantees:**
- "folder \`.\` maps to \`\\"root\\"\`; folders with \`/\` or \`\\\\\` are coalesced into a single-segment slug with \`\_\` separators; otherwise the folder string is returned unchanged after stripping leading \`./\`" — _single source of truth for the sidecar slug across generate, validate, and reporter. Three call sites previously inlined this logic; agreement is the contract._

**Residual contract:** none — _pure transformation captured by signature._

### [`SpecFrontmatter`](./frontmatter.ts#L48)

```ts
export type SpecFrontmatter = Schema.Schema.Type<typeof SpecFrontmatterSchemaInner>;
```

### [`PropertyRow`](./emit.ts#L50)

```ts
export interface PropertyRow {
  readonly id: string;
  readonly propertyType: PropertyType;
  readonly exports: ReadonlyArray<string>;
  readonly claim: string;
  readonly sourceRef: { readonly path: string; readonly line: number };
  readonly stubbed: boolean;
}
```

### [`escapeForYaml`](./escape.ts#L59)

```ts
export const escapeForYaml = (
  input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> => /* ... */
```

**Guarantees:**
- "output is YAML-safe; quotes, colons, dashes at line start are escaped" — _trust contract; emitted into SPEC.md frontmatter._

**Residual contract:** "the escaping is one-way" — _same as escapeForMarkdown._

### [`serializeSidecar`](./sidecar-writer.ts#L59)

```ts
export const serializeSidecar = (
  artifact: SpecArtifact,
): Effect.Effect<string, SidecarSchemaError> => /* ... */
```

**Guarantees:**
- "serialized JSON validates against the sidecar Schema; downstream \`decodeSpecArtifact(parse(output))\` round-trips" — _contract relied on by the sidecar's roundtrip property test._

**Residual contract:** "trailing newline is appended for POSIX-friendly files; JSON itself decodes regardless" — _byte-level format contract beyond the Schema shape._

### [`FolderAnalysis`](./emit.ts#L68)

```ts
export interface FolderAnalysis {
  readonly folder: string;
  readonly purpose: string | null;
  readonly exports: ReadonlyArray<ExportEntry>;
  readonly properties: ReadonlyArray<PropertyRow>;

  /**
   * Merged list of immediate files AND immediate subfolders that have
   * their own SPEC. Sorted by `display`. Renders as `## Children`.
   */
  readonly children: ReadonlyArray<ChildEntry>;
}
```

### [`ExecutionSidecar`](./reporter.ts#L71)

```ts
export type ExecutionSidecar = Schema.Schema.Type<typeof ExecutionSidecarSchema>;
```

### [`escapeForJson`](./escape.ts#L77)

```ts
export const escapeForJson = (
  input: string,
  _context: EscapeContext,
): Effect.Effect<string, never> => /* ... */
```

**Guarantees:**
- "output is JSON-string-safe; quotes, backslashes, control characters are escaped" — _trust contract; emitted into \`.safer-spec/&lt;folder&gt;.json\`._

**Residual contract:** "the escaping is one-way" — _same as escapeForMarkdown._

### [`writeSidecar`](./sidecar-writer.ts#L81)

```ts
export const writeSidecar = (
  payload: SidecarWritePayload,
): Effect.Effect<void, SidecarSchemaError | SidecarWriteError, FileSystem.FileSystem> => /* ... */
```

**Guarantees:**
- "atomic per-file write via @effect/platform FileSystem; no partial sidecars on failure" — _trust contract; downstream validate gate must not see half-written sidecars._

**Residual contract:** ".safer-spec/&lt;folder&gt;.json directory is created if missing; pre-existing sidecar is overwritten" — _side-effect contract; users see the directory created on first run._

### [`decodeExecutionSidecar`](./reporter.ts#L82)

```ts
export const decodeExecutionSidecar = Schema.decodeUnknown(ExecutionSidecarSchema);
```

**Guarantees:**
- "rejects malformed input on the Effect error channel with a typed ParseError, never throws" — _trust-boundary contract; validate's --implemented gate reads the on-disk artifact and routes parse failures to its typed gap error._

**Residual contract:** "decoded sidecar field invariants are enforced at decode time; classifierCoverage / preconditionPassRate may be \`null\` when the test run produced no measurable samples" — _lifecycle; populated only when an itSpec.prop body actually ran during the test execution._

### [`SpecArtifact`](./sidecar.ts#L95)

```ts
export type SpecArtifact = Schema.Schema.Type<typeof SpecArtifactSchemaInner>;
```

### [`SidecarSchemaError`](./sidecar.ts#L97)

```ts
export class SidecarSchemaError extends Data.TaggedError("SidecarSchemaError")<{
  readonly path: string;
  readonly issues: ReadonlyArray<string>;
}> { /* ... */ }
```

### [`escapeForMarkdownProse`](./escape.ts#L110)

```ts
export const escapeForMarkdownProse = (input: string): string => /* ... */
```

**Guarantees:**
- "output is safe to interpolate into markdown PROSE; backticks, code-fences, link syntax characters, asterisks, underscores, and HTML angle brackets are escaped; control characters are stripped" — _trust contract for sync emit paths (the Effect-flavored \`escapeForMarkdown\` is for Effect contexts; this is the same defense applied synchronously)._

**Residual contract:** "one-way; round-trip through a markdown decoder does not return the original string" — _same as escapeForMarkdown._

### [`relativeToFolder`](./link-resolver.ts#L125)

```ts
export const relativeToFolder = (folder: string, target: string): string => { /* ... */ }
```

Path-relative-to-folder for source links inside `&lt;folder>/SPEC.md`.
Same-folder: `./name.ts`. Cross-folder: `../...`. Absolute/external:
passthrough.

### [`SpecMeta`](./emit.ts#L175)

```ts
export interface SpecMeta {
  readonly generatedAtSha: string;
  readonly coverage: {
    readonly typeCoverage: number;
    readonly classifierCoverage: number | null;
    readonly preconditionPassRate: number | null;
    readonly branchCoverageFromSpecTests: number | null;
  };
  readonly thresholds: {
    readonly typeCoverage: number;
    readonly classifierCoverage: number;
    readonly preconditionPassRate: number;
  };
  readonly generatedFrom: {
    readonly jsdoc: string;
    readonly exports: string;
    readonly schemas: ReadonlyArray<string>;
    readonly properties: ReadonlyArray<string>;
    readonly eslint: string;
  };
}
```

### [`hashTestTree`](./reporter.ts#L201)

```ts
export const hashTestTree = (paths: ReadonlyArray<string>, read: (p: string) => string): string => { /* ... */ }
```

### [`emitMarkdown`](./emit.ts#L237)

```ts
export const emitMarkdown = (a: FolderAnalysis, meta: SpecMeta): string => { /* ... */ }
```

**Guarantees:**
- "two calls with the same \`analysis\` + \`meta\` produce byte-identical markdown; frontmatter decodes through \`decodeSpecFrontmatter\`" — _roundtrip contract on the emit step._

**Residual contract:** "internal section ordering is fixed: Purpose → Public Surface → Files → Properties" — _behavioral contract beyond the FolderAnalysis shape._

### [`buildSpecArtifact`](./emit.ts#L302)

```ts
export const buildSpecArtifact = (
  a: FolderAnalysis,
  meta: SpecMeta,
): SpecArtifact => /* ... */
```

**Guarantees:**
- "returned \`SpecArtifact\` decodes through \`decodeSpecArtifact\` without error" — _sidecar contract; downstream agents consume this shape._

**Residual contract:** "fields the codemod cannot yet compute (e.g. per-export sourceRef.sha) reuse \`meta.generatedAtSha\` as the closest stable identifier" — _per-line blame would require a separate git pass; the run-level SHA is a sound default for now._

### [`SaferSpecExecutionReporter`](./reporter.ts#L321)

```ts
export class SaferSpecExecutionReporter { /* ... */ }
```

**Guarantees:**
- "on \`onFinished\`, walks the File tree, aggregates fast-check stats per enclosing folder, and writes one \`folder/.safer-spec/slug.execution.json\` per folder with measurable stats" — _validate --implemented consumes these sidecars to populate SpecMeta.coverage; the reporter is the typed write boundary._

**Residual contract:** "filesystem failures are swallowed; the reporter must not crash the test run on a partial sidecar (validate will surface the missing sidecar via its own gap error)" — _separation of concerns; reporting is best-effort, validation is the strict gate._

### [`computeTypeCoverage`](./emit.ts#L345)

```ts
export const computeTypeCoverage = (a: FolderAnalysis): number => { /* ... */ }
```

**Guarantees:**
- "type coverage = (observed ∪ skipped) / |PROPERTY\_TYPES| averaged across exports; returns 1.0 when there are no exports" — _design-doc gate definition; validate compares against thresholds.typeCoverage._

**Residual contract:** "classifier coverage and precondition pass rate are null in \`--planned\` mode (no test execution sidecars)" — _lifecycle contract; populated only by \`validate --implemented\`._

### [`findMissingPropertyTypes`](./emit.ts#L365)

```ts
export const findMissingPropertyTypes = (
  a: FolderAnalysis,
): ReadonlyArray<PropertyType> => { /* ... */ }
```

**Guarantees:**
- "returns the property types that are required by at least one export but observed by no test row across the folder; sorted in PROPERTY\_TYPES tuple order" — _validate's typeCoverage diagnostic needs the missing-type list to route remediation; PROPERTY\_TYPES order is the stable contract._

**Residual contract:** "property types explicitly skipped on every export that would otherwise require them are not listed; skipped == covered for gating purposes" — _skipped is a deliberate opt-out and counts toward coverage._

## Children

- [`emit.ts`](./emit.ts) — Canonical SPEC.md serializer + \`SpecArtifact\` builder. Emits the \`SpecFrontmatter\`-shaped block and the typed sidecar value from a \`FolderAnalysis\` + \`SpecMeta\`. Canonical form: LF endings, lex-sort for file lists, source-order for exports; re-emission is byte-identical.
- [`escape.ts`](./escape.ts) — Escape directive body content for safe emission into Markdown, YAML frontmatter, and JSON sidecars. Defuses prompt-injection vectors via residual-contract strings that downstream agents will read as context.  Co-located with the directive grammar (\`directives.ts\`) since \`enforceLengthCap\` shares the cap constant and emits the same overflow error class. The four escape functions are exported as the spec domain's emit-time sanitization boundary. Each function's own \`@spec.guarantee\` documents its surface-specific safety claim.
- [`frontmatter.ts`](./frontmatter.ts) — SPEC.md frontmatter contract — Effect Schema for the YAML block emitted at the top of each generated SPEC.md. Coverage fields are nullable for \`--planned\` state where classifier and precondition numbers are not yet observable.  Schema constructor is private to this module; the public boundary is \`decodeSpecFrontmatter\` (decode unknown YAML output into the typed shape). Shape and refinements are captured by Effect Schema — no residual contract beyond the schema is in scope here.
- [`index.ts`](./index.ts) — Public barrel for \`spec/artifact/\`. Re-exports the external surface — what other layers (analysis, commands) reach for, not what the folder uses internally. The parsers \`decodeSpecFrontmatter\` and \`decodeSpecArtifact\` are deliberately NOT re-exported: they exist for their own roundtrip tests + \`sidecar-writer.ts\`'s same-folder roundtrip assertion. \`decodeExecutionSidecar\` IS exposed because \`analysis/pipeline.ts\` parses execution sidecars during the \`--implemented\` freshness check.
- [`link-resolver.ts`](./link-resolver.ts) — Resolves backticked symbol references in SPEC.md body prose. Local source references use declaration locations; workspace references can resolve to sibling SPEC.md anchors. Cross-file source resolution is a separate resolver capability.  Tagged error \`LinkResolutionError\` is co-located here.  Resolution strategy is heuristic over the symbol shape: - Identifier starting with \`@safer/\` → \`cross-spec\` (sibling spec folder anchor). - Identifier matching the npm-package shape (\`@scope/name\` / lowercase package) → \`external-package\` (returns \`UnresolvedExternal\`, no failure). - Identifier matching \`agent-code-guard/\*\` → \`agent-code-guard-rule\`. - Everything else → \`intra-file\` (local declaration).  The resolver classifies by shape only; it does NOT walk the AST. The build-time \`validate\` gate is responsible for fail-closed checking that intra-file symbols actually exist; this resolver returns the \`LinkResolution\` so the emit step can stamp an anchor.  Unresolved internal references resolve to \`intra-file\` placeholders that the validate gate inspects; unresolved external references return \`UnresolvedExternal\` (no failure). Per-export guarantees are on the individual exports below.
- [`reporter.ts`](./reporter.ts) — Vitest reporter that emits per-folder execution sidecars. Walks the file/task tree at \`onFinished\`, extracts the fast-check stats attached to each \`itSpec.prop\` call's \`task.meta.fastCheck\` slot, aggregates by enclosing folder (\`folder/\_\_tests\_\_/x.spec.test.ts\` is credited to \`folder\`), and writes \`folder/.safer-spec/slug.execution.json\`.  Boundary: Vitest's File/Task shape carries arbitrary user metadata; each task's \`meta.fastCheck\` goes through \`FastCheckTaskStatsSchema\` and the final sidecar through \`ExecutionSidecarSchema\` so validate can decode the on-disk artifact without trust assumptions.  \`SaferSpecExecutionReporter\` is the Vitest-facing class. validate's \`--implemented\` mode reads the emitted sidecar via \`decodeExecutionSidecar\`. The reporter composes its own \`NodeContext.layer\` because Vitest invokes it outside the codemod CLI's composition root, so this file owns its runtime boundary.
- [`sidecar-writer.ts`](./sidecar-writer.ts) — Writes \`.safer-spec/&lt;folder&gt;.json\` sidecar files. Sanitizes every string field on emit (size cap + escape) at the sidecar trust boundary.  Tagged error \`SidecarWriteError\` is co-located here (this is the file that emits it via Effect.fail on filesystem failures).  \`serializeSidecar\` encodes a \`SpecArtifact\` through the canonical Schema constructor (private to \`sidecar.ts\`), producing a JSON string with a trailing newline. \`writeSidecar\` writes that JSON to \`.safer-spec/&lt;folder-slug&gt;.json\`, creating the directory on first run. Output JSON roundtrips through \`decodeSpecArtifact\`; the roundtrip property is enforced in the sidecar domain's \`\_\_tests\_\_/\`. Per- export guarantees are on the individual exports below.
- [`sidecar.ts`](./sidecar.ts) — Sidecar JSON contract — the canonical artifact for LLM-agent consumption. Markdown SPEC.md is for humans; the sidecar is for tools. The Schema constructor stays private; \`decodeSpecArtifact\` is the public boundary.  Tagged error \`SidecarSchemaError\` is co-located here (it is emitted by the sidecar domain — both the decode boundary and the writer raise it on shape violations). All string fields are size-capped and escape-on-emit (no prompt injection through residual contracts) — directive bodies are user-controlled JSDoc and agents read this JSON as downstream execution context. Per-export guarantees are on the individual exports below.
- [`__tests__/emit-children.spec.test.ts`](./__tests__/emit-children.spec.test.ts) — Property stubs for the SPEC.md \`## Children\` section and the per-file rendering invariants. Splits out of \`emit.spec.test.ts\` to stay under the per-file line cap; both files cover \`emitMarkdown\`.
- [`__tests__/emit.spec.test.ts`](./__tests__/emit.spec.test.ts) — Property stubs for the canonical SPEC.md section emitter. Covers section ordering, line-ending canonicalization, roundtrip through frontmatter decode, lex-sort guarantees, and code-span safety. Children-section + per-file rendering properties live in \`emit-children.spec.test.ts\`.
- [`__tests__/escape.spec.test.ts`](./__tests__/escape.spec.test.ts) — Property stubs for the escape-on-emit helpers. Each helper defuses a different injection vector: markdown, YAML, JSON. The directive-grammar parser shares this domain because the body-length cap on directives and the escape helpers both live in \`spec/escape.ts\`.
- [`__tests__/frontmatter.spec.test.ts`](./__tests__/frontmatter.spec.test.ts) — Property stubs for the SPEC.md frontmatter contract. Tests reference the public \`decodeSpecFrontmatter\` boundary; the underlying Schema constructor stays private to spec/frontmatter.ts.
- [`__tests__/link-resolver.spec.test.ts`](./__tests__/link-resolver.spec.test.ts) — Property stubs for the link resolver. Inclusion: intra-file and cross-spec references resolve to valid hrefs. Cross-file source resolution is a separate resolver capability.
- [`__tests__/sidecar-writer.spec.test.ts`](./__tests__/sidecar-writer.spec.test.ts) — Property stubs for the sidecar writer. Roundtrip: written JSON decodes back to the same SpecArtifact value. Trust-boundary: every string field is escape-on-emit.
- [`__tests__/sidecar.spec.test.ts`](./__tests__/sidecar.spec.test.ts) — Property stubs for the sidecar JSON contract. Roundtrip covers encode/decode stability; Exception Raising covers malformed input; Typechecking verifies that decoded data matches the declared type.  Tests reference the public \`decodeSpecArtifact\` boundary; the underlying Schema constructor stays private to spec/sidecar.ts.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `emit-children-section-mixes-subfolders-files-tests` | `Inclusion` | `emitMarkdown` | \`## Children\` lists immediate SPEC'd subfolders (linking to \`&lt;sub&gt;/SPEC.md\`) before source files before tests; each row carries the file or subfolder \`@spec.purpose\` body when present | implemented |
| `emit-root-folder-spec-links-stay-in-repo` | `Constant Equality` | `emitMarkdown` | a SPEC.md at the repo root (\`folder === "."\`) reaches every file via \`./&lt;target&gt;\`; \`relativeToFolder\` never emits \`../...\` for the root sentinel | implemented |
| `emit-properties-table-cells-are-code-span-safe` | `Constant Bounds Checking` | `emitMarkdown` | a backtick (or other markdown markup) inside a property \`id\` / \`exports\` cell never closes the surrounding code span; the table grammar (column count, row terminator) survives any author-controlled directive content | implemented |
| `emit-file-purpose-rendered-with-link` | `Inclusion` | `emitMarkdown` | every entry in \`## Children\` for a file with a top-of-file \`@spec.purpose\` renders as \`\[\\\`&lt;rel-path&gt;\\\`\](./&lt;rel-path&gt;) — &lt;purpose body&gt;\`; files without \`@spec.purpose\` render as link-only | implemented |
| `emit-sha-stable` | `Roundtrip` | `emitMarkdown` | two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha | implemented |
| `emit-section-order-fixed` | `Inclusion` | `emitMarkdown` | emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture | implemented |
| `emit-canonical-line-endings` | `Constant Equality` | `emitMarkdown` | emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed | implemented |
| `emit-frontmatter-roundtrips` | `Roundtrip` | `emitMarkdown` | YAML frontmatter parsed from emitMarkdown output round-trips back to the same SpecFrontmatter shape | implemented |
| `emit-public-surface-source-order` | `Inclusion` | `emitMarkdown` | Public surface section lists exports in source-order (matching the file's declaration order) | implemented |
| `emit-files-section-lex-sorted` | `Inclusion` | `emitMarkdown` | Files section lists sibling filenames in lexicographic order | implemented |
| `emit-residual-bodies-escaped` | `Constant Bounds Checking` | `emitMarkdown` | residual-contract bodies emitted into markdown go through escapeForMarkdown; no injection | implemented |
| `jsdoc-escape-markdown-safe` | `Constant Bounds Checking` | `escapeForMarkdown` | escaped output never introduces new markdown syntactic structure (backticks, code-fences, link syntax) | implemented |
| `jsdoc-escape-yaml-safe` | `Constant Bounds Checking` | `escapeForYaml` | escaped output never introduces new YAML syntactic structure (quotes, colons, leading dashes) | implemented |
| `jsdoc-escape-json-safe` | `Constant Bounds Checking` | `escapeForJson` | escaped output never introduces new JSON syntactic structure (quotes, backslashes, control chars) | implemented |
| `frontmatter-roundtrip` | `Roundtrip` | `decodeSpecFrontmatter` | YAML emit(decode(yaml)) is byte-equal to the original well-formed yaml frontmatter block | implemented |
| `frontmatter-rejects-malformed` | `Exception Raising` | `decodeSpecFrontmatter` | malformed YAML fails on the Effect error channel with a typed ParseError, never throws | implemented |
| `frontmatter-decoded-shape` | `Typechecking` | `decodeSpecFrontmatter` | decoded frontmatter matches the declared SpecFrontmatter type at every branch | implemented |
| `frontmatter-decode-preserves-format-version` | `Inclusion` | `decodeSpecFrontmatter` | every emitted SPEC.md carries \`format-version: &lt;SPEC\_FORMAT\_VERSION&gt;\` in its YAML block and the decode boundary preserves that field on the decoded value (no silent strip during the schema decode) | implemented |
| `link-resolver-intra-file-anchor-pinned` | `Inclusion` | `resolveSymbol` | every intra-file resolution returns an href with the \`#\`-prefixed anchor form; the anchor sha is null at resolve time and the emit step stamps the git short-sha when it renders the anchor | implemented |
| `link-resolver-fails-internal-misses` | `Exception Raising` | `resolveSymbol` | external package references (scoped \`@scope/name\` or bare \`package-name\`) return UnresolvedExternal (no Effect failure); the resolver classifies by shape, leaving fail-closed checking of internal misses to the build-time validate gate | implemented |
| `sidecar-writer-roundtrip` | `Roundtrip` | `serializeSidecar`, `decodeSpecArtifact` | decode(parse(serialize(artifact))) returns the original artifact at every well-formed input | implemented |
| `sidecar-writer-atomic-on-failure` | `Exception Raising` | `writeSidecar` | partial sidecars are not left on disk on filesystem failures | implemented |
| `sidecar-writer-maps-root-folder-to-root-slug` | `Constant Equality` | `writeSidecar`, `sidecarSlug` | folder \`"."\` (project root sentinel) writes to \`.safer-spec/root.json\`; the writer's slug helper agrees with \`generate.ts\`/\`validate-pipeline.ts\` so write and validate never disagree on the on-disk path | implemented |
| `sidecar-writer-coalesces-path-separators-into-slug` | `Constant Equality` | `writeSidecar`, `sidecarSlug` | folders containing \`/\` and \`\\\` (Windows-style) produce a single-segment slug (\`src\_spec\`, not a path with separators) so the sidecar file is one filename under \`.safer-spec/\`, never an unintended nested directory | implemented |
| `sidecar-roundtrip` | `Roundtrip` | `decodeSpecArtifact` | encode(decode(json)) is byte-equal to the original well-formed json | implemented |
| `sidecar-rejects-malformed` | `Exception Raising` | `decodeSpecArtifact` | malformed input fails on the Effect error channel with a typed ParseError, never throws | implemented |
| `sidecar-decoded-shape` | `Typechecking` | `decodeSpecArtifact` | decoded artifact matches the declared SpecArtifact type at every branch of the union | implemented |
| `sidecar-preserves-skip-reason-and-residual-contract` | `Inclusion` | `decodeSpecArtifact` | sidecar JSON carries the full \`@spec.skip\` payload (propertyType + reason) and the \`@spec.residual-contract\` payload (tagged "none"/"some" with reason and optional body); JSON-only consumers can distinguish a deliberate opt-out from an incomplete required set | implemented |
| `sidecar-classifies-function-expression-exports` | `Constant Equality` | `decodeSpecArtifact` | \`export const f = function (...) { ... }\` decodes with \`shape: "function"\` and the sidecar's signature is body-stripped, matching the arrow-form (\`export const f = (...) =&gt; {...}\`); the implementation body is never leaked through the sidecar | implemented |
