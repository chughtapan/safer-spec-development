---
folder: src/analysis
format-version: 0.1.0
generatedAtSha: 8f3e4caed805be95f6824b851d172439cc17c090
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
  typeCoverage: 0.4
  preconditionPassRate: 0
  branchCoverageFromSpecTests: 0.75
---

# SPEC

## Purpose

Barrel for the `analysis/` layer. Exposes two high-level per-folder operations — `generateFolder` and `validateFolder` — plus the `collectFolderInputs` enumeration helper commands use to loop over discovered folders. Pipeline primitives (`buildSpecMeta`, `regenerateMarkdown`, `regenerateSidecar`, individual gap-checks, directive parsers, etc.) stay internal to this folder; commands at `commands/{generate,validate}.ts` compose only the two high-level functions, not the underlying machinery.

`diagnosticLines` and `unresolvedFolderError` are exposed because the cli renders gap-class errors itself (string formatting + the no-folders-resolved guard for `--folder X` typos).

`buildKnownExports` is the project-level setup the generate command computes once before looping over folders; calling it inside `generateFolder` would re-scan every project source on every folder.

## Public surface

### [`ValidateGapError`](./checks.ts#L74)

```ts
export type ValidateGapError =
  | MissingSpecPropertyError
  | MissingStubError
  | MissingImplError;
```

### [`GenerateFolderError`](./orchestrate.ts#L80)

```ts
export class GenerateFolderError extends Data.TaggedError("GenerateFolderError")<{
  readonly folder: string;
  readonly reason: string;
}> { /* ... */ }
```

**Skipped property types:**
- `Partial Roundtrip` — _tagged error class; no normalize-then-recover relation on the carried fields._
- `Commutative Paths` — _single constructor; no alternative path produces the same error._
- `Constant Equality` — _instances carry per-failure \`folder\`/\`reason\` strings; equality is per-instance, not constant._
- `Constant Non-Equality` — _distinct failure inputs can produce identical messages when folder and reason collapse._

### [`GenerateFolderIOError`](./orchestrate.ts#L95)

```ts
export class GenerateFolderIOError extends Data.TaggedError("GenerateFolderIOError")<{
  readonly folder: string;
  readonly path: string;
  readonly cause: string;
}> { /* ... */ }
```

**Skipped property types:**
- `Partial Roundtrip` — _tagged error class; no normalize-then-recover relation._
- `Commutative Paths` — _single constructor._
- `Constant Equality` — _instances carry per-IO-failure fields; equality is per-instance._
- `Constant Non-Equality` — _distinct IO failures can produce identical cause strings._

### [`GenerateFolderAnyError`](./orchestrate.ts#L106)

```ts
export type GenerateFolderAnyError =
  | GenerateFolderError
  | GenerateFolderIOError
  | DirectiveParseError;
```

### [`buildKnownExports`](./orchestrate.ts#L215)

```ts
export const buildKnownExports = (ctx: ProjectContext): ReadonlySet<string> => { /* ... */ }
```

**Guarantees:**
- "returns a ReadonlySet containing every value-bearing export name from the project's source tree, including both the exported name and any rename-declared name; computed once per generate run and reused across folders" — _\`extractProperties\`'s typo gate looks up names via this set; a misspelled name in \`@spec.exports\` must fail the gate, not silently inherit some other symbol's metadata._

**Skipped property types:**
- `Partial Roundtrip` — _a Set is the projection of a name iterator; no normalize-then-recover relation._
- `Commutative Paths` — _single entry point; no equivalent API path produces the same set._
- `Constant Bounds Checking` — _set size is unbounded; depends on project source count._
- `Constant Non-Equality` — _no anti-collision invariant; two distinct projects can have overlapping export names._
- `Exception Raising` — _total function on a fully-loaded ProjectContext; nothing inside throws._

### [`diagnosticLines`](./checks.ts#L356)

```ts
export const diagnosticLines = (
  tag: ValidateGapError["_tag"],
  payload: GapErrorPayload,
): ReadonlyArray<string> => /* ... */
```

**Guarantees:**
- "returns a 5-line array: \[Tag\] header, location, cause, fix, docs link — the canonical stderr renderer for gap-class errors" — _cli's stderr output is byte-stable for downstream automation that greps the exit code + first line._

**Skipped property types:**
- `Partial Roundtrip` — _one-way formatter; no parser back from the rendered lines._
- `Commutative Paths` — _single entry point; no equivalent renderer._
- `Constant Non-Equality` — _distinct tag/payload pairs can produce identical lines when payload fields collide._
- `Exception Raising` — _pure synchronous formatter; cannot fail._

### [`computeProjectNewestMtime`](./orchestrate.ts#L393)

```ts
export const computeProjectNewestMtime = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  projectCtx: ProjectContext,
): Effect.Effect<number, never> => /* ... */
```

**Guarantees:**
- "returns the max mtime across every project source file, every spec.test.ts discovered under each folder, and the runner/codemod config files (vitest.config.ts, safer-spec.config.json); 0 when nothing exists" — _validate's branchCoverage freshness check needs a project-wide reference; config files can shift coverage attribution without touching sources or tests._

**Skipped property types:**
- `Roundtrip` — _reduces a file-set to a scalar; the reduction is one-way (no inverse)._
- `Partial Roundtrip` — _no normalize-then-recover semantics; the function projects to a single number._
- `Commutative Paths` — _single entry point; no equivalent API path produces the same mtime._
- `Constant Equality` — _filesystem-dependent; two calls can return different numbers as files are touched._
- `Constant Non-Equality` — _no distinct-output invariant; different inputs can produce equal mtimes when files share atimes._
- `Inclusion` — _returns a scalar, not a collection._
- `Exception Raising` — _typed as \`Effect of number with never error\` — error channel is \`never\` by construction._
- `Typechecking` — _return type is captured by the explicit \`Effect.Effect of number with never error\` signature; no separate type-level claim to gate._
- `Constant Bounds Checking` — _the value is a unix-epoch millis number; gating on the &gt;=0 bound would add nothing observable beyond what the type already guarantees._

### [`generateFolder`](./orchestrate.ts#L445)

```ts
export const generateFolder = (
  args: GenerateFolderArgs,
): Effect.Effect<GenerateFolderArtifacts, GenerateFolderAnyError> => /* ... */
```

**Guarantees:**
- "returns the artifacts (markdown + sidecar JSON) for one folder; folder writes are the caller's responsibility so --dry-run / --write decisions stay at the CLI boundary" — _separation of pipeline (here) from I/O policy (commands/)._

**Residual contract:** "execution metrics from the Vitest reporter are NOT folded into the emitted artifacts; committed SPEC.md must be deterministic at a given tree SHA regardless of whether tests ran locally" — _drift-check byte-equality contract._

**Skipped property types:**
- `Partial Roundtrip` — _no normalize-then-recover semantics; this is an orchestrator that emits artifacts._
- `Commutative Paths` — _single entry point; no equivalent API path produces the same artifacts._
- `Constant Non-Equality` — _different folders can intentionally produce identical artifacts when sources collapse to the same shape (e.g., two empty folders)._
- `Inclusion` — _returns a record of artifacts; no set/membership semantics._
- `Roundtrip` — _pipeline-orchestration only; SPEC.md and sidecar are downstream artifacts, not encoded inputs._
- `Exception Raising` — _parser failures inside the per-folder pipeline are surfaced through \`catchDirectiveErrors\` to \`MissingStubError\` at the \`validateFolder\` boundary, not at \`generateFolder\` — the generate path treats them as defects._

### [`validateFolder`](./orchestrate.ts#L493)

```ts
export const validateFolder = (
  args: ValidateFolderArgs,
): Effect.Effect<string | null, ValidateGapError> => /* ... */
```

**Assumes:**
- "the underlying generate-tier pipeline is deterministic at the same tree SHA" — _drift cross-checks rely on byte-equality between on-disk and regenerated artifacts._

**Guarantees:**
- "first failing check short-circuits and emits exactly one of the four gap-class errors; success returns the folder string" — _the cli's catchTags routing acts on the tag; batched failures would obscure routing._

**Residual contract:** "in \`--implemented\` mode, a Vitest execution sidecar must already exist on disk for the folder; absence is reported as MissingImplError" — _implementation-tier gate; planned-mode doesn't read execution sidecars at all._

**Skipped property types:**
- `Roundtrip` — _validate is a gate, not a transform; no encode/decode pair._
- `Partial Roundtrip` — _no normalize-then-recover semantics; validate either succeeds or fails on a tagged error._
- `Commutative Paths` — _single entry point; no equivalent API path for the same gate decision._
- `Constant Bounds Checking` — _returns a folder string (success) or a tagged error; no numeric/length bound._
- `Constant Non-Equality` — _different folders can pass the gate identically (same folder string return); no anti-collision invariant._

## Children

- [`checks.ts`](./checks.ts) — Validate's gap-class cross-checks. Co-locates the four tagged errors (MissingSpecPropertyError, MissingStubError, MissingImplError, NoFoldersResolvedError) with the check effects that emit them and the diagnostic-builder helpers that shape their bodies.  Extracted from \`validate.ts\` to keep the orchestration file under the strict max-lines cap; the public surface still routes through \`validate.ts\` (this module is internal to the commands layer).
- [`exports.ts`](./exports.ts) — Walks a TypeScript source file via ts-morph and returns the list of exported declaration names plus their source lines. Used by \`generate.ts\` to build the SPEC.md \`## Public surface\` rows and match per-export \`@spec\*\` directives to their declarations.  \`collectExports\` accepts sibling source files + tsconfig \`paths\` via \`CollectExportsOptions\` so it can follow barrel re-exports across files and aliases. The caller (commands/validate-pipeline.ts's \`loadProjectContext\`) supplies that input.
- [`folders.ts`](./folders.ts) — Pure helper for the \`## Children\` section of an emitted SPEC.md. Merges immediate SPEC'd subfolders with the folder's sources and tests into a flat, alphabetically-sorted entry list. Consumed by \`analysis/pipeline.ts\`'s \`inspectFolder\` and \`analysis/orchestrate.ts\`'s \`buildAnalysis\`; not re-exported via the analysis barrel since \`FolderAnalysis.children\` is the public-facing data shape.
- [`index.ts`](./index.ts) — Barrel for the \`analysis/\` layer. Exposes two high-level per-folder operations — \`generateFolder\` and \`validateFolder\` — plus the \`collectFolderInputs\` enumeration helper commands use to loop over discovered folders. Pipeline primitives (\`buildSpecMeta\`, \`regenerateMarkdown\`, \`regenerateSidecar\`, individual gap-checks, directive parsers, etc.) stay internal to this folder; commands at \`commands/{generate,validate}.ts\` compose only the two high-level functions, not the underlying machinery.  \`diagnosticLines\` and \`unresolvedFolderError\` are exposed because the cli renders gap-class errors itself (string formatting + the no-folders-resolved guard for \`--folder X\` typos).  \`buildKnownExports\` is the project-level setup the generate command computes once before looping over folders; calling it inside \`generateFolder\` would re-scan every project source on every folder.
- [`orchestrate.ts`](./orchestrate.ts) — Per-folder pipeline orchestration. \`generateFolder\` and \`validateFolder\` are the public entry points that compose the parsers, pipeline helpers, and gap-class checks under one call. Commands at \`commands/{generate,validate}.ts\` consume these two functions plus folder discovery from \`project/\`; the pipeline primitives (\`buildSpecMeta\`, \`regenerateMarkdown\`, \`checkDrift\`, etc.) stay internal to this folder.  \`generateFolder\`: walks one folder's source + test + immediate subfolder index.ts; parses directives; builds the \`FolderAnalysis\`; emits the markdown + sidecar JSON. Returns the artifacts; callers own the on-disk write step (so \`--dry-run\` works at the cli boundary).  \`validateFolder\`: walks the same pipeline, then diffs the regenerated markdown + sidecar against the on-disk artifacts, enforces coverage thresholds, and runs the per-test directive cross-checks. Returns the folder string on success; fails with a \`ValidateGapError\` whose tag the cli maps to a POSIX exit code.
- [`pipeline.ts`](./pipeline.ts) — Shared analysis pipeline for \`validate\`. Walks the same inputs as \`generate\` (sources, tests, index barrel) and returns the \`FolderAnalysis\` that the markdown emitter consumes plus the per-test issues list (\`ItSpecIssue\[\]\`) that \`validate.ts\` maps to its gap-class exit codes.
- [`properties.ts`](./properties.ts) — Walks \`\*.spec.test.ts\` source via ts-morph and extracts each \`itSpec.todo\` / \`itSpec.prop\` call site plus the four Amendment-6 directives (\`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`) that should immediately precede it.  Per-test directives bind to the JSDoc block IMMEDIATELY preceding the call (via ts-morph's \`Statement.getJsDocs()\` on the call's enclosing statement); the previous "closest earlier" search across the whole file silently inherited directives from unrelated blocks.  Returns rows for downstream emit + an \`issues\` list. Issues are surfaced to \`validate\` as MissingStub / MissingSpecProperty / MissingImpl gap errors with stable exit codes.
- [`__tests__/checks.spec.test.ts`](./__tests__/checks.spec.test.ts) — Branch coverage for the gap-class check functions in \`analysis/checks.ts\`. Each itSpec.prop targets one untested branch so the per-folder \`branchCoverageFromSpecTests\` gate stops loud- failing on the analysis layer's failure paths.
- [`__tests__/orchestrate.spec.test.ts`](./__tests__/orchestrate.spec.test.ts) — Property tests for the \`analysis/\` public surface — \`generateFolder\`, \`validateFolder\`, \`buildKnownExports\`, \`diagnosticLines\`, and the two \`GenerateFolder\*\` tagged errors. The orchestrate functions' end-to-end behavior is exercised by \`commands/\_\_tests\_\_/validate.spec.test.ts\` (self-host); this file covers the shape contracts at the analysis layer without re-walking the whole project tree.
- [`__tests__/properties-edge-cases.spec.test.ts`](./__tests__/properties-edge-cases.spec.test.ts) — Edge-case branch coverage for \`analysis/properties.ts\` — ts-morph node shapes the happy-path tests in properties.spec.test.ts don't reach (non-itSpec call expressions, non-literal opts, non-array opts.exports, property-access exports, concise arrow bodies, non-fn body args).
- [`__tests__/properties.spec.test.ts`](./__tests__/properties.spec.test.ts) — Branch coverage for \`analysis/properties.ts\` — the \`extractProperties\` ts-morph walk that turns spec.test.ts source into \`PropertyRow\[\]\` and the \`ItSpecIssue\[\]\` validate routes to gap-class errors. Each property targets one untested branch (missing directive, JSDoc↔runtime mismatch on property/type/ exports, empty-body detection, declaredExports membership).
- [`__tests__/sweep.spec.test.ts`](./__tests__/sweep.spec.test.ts) — Coverage-sweep tests for \`analysis/\`. Adds the remaining property-type rows beyond \`orchestrate.spec.test.ts\` so each export crosses the gate threshold.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `catch-directive-errors-overflow-maps-to-missing-stub` | `Exception Raising` | `catchDirectiveErrors` | \`catchDirectiveErrors\` maps \`JsDocDirectiveOverflowError\` to \`MissingStubError\` | implemented |
| `catch-directive-errors-parse-maps-to-missing-stub` | `Exception Raising` | `catchDirectiveErrors` | \`catchDirectiveErrors\` maps \`JsDocDirectiveParseError\` to \`MissingStubError\` | implemented |
| `catch-directive-errors-unknown-maps-to-missing-stub` | `Exception Raising` | `catchDirectiveErrors` | \`catchDirectiveErrors\` maps \`JsDocUnknownDirectiveError\` to \`MissingStubError\` | implemented |
| `catch-directive-errors-passes-success-through` | `Roundtrip` | `catchDirectiveErrors` | \`catchDirectiveErrors\` is identity on the success channel | implemented |
| `check-drift-missing-file-fails-with-missing-spec-property` | `Exception Raising` | `checkDrift` | a missing SPEC.md on disk fails with \`MissingSpecPropertyError\` | implemented |
| `check-drift-matching-content-succeeds` | `Constant Equality` | `checkDrift` | on-disk bytes equal to regenerated bytes (modulo SHA line) succeeds | implemented |
| `check-sidecar-drift-missing-file-fails` | `Exception Raising` | `checkSidecarDrift` | a missing sidecar JSON on disk fails with \`MissingSpecPropertyError\` | implemented |
| `check-thresholds-zero-thresholds-pass` | `Constant Equality` | `checkThresholds` | threshold=0 across the board never trips; the function returns success | implemented |
| `check-thresholds-typecoverage-shortfall-fails` | `Exception Raising` | `checkThresholds` | a \`typeCoverage\` observed below threshold fails with \`MissingImplError\` | implemented |
| `check-impl-bodies-stubbed-fails` | `Exception Raising` | `checkImplBodies` | an analysis with a stubbed property row fails with \`MissingImplError\` | implemented |
| `check-impl-bodies-no-stub-succeeds` | `Constant Equality` | `checkImplBodies` | an analysis with only implemented rows passes | implemented |
| `check-execution-sidecar-vacuous-when-no-impl-properties` | `Constant Equality` | `checkExecutionSidecarPresent` | a folder whose properties are all stubs passes vacuously even with no sidecar | implemented |
| `check-execution-sidecar-missing-fails` | `Exception Raising` | `checkExecutionSidecarPresent` | a folder with implemented properties but no sidecar on disk fails with \`MissingImplError\` | implemented |
| `check-execution-sidecar-stale-propertyids-fails` | `Exception Raising` | `checkExecutionSidecarPresent` | a sidecar covering a different property set fails with \`MissingImplError\` | implemented |
| `check-execution-sidecar-stale-hash-fails` | `Exception Raising` | `checkExecutionSidecarPresent` | matching propertyIds but mismatching \`testTreeHash\` fails with \`MissingImplError\` | implemented |
| `check-execution-sidecar-matching-succeeds` | `Constant Equality` | `checkExecutionSidecarPresent` | matching propertyIds + matching \`testTreeHash\` succeeds | implemented |
| `fail-on-issues-planned-mode-ignores-empty-body` | `Constant Equality` | `failOnIssues` | in \`--planned\` mode \`empty-body\` issues are filtered out (only \`--implemented\` enforces non-empty bodies) | implemented |
| `fail-on-issues-missing-directive-maps-to-missing-stub` | `Exception Raising` | `failOnIssues` | a \`missing-directive\` issue maps to \`MissingStubError\` | implemented |
| `fail-on-issues-directive-mismatch-maps-to-missing-spec-property` | `Exception Raising` | `failOnIssues` | a \`directive-mismatch\` issue maps to \`MissingSpecPropertyError\` | implemented |
| `fail-on-issues-implemented-mode-flags-empty-body` | `Exception Raising` | `failOnIssues` | in \`--implemented\` mode an \`empty-body\` issue maps to \`MissingImplError\` | implemented |
| `diagnostic-lines-includes-tag-and-location` | `Inclusion` | `diagnosticLines` | the rendered diagnostic begins with \`\[Tag\]\` and includes the location, cause, fix, and docs link | implemented |
| `check-drift-bytes-match-after-sha-strip-succeeds` | `Roundtrip` | `checkDrift` | a SPEC.md whose bytes equal the regenerated bytes (with the \`generatedAtSha:\` line normalized away) succeeds — the SHA line is volatile and excluded from the byte-equality check | implemented |
| `check-sidecar-drift-bytes-match-succeeds` | `Roundtrip` | `checkSidecarDrift` | a sidecar JSON whose bytes equal the regenerated bytes (with sha fields normalized) succeeds | implemented |
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
| `validate-folder-can-fail-on-gap-class-errors` | `Exception Raising` | `validateFolder` | \`validateFolder\` has a typed \`ValidateGapError\` error channel — the four documented gap-class tagged errors (MissingSpecPropertyError, MissingStubError, MissingImplError, FolderNotFoundError) | implemented |
| `extract-skips-non-itspec-calls` | `Constant Equality` | `extractProperties` | non-itSpec call expressions (console.log, IIFEs, other library calls) are silently skipped — they yield no rows and no issues | implemented |
| `extract-non-literal-id-is-mismatch` | `Exception Raising` | `extractProperties` | a non-string-literal id (e.g. variable reference) produces a directive-mismatch issue because the validate cross-check cannot read it | implemented |
| `extract-absent-opts-type-is-mismatch` | `Exception Raising` | `extractProperties` | an itSpec call whose opts object omits \`type:\` produces a directive-mismatch — the JSDoc \`@spec.type\` cannot ship as truth without runtime corroboration | implemented |
| `extract-non-object-opts-yields-mismatch` | `Exception Raising` | `extractProperties` | an itSpec call where the second argument is not an object literal (string, array, etc.) is treated as opts-absent and produces a directive-mismatch | implemented |
| `extract-non-array-exports-yields-mismatch` | `Exception Raising` | `extractProperties` | opts.exports that is not an array literal (string, object) is treated as empty and produces a directive-mismatch | implemented |
| `extract-property-access-export-accepted` | `Inclusion` | `extractProperties` | a property-access expression in opts.exports (e.g. \`m.foo\`) is collected by name (\`foo\`) — the same as a bare identifier | implemented |
| `extract-concise-arrow-undefined-body-flagged` | `Exception Raising` | `extractProperties` | itSpec.prop with \`() =&gt; undefined\` body counts as an empty-body issue | implemented |
| `extract-non-function-body-not-flagged` | `Constant Equality` | `extractProperties` | itSpec.prop where the body arg is not a function expression (string literal, etc.) does NOT count as empty-body — only function-typed bodies are inspected for emptiness | implemented |
| `extract-concise-true-body-not-flagged` | `Constant Equality` | `extractProperties` | itSpec.prop with \`() =&gt; true\` concise body does NOT count as empty-body — the body has a meaningful expression | implemented |
| `extract-happy-path-produces-row` | `Roundtrip` | `extractProperties` | a fully-formed itSpec.prop with matching JSDoc directives produces a PropertyRow and no issues | implemented |
| `extract-stub-row-is-stubbed` | `Constant Equality` | `extractProperties` | an itSpec.todo call produces a row with \`stubbed: true\` | implemented |
| `extract-missing-directive-issue` | `Exception Raising` | `extractProperties` | an itSpec call without JSDoc directives raises a missing-directive issue | implemented |
| `extract-id-mismatch-flagged` | `Exception Raising` | `extractProperties` | a JSDoc id ≠ runtime id produces a directive-mismatch issue | implemented |
| `extract-type-mismatch-flagged` | `Exception Raising` | `extractProperties` | a JSDoc \`@spec.type\` ≠ runtime opts.type produces a directive-mismatch issue | implemented |
| `extract-non-literal-type-flagged` | `Exception Raising` | `extractProperties` | a non-literal opts.type (variable, expression) produces a directive-mismatch — the validate cross-check requires a string literal | implemented |
| `extract-empty-runtime-exports-flagged` | `Exception Raising` | `extractProperties` | opts.exports = \[\] (empty array) produces a directive-mismatch — masks missing metadata | implemented |
| `extract-unknown-export-flagged` | `Exception Raising` | `extractProperties` | opts.exports references a symbol not in declaredExports → directive-mismatch | implemented |
| `extract-empty-body-flagged` | `Exception Raising` | `extractProperties` | itSpec.prop with \`() =&gt; {}\` body produces an empty-body issue | implemented |
| `extract-effect-die-body-flagged` | `Exception Raising` | `extractProperties` | itSpec.prop with \`() =&gt; Effect.die(...)\` body counts as empty (stub-tier body) | implemented |
| `extract-empty-declared-exports-skips-membership-check` | `Constant Equality` | `extractProperties` | with empty declaredExports the symbol-membership check is skipped (back-compat for callers that haven't computed the set) | implemented |
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
