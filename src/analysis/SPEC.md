---
folder: src/analysis
format-version: 0.1.0
generatedAtSha: ef221bd06633c16c0b894dcff2bb375773a4be5b
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0.48148148148148157
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0.4
  classifierCoverage: 0
  preconditionPassRate: 0
---

# SPEC

## Purpose

Barrel for the `analysis/` layer. Exposes two high-level per-folder operations — `generateFolder` and `validateFolder` — plus the `collectFolderInputs` enumeration helper commands use to loop over discovered folders. Pipeline primitives (`buildSpecMeta`, `regenerateMarkdown`, `regenerateSidecar`, individual gap-checks, directive parsers, etc.) stay internal to this folder; commands at `commands/{generate,validate}.ts` compose only the two high-level functions, not the underlying machinery.

`diagnosticLines` and `unresolvedFolderError` are exposed because the cli renders gap-class errors itself (string formatting + the no-folders-resolved guard for `--folder X` typos).

`buildKnownExports` is the project-level setup the generate command computes once before looping over folders; calling it inside `generateFolder` would re-scan every project source on every folder.

## Public surface

### [`GenerateFolderError`](./orchestrate.ts#L68)

```ts
export class GenerateFolderError extends Data.TaggedError("GenerateFolderError")<{
  readonly folder: string;
  readonly reason: string;
}> { /* ... */ }
```

### [`GenerateFolderIOError`](./orchestrate.ts#L73)

```ts
export class GenerateFolderIOError extends Data.TaggedError("GenerateFolderIOError")<{
  readonly folder: string;
  readonly path: string;
  readonly cause: string;
}> { /* ... */ }
```

### [`ValidateGapError`](./checks.ts#L74)

```ts
export type ValidateGapError =
  | MissingSpecPropertyError
  | MissingStubError
  | MissingImplError;
```

### [`GenerateFolderAnyError`](./orchestrate.ts#L84)

```ts
export type GenerateFolderAnyError =
  | GenerateFolderError
  | GenerateFolderIOError
  | DirectiveParseError;
```

### [`buildKnownExports`](./orchestrate.ts#L183)

```ts
export const buildKnownExports = (ctx: ProjectContext): ReadonlySet<string> => { /* ... */ }
```

Project-wide symbol existence set. Pass through to `generateFolder` so
`extractProperties`'s typo gate accepts cross-folder symbol references
while still rejecting non-existent names. Compute once per `generate`
run; reusable across folders.

### [`generateFolder`](./orchestrate.ts#L267)

```ts
export const generateFolder = (
  args: GenerateFolderArgs,
): Effect.Effect<GenerateFolderArtifacts, GenerateFolderAnyError> => /* ... */
```

**Guarantees:**
- "returns the artifacts (markdown + sidecar JSON) for one folder; folder writes are the caller's responsibility so --dry-run / --write decisions stay at the CLI boundary" — _separation of pipeline (here) from I/O policy (commands/)._

**Residual contract:** "execution metrics from the Vitest reporter are NOT folded into the emitted artifacts; committed SPEC.md must be deterministic at a given tree SHA regardless of whether tests ran locally" — _drift-check byte-equality contract._

### [`validateFolder`](./orchestrate.ts#L299)

```ts
export const validateFolder = (
  args: ValidateFolderArgs,
): Effect.Effect<string | null, ValidateGapError> => /* ... */
```

### [`diagnosticLines`](./checks.ts#L334)

```ts
export const diagnosticLines = (
  tag: ValidateGapError["_tag"],
  payload: GapErrorPayload,
): ReadonlyArray<string> => /* ... */
```

## Children

- [`checks.ts`](./checks.ts) — Validate's gap-class cross-checks. Co-locates the four tagged errors (MissingSpecPropertyError, MissingStubError, MissingImplError, NoFoldersResolvedError) with the check effects that emit them and the diagnostic-builder helpers that shape their bodies.  Extracted from \`validate.ts\` to keep the orchestration file under the strict max-lines cap; the public surface still routes through \`validate.ts\` (this module is internal to the commands layer).
- [`exports.ts`](./exports.ts) — Walks a TypeScript source file via ts-morph and returns the list of exported declaration names plus their source lines. Used by \`generate.ts\` to build the SPEC.md \`## Public surface\` rows and match per-export \`@spec\*\` directives to their declarations.  \`collectExports\` accepts sibling source files + tsconfig \`paths\` via \`CollectExportsOptions\` so it can follow barrel re-exports across files and aliases. The caller (commands/validate-pipeline.ts's \`loadProjectContext\`) supplies that input.
- [`folders.ts`](./folders.ts) — Pure helper for the \`## Children\` section of an emitted SPEC.md. Merges immediate SPEC'd subfolders with the folder's sources and tests into a flat, alphabetically-sorted entry list. Consumed by \`analysis/pipeline.ts\`'s \`inspectFolder\` and \`analysis/orchestrate.ts\`'s \`buildAnalysis\`; not re-exported via the analysis barrel since \`FolderAnalysis.children\` is the public-facing data shape.
- [`index.ts`](./index.ts) — Barrel for the \`analysis/\` layer. Exposes two high-level per-folder operations — \`generateFolder\` and \`validateFolder\` — plus the \`collectFolderInputs\` enumeration helper commands use to loop over discovered folders. Pipeline primitives (\`buildSpecMeta\`, \`regenerateMarkdown\`, \`regenerateSidecar\`, individual gap-checks, directive parsers, etc.) stay internal to this folder; commands at \`commands/{generate,validate}.ts\` compose only the two high-level functions, not the underlying machinery.  \`diagnosticLines\` and \`unresolvedFolderError\` are exposed because the cli renders gap-class errors itself (string formatting + the no-folders-resolved guard for \`--folder X\` typos).  \`buildKnownExports\` is the project-level setup the generate command computes once before looping over folders; calling it inside \`generateFolder\` would re-scan every project source on every folder.
- [`orchestrate.ts`](./orchestrate.ts) — Per-folder pipeline orchestration. \`generateFolder\` and \`validateFolder\` are the public entry points that compose the parsers, pipeline helpers, and gap-class checks under one call. Commands at \`commands/{generate,validate}.ts\` consume these two functions plus folder discovery from \`project/\`; the pipeline primitives (\`buildSpecMeta\`, \`regenerateMarkdown\`, \`checkDrift\`, etc.) stay internal to this folder.  \`generateFolder\`: walks one folder's source + test + immediate subfolder index.ts; parses directives; builds the \`FolderAnalysis\`; emits the markdown + sidecar JSON. Returns the artifacts; callers own the on-disk write step (so \`--dry-run\` works at the cli boundary).  \`validateFolder\`: walks the same pipeline, then diffs the regenerated markdown + sidecar against the on-disk artifacts, enforces coverage thresholds, and runs the per-test directive cross-checks. Returns the folder string on success; fails with a \`ValidateGapError\` whose tag the cli maps to a POSIX exit code.
- [`pipeline.ts`](./pipeline.ts) — Shared analysis pipeline for \`validate\`. Walks the same inputs as \`generate\` (sources, tests, index barrel) and returns the \`FolderAnalysis\` that the markdown emitter consumes plus the per-test issues list (\`ItSpecIssue\[\]\`) that \`validate.ts\` maps to its gap-class exit codes.
- [`properties.ts`](./properties.ts) — Walks \`\*.spec.test.ts\` source via ts-morph and extracts each \`itSpec.todo\` / \`itSpec.prop\` call site plus the four Amendment-6 directives (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`) that should immediately precede it.  Per-test directives bind to the JSDoc block IMMEDIATELY preceding the call (via ts-morph's \`Statement.getJsDocs()\` on the call's enclosing statement); the previous "closest earlier" search across the whole file silently inherited directives from unrelated blocks.  Returns rows for downstream emit + an \`issues\` list. Issues are surfaced to \`validate\` as MissingStub / MissingSpecProperty / MissingImpl gap errors with stable exit codes.
- [`__tests__/orchestrate.spec.test.ts`](./__tests__/orchestrate.spec.test.ts) — Property tests for the \`analysis/\` public surface — \`generateFolder\`, \`validateFolder\`, \`buildKnownExports\`, \`diagnosticLines\`, and the two \`GenerateFolder\*\` tagged errors. The orchestrate functions' end-to-end behavior is exercised by \`commands/\_\_tests\_\_/validate.spec.test.ts\` (self-host); this file covers the shape contracts at the analysis layer without re-walking the whole project tree.
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for \`analysis/\`. Adds the remaining property-type rows beyond \`orchestrate.spec.test.ts\` so each export crosses the gate threshold.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `generate-folder-is-callable` | `Typechecking` | `generateFolder` | \`generateFolder\` is exported as a callable function whose return type is an Effect — the typed channel commands compose | implemented |
| `generate-folder-arity` | `Constant Equality` | `generateFolder` | \`generateFolder\` has arity 1: \`(args: GenerateFolderArgs) =&gt; Effect\` — the signature commands depend on | implemented |
| `validate-folder-is-callable` | `Typechecking` | `validateFolder` | \`validateFolder\` is exported as a callable function — the typed channel commands compose for the per-folder gate run | implemented |
| `validate-folder-arity` | `Constant Equality` | `validateFolder` | \`validateFolder\` has arity 1: \`(args: ValidateFolderArgs) =&gt; Effect\` — the signature commands depend on | implemented |
| `build-known-exports-handles-empty-context` | `Inclusion` | `buildKnownExports` | \`buildKnownExports\` on a project context with no sources returns an empty set — degenerate input yields degenerate output, no fabrication | implemented |
| `build-known-exports-typecheck` | `Typechecking` | `buildKnownExports` | returns a readonly Set of strings — the type \`extractProperties\`'s typo gate accepts via \`has()\` lookups | implemented |
| `generate-folder-error-roundtrips-payload` | `Roundtrip` | `GenerateFolderError` | \`GenerateFolderError\` exposes the \`{folder, reason}\` payload it was constructed with — the surface the cli's exit-formatter reads | implemented |
| `generate-folder-error-is-throwable` | `Exception Raising` | `GenerateFolderError` | \`GenerateFolderError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` without payload loss | implemented |
| `generate-folder-error-typecheck` | `Typechecking` | `GenerateFolderError` | \`GenerateFolderError\` instances extend \`Error\` and expose \`\_tag\` (string), \`folder\` (string), \`reason\` (string) | implemented |
| `generate-folder-io-error-roundtrips-payload` | `Roundtrip` | `GenerateFolderIOError` | \`GenerateFolderIOError\` exposes the \`{folder, path, cause}\` payload it was constructed with — the surface the cli's exit-formatter reads on I/O failures | implemented |
| `generate-folder-io-error-is-throwable` | `Exception Raising` | `GenerateFolderIOError` | \`GenerateFolderIOError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` — the cli's I/O failure exit path | implemented |
| `generate-folder-io-error-typecheck` | `Typechecking` | `GenerateFolderIOError` | instances extend \`Error\` and expose \`\_tag === "GenerateFolderIOError"\` — the discriminant the cli catches by tag | implemented |
| `diagnostic-lines-emits-five-lines` | `Constant Equality` | `diagnosticLines` | \`diagnosticLines(tag, payload)\` returns exactly 5 lines (header + 4 indented fields) — the stable format the cli's stderr renderer concatenates | implemented |
| `diagnostic-lines-header-carries-tag-and-problem` | `Inclusion` | `diagnosticLines` | the first emitted line carries both the \`\_tag\` (in brackets) and the diagnostic's \`problem\` body — readers grep stderr by tag | implemented |
| `diagnostic-lines-typecheck` | `Typechecking` | `diagnosticLines` | returns a ReadonlyArray of strings — the shape the cli's stderr renderer iterates | implemented |
| `diagnostic-lines-bounded-line-count` | `Constant Bounds Checking` | `diagnosticLines` | emitted line count is exactly 5 regardless of payload content size — stable for stderr framing | implemented |
| `generate-folder-non-equal-distinct-functions` | `Constant Non-Equality` | `generateFolder` | \`generateFolder\` and \`validateFolder\` are different function references — the codemod composes both at distinct call sites | implemented |
| `generate-folder-bounded-name-length` | `Constant Bounds Checking` | `generateFolder` | \`generateFolder.name\` is "generateFolder" (length 14) — the stable export identity that the package's facade keys on | implemented |
| `validate-folder-distinct-name` | `Constant Equality` | `validateFolder` | \`validateFolder.name === "validateFolder"\` — the stable export identity | implemented |
| `validate-folder-includes-name-substring` | `Inclusion` | `validateFolder` | \`validateFolder.name\` contains the substring "validate" — the codemod's \`@spec.exports\` cross-check resolves the function by name | implemented |
| `build-known-exports-roundtrip-on-empty-context` | `Roundtrip` | `buildKnownExports` | two calls on equivalent empty contexts produce equal empty sets — the function is pure on its declared inputs | implemented |
| `build-known-exports-distinct-arity` | `Constant Equality` | `buildKnownExports` | \`buildKnownExports.length === 1\` — the function takes a single \`ProjectContext\` argument | implemented |
| `diagnostic-lines-bounded-payload-length` | `Constant Bounds Checking` | `diagnosticLines` | emitted line count is exactly 5 regardless of payload content size — stable for stderr framing | implemented |
| `diagnostic-lines-roundtrip-on-same-payload` | `Roundtrip` | `diagnosticLines` | two calls with the same tag + payload produce equal arrays — the function is pure | implemented |
| `generate-folder-error-bounded-payload` | `Constant Bounds Checking` | `GenerateFolderError` | every constructed instance carries a string \`folder\` and \`reason\` — the runtime shape the cli's exit-formatter reads | implemented |
| `generate-folder-error-inclusion-tag` | `Inclusion` | `GenerateFolderError` | every \`GenerateFolderError\` instance carries \`\_tag === "GenerateFolderError"\` — the discriminant the cli catches by tag | implemented |
| `generate-folder-io-error-bounded-payload` | `Constant Bounds Checking` | `GenerateFolderIOError` | every constructed instance carries string \`folder\`, \`path\`, \`cause\` — the I/O failure body the cli's exit-formatter reads | implemented |
| `generate-folder-io-error-inclusion-tag` | `Inclusion` | `GenerateFolderIOError` | every \`GenerateFolderIOError\` instance carries \`\_tag === "GenerateFolderIOError"\` — the discriminant the cli catches by tag | implemented |
