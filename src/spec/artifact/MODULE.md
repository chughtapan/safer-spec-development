---
folder: src/spec/artifact
format-version: 0.1.0
generatedAtSha: 16cc46e7ee40c94f6db070cdd56ce038bc78114f
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 1
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0.9
  preconditionPassRate: 0.95
  branchCoverageFromSpecTests: 0.85
---

# SPEC

## Purpose

Public barrel for `spec/artifact/`. Exposes the abstraction level downstream layers consume — `buildSpecArtifact`/`emitMarkdown` to construct the artifact, `buildSpecMeta`/`findThresholdShortfall` for coverage analysis, `regenerateSidecar`/`loadExecutionSidecar`/ `computeTestTreeHash` for sidecar I/O, and `sidecarSlug` for path construction. The lower codecs (`serializeSidecar`, `decodeExecutionSidecar`, `hashTestTree`, `computeTypeCoverage`, `findMissingPropertyTypes`) are implementation details consumed only by the wrappers above.

Intentional non-exports:
- `SaferSpecExecutionReporter`: the Vitest reporter class. Exposed
via the `./reporter` package subpath so the barrel isn't pulled in by CLI consumers.
- `serializeSidecar`/`decodeSpecArtifact`: the sidecar codec pair used
by `regenerateSidecar` and the roundtrip property only.
- `escapeFor*` / `relativeToFolder`: internal to artifact, callers use
the higher-level wrappers.

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

### [`sidecarSlug`](./sidecar-writer.ts#L41)

```ts
export const sidecarSlug = (folder: string): string => { /* ... */ }
```

**Guarantees:**
- "folder \`.\` maps to \`\\"root\\"\`; folders with \`/\` or \`\\\\\` are coalesced into a single-segment slug with \`\_\` separators; otherwise the folder string is returned unchanged after stripping leading \`./\`" — _single source of truth for the sidecar slug across generate, validate, and reporter. Three call sites previously inlined this logic; agreement is the contract._

**Residual contract:** none — _pure transformation captured by signature._

**Skipped property types:**
- `Partial Roundtrip` — _no normalization-with-preservation semantics; this is a one-way name flattening._
- `Commutative Paths` — _single entry point; no alternative API path produces the same slug._
- `Constant Bounds Checking` — _output length is bounded by input length and not gated; no numeric/length contract._
- `Constant Non-Equality` — _distinct folder strings can intentionally collapse to the same slug (\`foo/bar\` and \`foo\_bar\` both map to \`foo\_bar\`); no anti-collision guarantee._
- `Inclusion` — _returns a single string, not a collection; no membership relation._
- `Exception Raising` — _total function on string input; cannot fail._
- `Typechecking` — _\`(string) =&gt; string\` is captured by the explicit signature; no separate type-level claim worth gating._

### [`ExportEntry`](./emit.ts#L47)

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

### [`buildSpecMeta`](./coverage.ts#L57)

```ts
export const buildSpecMeta = (
  analysis: FolderAnalysis,
  args: BuildSpecMetaArgs,
): SpecMeta => /* ... */
```

**Guarantees:**
- "builds a \`SpecMeta\` from analysis-derived type coverage + run-level args (generatedAtSha, thresholds); populates classifierCoverage/preconditionPassRate/branchCoverageFromSpecTests from \`execution\` when present" — _emit's frontmatter + sidecar both require meta; \`--implemented\` mode merges Vitest reporter stats into the gate inputs._

**Residual contract:** "branchCoverageFromSpecTests is null when coverage-summary.json is absent or inconsistent with the folder's source files (loud-fail signal for the gate); never null after a clean pnpm test --coverage run" — _lifecycle contract; null is the gate's only stale-data channel because v8 reports per-file totals, not per-test._

**Skipped property types:**
- `Partial Roundtrip` — _pure builder; no partial-recover relation back from SpecMeta to analysis + args._
- `Commutative Paths` — _single entry point; no equivalent API yields the same SpecMeta._
- `Exception Raising` — _pure synchronous transformation; cannot fail._

### [`PropertyRow`](./emit.ts#L62)

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

### [`ThresholdShortfall`](./coverage.ts#L75)

```ts
export interface ThresholdShortfall {
  readonly metric: "typeCoverage" | "preconditionPassRate" | "branchCoverageFromSpecTests";
  readonly observed: number;
  readonly threshold: number;
  readonly missingPropertyTypes: ReadonlyArray<string>;
}
```

### [`FolderAnalysis`](./emit.ts#L80)

```ts
export interface FolderAnalysis {
  readonly folder: string;
  readonly purpose: string | null;
  readonly exports: ReadonlyArray<ExportEntry>;
  readonly properties: ReadonlyArray<PropertyRow>;

  /**
   * Merged list of immediate files AND immediate subfolders that have
   * their own MODULE.md. Sorted by `display`. Renders as `## Children`.
   */
  readonly children: ReadonlyArray<ChildEntry>;
}
```

### [`regenerateSidecar`](./sidecar-writer.ts#L84)

```ts
export const regenerateSidecar = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): Effect.Effect<string, never> => /* ... */
```

**Guarantees:**
- "regenerates the SpecArtifact and returns the pretty-printed JSON used for on-disk diff; a \`SidecarSchemaError\` here is a defect (the artifact came from our own emitter)" — _validate's sidecar-drift cross-check needs the byte-for-byte regenerated form; the schema must succeed on artifacts we emit._

**Skipped property types:**
- `Partial Roundtrip` — _writer-only; the symmetric path is \`decodeSpecArtifact\`._
- `Commutative Paths` — _single entry point._
- `Constant Equality` — _output JSON byte sequence depends on the \`generatedAtSha\` carried in meta; not a constant._
- `Constant Non-Equality` — _distinct (analysis, meta) inputs can produce identical sidecars when the captured fields collapse._
- `Exception Raising` — _typed \`Effect of string with never error\` — internal schema errors die rather than failing the channel._

### [`findThresholdShortfall`](./coverage.ts#L108)

```ts
export const findThresholdShortfall = (
  analysis: FolderAnalysis,
  meta: SpecMeta,
): ThresholdShortfall | null => /* ... */
```

**Guarantees:**
- "returns the first observed-below-threshold metric (typeCoverage to precondition order) or null when all gates pass" — _validate emits one MissingImplError per folder; first failing gate is the surfaced one._

**Residual contract:** "metrics whose threshold is 0 are not gated regardless of observed value" — _zero-threshold is the explicit no-gate marker used by the permissive default config._

**Skipped property types:**
- `Partial Roundtrip` — _classifier-only; no recover-from-shortfall semantics._
- `Commutative Paths` — _single entry point; no equivalent API yields the same shortfall record._
- `Constant Non-Equality` — _distinct (analysis, meta) inputs can produce identical shortfalls or both-null outcomes._
- `Exception Raising` — _pure synchronous function; cannot fail._

### [`SpecMeta`](./emit.ts#L187)

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
    readonly preconditionPassRate: number;
    readonly branchCoverageFromSpecTests: number;
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

### [`computeTestTreeHash`](./reporter.ts#L233)

```ts
export const computeTestTreeHash = (
  fs: FileSystem.FileSystem,
  testPaths: ReadonlyArray<string>,
): Effect.Effect<string, never> => /* ... */
```

**Guarantees:**
- "reads the given test paths from disk, normalizes them to POSIX slashes, sorts by path, and returns the sha256 hex digest — the freshness-gate input validate compares against the on-disk execution sidecar's \`testTreeHash\`" — _Windows-host runs would otherwise hash with \`\\\` separators while the reporter writes POSIX. Normalizing here keeps the comparison stable across hosts._

**Residual contract:** "unreadable test files contribute the empty string to the hash; the reporter applies the same convention so a transient read failure doesn't poison the hash" — _byte-equality contract; missing-file -&gt; empty-bytes._

**Skipped property types:**
- `Partial Roundtrip` — _cryptographic hash is one-way by design; no inverse._
- `Commutative Paths` — _single entry point; no equivalent API yields the same hash._
- `Constant Bounds Checking` — _hash length is bounded by the digest algorithm and not gated as a property._
- `Constant Non-Equality` — _hash collisions are theoretically possible (different inputs → same digest) and intentionally not gated._
- `Inclusion` — _returns a scalar string, not a collection._
- `Exception Raising` — _typed \`Effect of string with never error\` — error channel is \`never\` by construction; read failures absorb to empty strings._

### [`emitMarkdown`](./emit.ts#L259)

```ts
export const emitMarkdown = (a: FolderAnalysis, meta: SpecMeta): string => { /* ... */ }
```

**Guarantees:**
- "two calls with the same \`analysis\` + \`meta\` produce byte-identical markdown, frontmatter block included" — _roundtrip contract on the emit step._

**Residual contract:** "internal section ordering is fixed: Purpose → Public Surface → Files → Properties" — _behavioral contract beyond the FolderAnalysis shape._

**Skipped property types:**
- `Partial Roundtrip` — _emitter-only; no companion parser back from rendered markdown._
- `Commutative Paths` — _single entry point._
- `Constant Non-Equality` — _distinct (analysis, meta) inputs can produce identical markdown when fields collapse._
- `Typechecking` — _pure synchronous function returning string; the FolderAnalysis / SpecMeta shapes are the type contract._
- `Exception Raising` — _pure synchronous transformation; cannot fail._

### [`loadBranchCoverage`](./reporter.ts#L276)

```ts
export const loadBranchCoverage = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
  options: LoadBranchCoverageOptions,
): Effect.Effect<number | null, never> => { /* ... */ }
```

**Guarantees:**
- "aggregates v8 branch coverage for the folder's immediate sources; null when coverage-summary.json is absent, an expected source has no entry, or a matching file did not execute; 1.0 when present-and-fully-branchless" — _validate's \`--implemented\` gate consumes branchCoverageFromSpecTests; the null/1.0 split lets it distinguish "user forgot --coverage" from "folder is just re-exports."_

**Residual contract:** "spec-test attribution holds only if coverage-summary.json came from a vitest run restricted to \*.spec.test.ts files; this repo enforces it via vitest.config.ts test.include" — _v8 coverage attributes per-file, not per-test; without the include narrowing the aggregate would credit ordinary tests toward branchCoverageFromSpecTests._

**Skipped property types:**
- `Roundtrip` — _reader-only; no companion writer that takes a ratio back to a coverage-summary.json._
- `Partial Roundtrip` — _aggregates many file-level numbers to a single scalar; no partial-recover relation._
- `Commutative Paths` — _single entry point; no equivalent API yields the same ratio._
- `Constant Non-Equality` — _distinct folders can intentionally produce identical ratios._
- `Inclusion` — _returns a scalar (or null), not a collection._

### [`buildSpecArtifact`](./emit.ts#L333)

```ts
export const buildSpecArtifact = (
  a: FolderAnalysis,
  meta: SpecMeta,
): SpecArtifact => /* ... */
```

**Guarantees:**
- "returned \`SpecArtifact\` decodes through \`decodeSpecArtifact\` without error" — _sidecar contract; downstream agents consume this shape._

**Residual contract:** "fields the codemod cannot yet compute (e.g. per-export sourceRef.sha) reuse \`meta.generatedAtSha\` as the closest stable identifier" — _per-line blame would require a separate git pass; the run-level SHA is a sound default for now._

**Skipped property types:**
- `Partial Roundtrip` — _builder-only; the decode side is \`decodeSpecArtifact\`._
- `Commutative Paths` — _single entry point._
- `Constant Bounds Checking` — _the artifact carries an exports array whose length is unbounded by intent; no numeric bound to gate._
- `Exception Raising` — _pure synchronous transformation; cannot fail._

### [`loadExecutionSidecar`](./reporter.ts#L415)

```ts
export const loadExecutionSidecar = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<ExecutionSidecar | null, never> => /* ... */
```

**Guarantees:**
- "loads the per-folder execution sidecar emitted by the Vitest reporter, decoded through \`ExecutionSidecarSchema\`; returns null when absent or malformed" — _validate's \`--implemented\` gate consumes the coverage values; absence is surfaced separately as a typed gap error._

**Skipped property types:**
- `Roundtrip` — _reader-only; writer side lives in the Vitest reporter (\`onTestRunEnd\`), not this function._
- `Partial Roundtrip` — _decode is total; no normalize-then-recover relation._
- `Commutative Paths` — _single entry point._
- `Constant Bounds Checking` — _sidecar shape (object | null) is not numeric; no bound to gate._
- `Constant Non-Equality` — _distinct folders can intentionally produce identical sidecars (e.g., two folders with the same property set and stats)._
- `Inclusion` — _returns an object or null, not a collection._

## Children

- [`coverage.ts`](./coverage.ts) — Coverage-tier helpers — \`buildSpecMeta\` composes the \`SpecMeta\` consumed by \`emitMarkdown\` and \`buildSpecArtifact\`; \`findThresholdShortfall\` returns the first below-threshold metric for validate's gate. Both fold in \`computeTypeCoverage\` and \`findMissingPropertyTypes\` from \`emit.ts\` so consumers don't have to assemble the pieces themselves.  Internal-only callers of \`computeTypeCoverage\` and \`findMissingPropertyTypes\` live here; the analysis layer composes \`buildSpecMeta\` and \`findThresholdShortfall\`, never the lower primitives.
- [`emit.ts`](./emit.ts) — Canonical MODULE.md serializer + \`SpecArtifact\` builder. Emits the YAML frontmatter block and the typed sidecar value from a \`FolderAnalysis\` + \`SpecMeta\`. Canonical form: LF endings, lex-sort for file lists, source-order for exports; re-emission is byte-identical.
- [`escape.ts`](./escape.ts) — Escape directive body content for safe emission into Markdown prose and property-table cells. Defuses prompt-injection vectors via residual-contract strings that downstream agents will read as context.  Two surfaces: \`escapeForMarkdownProse\` for running prose, and \`escapeForMarkdownTableCellProse\` for un-code-spanned table cells (adds pipe escaping and maps newlines to \`&lt;br&gt;\`). Each function's own \`@spec.guarantee\` documents its surface-specific safety claim.
- [`index.ts`](./index.ts) — Public barrel for \`spec/artifact/\`. Exposes the abstraction level downstream layers consume — \`buildSpecArtifact\`/\`emitMarkdown\` to construct the artifact, \`buildSpecMeta\`/\`findThresholdShortfall\` for coverage analysis, \`regenerateSidecar\`/\`loadExecutionSidecar\`/ \`computeTestTreeHash\` for sidecar I/O, and \`sidecarSlug\` for path construction. The lower codecs (\`serializeSidecar\`, \`decodeExecutionSidecar\`, \`hashTestTree\`, \`computeTypeCoverage\`, \`findMissingPropertyTypes\`) are implementation details consumed only by the wrappers above.  Intentional non-exports: - \`SaferSpecExecutionReporter\`: the Vitest reporter class. Exposed via the \`./reporter\` package subpath so the barrel isn't pulled in by CLI consumers. - \`serializeSidecar\`/\`decodeSpecArtifact\`: the sidecar codec pair used by \`regenerateSidecar\` and the roundtrip property only. - \`escapeFor\*\` / \`relativeToFolder\`: internal to artifact, callers use the higher-level wrappers.
- [`link-resolver.ts`](./link-resolver.ts) — Rebases a source path onto the folder whose MODULE.md links to it. Same-folder targets become \`./name.ts\`, cross-folder targets walk up with \`../\`, and absolute paths / URL schemes pass through unchanged. Used by \`emit.ts\` to stamp source links relative to each folder's MODULE.md.
- [`reporter.ts`](./reporter.ts) — Vitest reporter that emits per-folder execution sidecars. Walks the file/task tree at \`onFinished\`, extracts the fast-check stats attached to each \`itSpec.prop\` call's \`task.meta.fastCheck\` slot, aggregates by enclosing folder (\`folder/\_\_tests\_\_/x.spec.test.ts\` is credited to \`folder\`), and writes \`folder/.safer-spec/slug.execution.json\`.  Boundary: Vitest's File/Task shape carries arbitrary user metadata; each task's \`meta.fastCheck\` goes through \`FastCheckTaskStatsSchema\` and the final sidecar through \`ExecutionSidecarSchema\` so validate can decode the on-disk artifact without trust assumptions.  \`SaferSpecExecutionReporter\` is the Vitest-facing class. validate's \`--implemented\` mode reads the emitted sidecar via \`decodeExecutionSidecar\`. The reporter composes its own \`NodeContext.layer\` because Vitest invokes it outside the codemod CLI's composition root, so this file owns its runtime boundary.
- [`sidecar-writer.ts`](./sidecar-writer.ts) — Serializes the \`.safer-spec/&lt;folder&gt;.json\` sidecar payload. \`serializeSidecar\` encodes a \`SpecArtifact\` through the canonical Schema constructor (private to \`sidecar.ts\`), producing a JSON string with a trailing newline; \`regenerateSidecar\` builds that artifact and returns the byte-for-byte form validate's drift check compares against disk. \`sidecarSlug\` is the single source of truth for the on-disk filename. Output JSON roundtrips through \`decodeSpecArtifact\`; the roundtrip property is enforced in the sidecar domain's \`\_\_tests\_\_/\`. Per-export guarantees are on the individual exports below.
- [`sidecar.ts`](./sidecar.ts) — Sidecar JSON contract — the canonical artifact for LLM-agent consumption. Markdown MODULE.md is for humans; the sidecar is for tools. The Schema constructor stays private; \`decodeSpecArtifact\` is the public boundary.  Tagged error \`SidecarSchemaError\` is co-located here (it is emitted by the sidecar domain — both the decode boundary and the writer raise it on shape violations). All string fields are size-capped and escape-on-emit (no prompt injection through residual contracts) — directive bodies are user-controlled JSDoc and agents read this JSON as downstream execution context. Per-export guarantees are on the individual exports below.
- [`__tests__/coverage.spec.test.ts`](./__tests__/coverage.spec.test.ts) — Property tests for the coverage-tier and sidecar-I/O wrappers in \`spec/artifact/\`: \`buildSpecMeta\`, \`findThresholdShortfall\`, \`regenerateSidecar\`, \`loadExecutionSidecar\`, \`computeTestTreeHash\`, plus \`buildSpecArtifact\`. These are the abstractions downstream layers consume; the lower codecs (\`serializeSidecar\`, \`hashTestTree\`, \`decodeExecutionSidecar\`, \`computeTypeCoverage\`, \`findMissingPropertyTypes\`) are internal and tested transitively through these wrappers.
- [`__tests__/emit-children.spec.test.ts`](./__tests__/emit-children.spec.test.ts) — Property stubs for the MODULE.md \`## Children\` section and the per-file rendering invariants. Splits out of \`emit.spec.test.ts\` to stay under the per-file line cap; both files cover \`emitMarkdown\`.
- [`__tests__/emit.spec.test.ts`](./__tests__/emit.spec.test.ts) — Property stubs for the canonical MODULE.md section emitter. Covers section ordering, line-ending canonicalization, frontmatter field emission, lex-sort guarantees, and code-span safety. Children-section + per-file rendering properties live in \`emit-children.spec.test.ts\`.
- [`__tests__/escape.spec.test.ts`](./__tests__/escape.spec.test.ts) — Property stubs for the emit-time markdown escape helpers. \`escapeForMarkdownProse\` guards running prose; the table-cell variant additionally escapes pipes and maps newlines to \`&lt;br&gt;\`. Both defuse the markdown/HTML injection vector in author-controlled directive bodies.
- [`__tests__/link-resolver.spec.test.ts`](./__tests__/link-resolver.spec.test.ts) — Property stubs for the source-link path rebaser (\`relativeToFolder\`): root sentinel, same-folder prefix, absolute passthrough, and sibling-folder \`../\` walks.
- [`__tests__/sidecar-io.spec.test.ts`](./__tests__/sidecar-io.spec.test.ts) — Property tests for the sidecar-I/O wrappers in \`spec/artifact/\` — \`regenerateSidecar\` (build + serialize), \`loadExecutionSidecar\` (read + decode), \`computeTestTreeHash\` (read + hash). Split out of \`coverage.spec.test.ts\` to keep each file under the strict max-lines cap.
- [`__tests__/sidecar-writer.spec.test.ts`](./__tests__/sidecar-writer.spec.test.ts) — Property stubs for the sidecar writer. Roundtrip: written JSON decodes back to the same SpecArtifact value. Trust-boundary: every string field is escape-on-emit.
- [`__tests__/sidecar.spec.test.ts`](./__tests__/sidecar.spec.test.ts) — Property stubs for the sidecar JSON contract. Roundtrip covers encode/decode stability; Exception Raising covers malformed input; Typechecking verifies that decoded data matches the declared type.  Tests reference the public \`decodeSpecArtifact\` boundary; the underlying Schema constructor stays private to spec/sidecar.ts.
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for \`spec/artifact/\`. Adds the remaining property-type rows beyond what \`coverage.spec.test.ts\` and \`sidecar-io.spec.test.ts\` cover so every export crosses the gate threshold.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `build-spec-meta-typechecks-as-spec-meta` | `Typechecking` | `buildSpecMeta` | returns a \`SpecMeta\` object — the shape \`emitMarkdown\` and \`buildSpecArtifact\` consume | implemented |
| `build-spec-meta-empty-analysis-coverage-is-one` | `Constant Equality` | `buildSpecMeta` | a folder with no exports has \`coverage.typeCoverage === 1\` — the documented degenerate case (no exports = vacuously covered) | implemented |
| `build-spec-meta-stamps-sha-from-args` | `Inclusion` | `buildSpecMeta` | \`meta.generatedAtSha\` carries the \`generatedAtSha\` value passed in args — the audit trail every MODULE.md frontmatter stamps | implemented |
| `build-spec-meta-execution-stats-passthrough` | `Roundtrip` | `buildSpecMeta` | when an execution sidecar is supplied, the built \`SpecMeta.coverage\` carries its \`classifierCoverage\`/\`preconditionPassRate\`/\`branchCoverageFromSpecTests\` fields verbatim — the bridge wiring reporter stats into the validate gate | implemented |
| `build-spec-meta-coverage-in-zero-one` | `Constant Bounds Checking` | `buildSpecMeta` | \`meta.coverage.typeCoverage\` is always in \`\[0, 1\]\` — never NaN, never negative, never above 1 | implemented |
| `find-threshold-shortfall-zero-threshold-no-gate` | `Constant Equality` | `findThresholdShortfall` | a metric with threshold 0 is never gated — \`null\` is returned when every threshold is 0 | implemented |
| `find-threshold-shortfall-empty-analysis-no-shortfall` | `Inclusion` | `findThresholdShortfall` | a folder with no exports has \`typeCoverage = 1\` (the documented degenerate case from \`computeTypeCoverage\`) so even a non-zero threshold doesn't trip the gate — empty folders don't fail validate | implemented |
| `find-threshold-shortfall-typecheck` | `Typechecking` | `findThresholdShortfall` | returns either \`null\` or a \`ThresholdShortfall\` with \`{metric, observed, threshold, missingPropertyTypes}\` — the discriminant validate's gate routes on | implemented |
| `build-spec-artifact-typecheck` | `Typechecking` | `buildSpecArtifact` | returns an object with \`formatVersion\`, \`folder\`, \`generatedAtSha\`, \`exports\`, \`coverage\`, \`thresholds\` — the SpecArtifact contract | implemented |
| `build-spec-artifact-deterministic` | `Roundtrip` | `buildSpecArtifact` | two consecutive calls with the same inputs produce equal artifacts (deep) — the function is pure | implemented |
| `emit-children-section-mixes-subfolders-files-tests` | `Inclusion` | `emitMarkdown` | \`## Children\` lists immediate SPEC'd subfolders (linking to \`&lt;sub&gt;/MODULE.md\`) before source files before tests; each row carries the file or subfolder \`@spec.purpose\` body when present | implemented |
| `emit-root-folder-spec-links-stay-in-repo` | `Constant Equality` | `emitMarkdown` | a MODULE.md at the repo root (\`folder === "."\`) reaches every file via \`./&lt;target&gt;\`; \`relativeToFolder\` never emits \`../...\` for the root sentinel | implemented |
| `emit-properties-table-cells-are-code-span-safe` | `Constant Bounds Checking` | `emitMarkdown` | a backtick (or other markdown markup) inside a property \`id\` / \`exports\` cell never closes the surrounding code span; the table grammar (column count, row terminator) survives any author-controlled directive content | implemented |
| `emit-file-purpose-rendered-with-link` | `Inclusion` | `emitMarkdown` | every entry in \`## Children\` for a file with a top-of-file \`@spec.purpose\` renders as \`\[\\\`&lt;rel-path&gt;\\\`\](./&lt;rel-path&gt;) — &lt;purpose body&gt;\`; files without \`@spec.purpose\` render as link-only | implemented |
| `emit-sha-stable` | `Roundtrip` | `emitMarkdown` | two emit calls with the same artifact produce byte-identical strings modulo generated-at-sha | implemented |
| `emit-section-order-fixed` | `Inclusion` | `emitMarkdown` | emitted markdown contains all canonical sections in the fixed order Purpose → Public Surface → Files → Properties → Architecture | implemented |
| `emit-canonical-line-endings` | `Constant Equality` | `emitMarkdown` | emitted markdown uses LF line endings exclusively; trailing whitespace is trimmed | implemented |
| `emit-frontmatter-roundtrips` | `Roundtrip` | `emitMarkdown` | YAML frontmatter parsed from emitMarkdown output carries back the folder and format-version it was emitted with | implemented |
| `emit-public-surface-source-order` | `Inclusion` | `emitMarkdown` | Public surface section lists exports in source-order (matching the file's declaration order) | implemented |
| `emit-files-section-lex-sorted` | `Inclusion` | `emitMarkdown` | Files section lists sibling filenames in lexicographic order | implemented |
| `emit-residual-bodies-escaped` | `Constant Bounds Checking` | `emitMarkdown` | residual-contract bodies emitted into markdown go through escapeForMarkdownProse; no injection | implemented |
| `jsdoc-escape-markdown-prose-safe` | `Constant Bounds Checking` | `escapeForMarkdownProse` | escaped output never introduces new markdown syntactic structure (backticks, link syntax), leaks raw angle brackets, or carries a raw newline | implemented |
| `jsdoc-escape-table-cell-safe` | `Constant Bounds Checking` | `escapeForMarkdownTableCellProse` | escaped output escapes pipes (so it stays a single table cell), escapes markdown structure, leaks no raw angle bracket, and maps newlines to \`&lt;br&gt;\` | implemented |
| `relative-to-folder-root-sentinel` | `Constant Equality` | `relativeToFolder` | from folder "." (project root sentinel), target is rebased onto \`./TARGET\` rather than \`../TARGET\` | implemented |
| `relative-to-folder-same-folder-prefix` | `Constant Equality` | `relativeToFolder` | a target prefixed by the folder rebases to \`./REMAINDER\` | implemented |
| `relative-to-folder-absolute-passthrough` | `Constant Equality` | `relativeToFolder` | absolute paths and URL schemes pass through unchanged | implemented |
| `relative-to-folder-sibling-folders` | `Constant Equality` | `relativeToFolder` | sibling-folder targets emit a \`../OTHER/...\` link | implemented |
| `regenerate-sidecar-typecheck` | `Typechecking` | `regenerateSidecar` | returns an Effect — the typed channel the sidecar-drift check composes around | implemented |
| `regenerate-sidecar-deterministic` | `Roundtrip` | `regenerateSidecar` | two consecutive calls produce byte-identical JSON — the freshness-check contract sidecar-drift compares against | implemented |
| `regenerate-sidecar-non-empty-output` | `Constant Bounds Checking` | `regenerateSidecar` | emitted JSON is non-empty for any well-formed analysis — the sidecar file always has content | implemented |
| `compute-test-tree-hash-typecheck` | `Typechecking` | `computeTestTreeHash` | returns an Effect producing a hex string of length 64 — sha256 digest | implemented |
| `compute-test-tree-hash-empty-input-stable-hash` | `Constant Equality` | `computeTestTreeHash` | \`computeTestTreeHash(fs, \[\])\` is the sha256 of the empty string — the documented baseline hash for the degenerate-input case | implemented |
| `compute-test-tree-hash-deterministic` | `Roundtrip` | `computeTestTreeHash` | two calls with the same paths produce equal digests — the freshness-gate contract | implemented |
| `load-execution-sidecar-typecheck` | `Typechecking` | `loadExecutionSidecar` | returns an Effect that yields \`ExecutionSidecar \| null\` — \`null\` when the sidecar file is absent or malformed | implemented |
| `load-execution-sidecar-missing-yields-null` | `Constant Equality` | `loadExecutionSidecar` | a folder that has no execution sidecar on disk resolves to \`null\` — absence is a typed signal, not an error | implemented |
| `load-execution-sidecar-graceful-on-bogus-folder` | `Exception Raising` | `loadExecutionSidecar` | \`loadExecutionSidecar\` never fails on the Effect error channel — missing/malformed sidecars resolve to \`null\`, not a typed error | implemented |
| `load-branch-coverage-typecheck` | `Typechecking` | `loadBranchCoverage` | returns an Effect that yields a number in \`\[0, 1\]\` or \`null\` — the per-folder branch ratio v8 coverage attributes to spec tests, null when coverage-summary.json is absent or has no branch data for the folder | implemented |
| `load-branch-coverage-missing-folder-yields-null` | `Constant Equality` | `loadBranchCoverage` | asking for branch coverage of a folder that has no entries in coverage-summary.json resolves to \`null\` — folder absence is a typed signal, not an error | implemented |
| `load-branch-coverage-graceful-on-bogus-input` | `Exception Raising` | `loadBranchCoverage` | \`loadBranchCoverage\` never fails on the Effect error channel — coverage-summary.json absence or malformation resolves to \`null\`, not a typed error | implemented |
| `load-branch-coverage-bounded-in-zero-one` | `Constant Bounds Checking` | `loadBranchCoverage` | when not null, the returned ratio is in \`\[0, 1\]\` — branch coverage is a ratio of covered / total | implemented |
| `sidecar-writer-roundtrip` | `Roundtrip` | `serializeSidecar`, `decodeSpecArtifact` | decode(parse(serialize(artifact))) returns the original artifact at every well-formed input | implemented |
| `sidecar-writer-maps-root-folder-to-root-slug` | `Constant Equality` | `sidecarSlug` | folder \`"."\` (project root sentinel) maps to \`root\` so the sidecar writes to \`.safer-spec/root.json\`; the slug helper agrees with \`generate.ts\`/\`validate-pipeline.ts\` so write and validate never disagree on the on-disk path | implemented |
| `sidecar-writer-coalesces-path-separators-into-slug` | `Constant Equality` | `sidecarSlug` | folders containing \`/\` and \`\\\` (Windows-style) produce a single-segment slug (\`src\_spec\`, not a path with separators) so the sidecar file is one filename under \`.safer-spec/\`, never an unintended nested directory | implemented |
| `sidecar-roundtrip` | `Roundtrip` | `decodeSpecArtifact` | encode(decode(json)) is byte-equal to the original well-formed json | implemented |
| `sidecar-rejects-malformed` | `Exception Raising` | `decodeSpecArtifact` | malformed input fails on the Effect error channel with a typed ParseError, never throws | implemented |
| `sidecar-decoded-shape` | `Typechecking` | `decodeSpecArtifact` | decoded artifact matches the declared SpecArtifact type at every branch of the union | implemented |
| `sidecar-preserves-skip-reason-and-residual-contract` | `Inclusion` | `decodeSpecArtifact` | sidecar JSON carries the full \`@spec.skip\` payload (propertyType + reason) and the \`@spec.residual-contract\` payload (tagged "none"/"some" with reason and optional body); JSON-only consumers can distinguish a deliberate opt-out from an incomplete required set | implemented |
| `sidecar-classifies-function-expression-exports` | `Constant Equality` | `decodeSpecArtifact` | \`export const f = function (...) { ... }\` decodes with \`shape: "function"\` and the sidecar's signature is body-stripped, matching the arrow-form (\`export const f = (...) =&gt; {...}\`); the implementation body is never leaked through the sidecar | implemented |
| `build-spec-meta-distinct-shas-distinct-meta` | `Constant Non-Equality` | `buildSpecMeta` | two \`buildSpecMeta\` calls with different \`generatedAtSha\` values produce \`SpecMeta\` objects with different \`generatedAtSha\` fields — no payload aliasing across instances | implemented |
| `find-threshold-shortfall-bounded-output-shape` | `Constant Bounds Checking` | `findThresholdShortfall` | when non-null, the shortfall's \`missingPropertyTypes\` length stays within \`\[0, 9\]\` — the closed PROPERTY\_TYPES taxonomy size is the upper bound | implemented |
| `find-threshold-shortfall-roundtrip-on-zero-meta` | `Roundtrip` | `findThresholdShortfall` | two calls with the same meta produce equal results — the function is pure on its declared inputs | implemented |
| `build-spec-artifact-stamps-folder` | `Inclusion` | `buildSpecArtifact` | the returned artifact's \`folder\` field matches the input analysis's folder — the identity stamp downstream sidecar paths key on | implemented |
| `build-spec-artifact-stamps-format-version` | `Constant Equality` | `buildSpecArtifact` | the returned artifact's \`formatVersion\` field matches \`SPEC\_FORMAT\_VERSION\` — the stable label \`migrate\` keys committed artifacts on across bumps | implemented |
| `build-spec-artifact-non-equal-on-distinct-shas` | `Constant Non-Equality` | `buildSpecArtifact` | two artifacts built with different \`generatedAtSha\` in their meta have different \`generatedAtSha\` fields — sha aliasing would defeat the audit trail | implemented |
| `regenerate-sidecar-parseable-json` | `Inclusion` | `regenerateSidecar` | the emitted string is well-formed JSON parseable to an object with a \`formatVersion\` field — the freshness-check contract validate's sidecar-drift reads | implemented |
| `sidecar-slug-roundtrip-idempotent-on-canonical` | `Roundtrip` | `sidecarSlug` | \`sidecarSlug(sidecarSlug(folder))\` is a stable string output — applying the slug transform to its own result doesn't introduce separators | implemented |
