---
folder: src/project
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

Barrel for the `project/` layer. Exposes the fully-resolved `ProjectContext` snapshot (with precomputed folder list, per-folder subfolder map, and threshold resolver), the one loader that builds it, the stable format version, and the three tagged errors the cli routes. Folder-discovery primitives, the threshold resolver, and the path normalizer are implementation details behind `ProjectContext` methods.

## Public surface

### [`SPEC_FORMAT_VERSION`](./version.ts#L26)

```ts
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
```

**Guarantees:**
- "value is a stable string literal across all calls within one process" — _declared \`as const\` in source; re-evaluation cannot drift._

**Residual contract:** "callers must treat as opaque; cross-version comparisons go through the safer-spec-migrate skill" — _comparison logic is migrate's responsibility; the skill walks SPEC.md + sidecar artifacts during format-version transitions._

**Skipped property types:**
- `Roundtrip` — _a string constant; no encode/decode pair._
- `Partial Roundtrip` — _a string constant; no normalize-then-recover relation._
- `Commutative Paths` — _a constant; no alternative path to derive it._
- `Constant Non-Equality` — _a single string value; no distinct-output invariant applies._
- `Exception Raising` — _a constant; cannot fail._

### [`ConfigError`](./config.ts#L32)

```ts
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly path: string;
  readonly cause: string;
}> { /* ... */ }
```

**Skipped property types:**
- `Partial Roundtrip` — _tagged error class; no normalize-then-recover relation._
- `Commutative Paths` — _single constructor._
- `Constant Equality` — _instances carry per-failure path + cause; equality is per-instance._
- `Constant Bounds Checking` — _cause strings are not length-bounded._
- `Constant Non-Equality` — _distinct config failures can produce identical cause strings._
- `Inclusion` — _not a collection._

### [`SourceFile`](./context.ts#L38)

```ts
export interface SourceFile {
  readonly path: string;
  readonly source: string;
}
```

In-memory source file shape — `{path, source}` pairs the ts-morph
project registers so cross-file `export ... from` resolves. Produced
by `loadProjectContext` and consumed by `analysis/exports.ts`'s
`collectExports`.

### [`ProjectContextError`](./context.ts#L57)

```ts
export class ProjectContextError extends Data.TaggedError("ProjectContextError")<{
  readonly path: string;
  readonly cause: string;
}> { /* ... */ }
```

**Skipped property types:**
- `Partial Roundtrip` — _tagged error class; no normalize-then-recover relation._
- `Commutative Paths` — _single constructor._
- `Constant Equality` — _instances carry per-failure path + cause; equality is per-instance._
- `Constant Bounds Checking` — _cause strings are not length-bounded._
- `Constant Non-Equality` — _distinct context-load failures can produce identical cause strings._
- `Inclusion` — _not a collection._

### [`Thresholds`](./config.ts#L65)

```ts
export interface Thresholds {
  readonly typeCoverage: number;
  readonly preconditionPassRate: number;
  readonly branchCoverageFromSpecTests: number;
}
```

### [`FolderNotFoundError`](./context.ts#L76)

```ts
export class FolderNotFoundError extends Data.TaggedError("FolderNotFoundError")<{
  readonly requested: string;
}> { /* ... */ }
```

**Skipped property types:**
- `Partial Roundtrip` — _tagged error class; no normalize-then-recover relation._
- `Commutative Paths` — _single constructor._
- `Constant Equality` — _instances carry the user's per-call requested folder string; equality is per-instance._
- `Constant Bounds Checking` — _requested folder string is user-controlled and length-unbounded._
- `Constant Non-Equality` — _distinct mistyped folders can collapse to the same requested string._
- `Inclusion` — _not a collection._

### [`ProjectContext`](./context.ts#L80)

```ts
export interface ProjectContext {
  readonly sources: ReadonlyArray<SourceFile>;
  readonly paths: Readonly<Record<string, ReadonlyArray<string>>>;

  /**
   * tsconfig.compilerOptions.baseUrl (the root `paths` resolve relative to).
   * Defaults to "." when tsconfig omits it; TypeScript requires baseUrl when
   * paths is set, and "." matches both common practice and ts-morph behavior.
   */
  readonly baseUrl: string;
  readonly generatedAtSha: string;

  /** Every folder under the project root with an `index.ts` barrel, root-first depth-first. */
  readonly folders: ReadonlyArray<string>;

  /** Immediate SPEC'd subfolders of the given folder (folders directly inside `folder` that have their own `index.ts`). */
  readonly subfoldersOf: (folder: string) => ReadonlyArray<string>;

  /** Resolve the per-folder coverage thresholds (folder override > defaultThresholds > 0). */
  readonly thresholdsFor: (folder: string) => Thresholds;

  /**
   * Map a user-supplied `--folder X` to a canonical folder string,
   * failing with `FolderNotFoundError` when `X` doesn't match any
   * discovered folder.
   */
  readonly resolveFolder: (input: string) => Effect.Effect<string, FolderNotFoundError>;
}
```

### [`loadProjectContext`](./context.ts#L353)

```ts
export const loadProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string = ".",
): Effect.Effect<ProjectContext, ProjectContextError | ConfigError> => /* ... */
```

**Guarantees:**
- "loads project-wide context (every non-test \`.ts\` under \`root\`, tsconfig \`paths\`, git HEAD SHA, \`safer-spec.config.json\`); the returned ProjectContext precomputes folder discovery and per-folder thresholds so downstream layers READ from the snapshot instead of re-walking the project tree per folder" — _ts-morph cannot follow \`export ... from\` without target files registered; precomputing folder structure removes O(N²) re-discovery in the per-folder loops._

**Residual contract:** "missing tsconfig.json yields empty \`paths\`; missing \`.git/HEAD\` yields \`generatedAtSha = 'uncommitted'\`; missing safer-spec.config.json yields permissive all-zero thresholds; root defaults to the cwd-relative \\".\\"" — _projects without aliases, git history, or per-folder gate configuration still load with no false failures._

**Skipped property types:**
- `Partial Roundtrip` — _loader-only; no \`serializeProjectContext\` companion._
- `Commutative Paths` — _single entry point; no equivalent API path yields the same context._

## Children

- [`config.ts`](./config.ts) — \`safer-spec.config.json\` schema + loader + per-folder threshold resolver. Two-layer fallback for each of the three coverage metrics: \`folderOverrides\[folder\]\` &gt; \`defaultThresholds\` &gt; 0. Extracted from \`project-context.ts\` to keep that file under its line cap; the loader is consumed by \`loadProjectContext\` so every command sees the same parsed config.  Tagged error \`ConfigError\` is co-located here. Schema rejects unknown keys at both the root level and the per-thresholds object level — a misspelled \`typecoverage\` (lowercase) would otherwise silently disable the intended gate.
- [`context.ts`](./context.ts) — Project-wide loader for the codemod. Walks the project tree once at startup and produces a \`ProjectContext\` snapshot that downstream layers (analysis, commands) READ from instead of calling pure helpers per folder. The snapshot carries the sources ts-morph needs, the tsconfig \`paths\` map, the git HEAD SHA, the parsed config, plus precomputed:  - \`folders\`: every directory under root that has an \`index.ts\` barrel - \`subfoldersOf(folder)\`: immediate SPEC'd subfolders of \`folder\` - \`thresholdsFor(folder)\`: resolved coverage thresholds for \`folder\` - \`resolveFolder(input)\`: maps a user-supplied \`--folder X\` to a known canonical folder, failing with \`FolderNotFoundError\` if \`X\` doesn't match anything discovered  Tagged errors \`ProjectContextError\`, \`ConfigError\`, and \`FolderNotFoundError\` live here and at \`config.ts\`; the cli at \`commands/index.ts\` catches each by tag.
- [`index.ts`](./index.ts) — Barrel for the \`project/\` layer. Exposes the fully-resolved \`ProjectContext\` snapshot (with precomputed folder list, per-folder subfolder map, and threshold resolver), the one loader that builds it, the stable format version, and the three tagged errors the cli routes. Folder-discovery primitives, the threshold resolver, and the path normalizer are implementation details behind \`ProjectContext\` methods.
- [`version.ts`](./version.ts) — Format version constant for SPEC.md frontmatter and the \`.safer-spec/&lt;folder&gt;.json\` sidecar JSON. Co-located with the commands because \`generate.ts\` stamps it onto every emitted SPEC.md. CHANGELOG signposts bumps before they ship; the \`safer-spec-migrate\` skill walks committed artifacts across the bump.
- [`__tests__/config.spec.test.ts`](./__tests__/config.spec.test.ts) — Branch coverage for the \`safer-spec.config.json\` loader and per-folder threshold resolver in \`project/config.ts\`. The resolver tests exercise the three-layer fallback (override &gt; defaultThresholds &gt; 0); the loader tests exercise the four real-world outcomes a project boot hits (missing file, malformed JSON, unknown key at root, unknown threshold key, valid).
- [`__tests__/context.spec.test.ts`](./__tests__/context.spec.test.ts) — Property tests for \`loadProjectContext\` and the \`ProjectContext\` snapshot it produces (\`folders\`, \`subfoldersOf\`, \`thresholdsFor\`, \`resolveFolder\`). The fixture is the codemod's own source tree — module-load runs the heavy ts-morph + FS work once, then fc-property bodies assert on the cached snapshot.
- [`__tests__/errors.spec.test.ts`](./__tests__/errors.spec.test.ts) — Property tests for \`project/\`'s three tagged error classes — \`ProjectContextError\` (tsconfig/git/source-walk failures), \`ConfigError\` (\`safer-spec.config.json\` decode failures), and \`FolderNotFoundError\` (\`--folder X\` doesn't match a discovered folder). Plus \`SPEC\_FORMAT\_VERSION\` property types.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `resolve-thresholds-falls-back-to-zero-when-no-config` | `Constant Equality` | `resolveThresholdsFor` | with empty config, every metric resolves to 0 — the bottom of the three-layer fallback | implemented |
| `resolve-thresholds-baseline-applies-when-no-override` | `Constant Equality` | `resolveThresholdsFor` | defaultThresholds applies for any folder lacking a folderOverrides entry | implemented |
| `resolve-thresholds-folder-override-wins` | `Constant Equality` | `resolveThresholdsFor` | folderOverrides\[folder\] beats defaultThresholds for the matching folder | implemented |
| `resolve-thresholds-non-matching-folder-uses-baseline` | `Constant Equality` | `resolveThresholdsFor` | folderOverrides only apply on exact-string match; non-matching folder falls back to defaultThresholds | implemented |
| `load-config-missing-file-yields-empty-config` | `Constant Equality` | `loadConfig` | a missing \`safer-spec.config.json\` resolves to an empty Config (permissive defaults), not an error | implemented |
| `load-config-valid-file-decodes` | `Roundtrip` | `loadConfig` | a valid \`safer-spec.config.json\` round-trips through the loader with thresholds and folderOverrides intact | implemented |
| `load-config-invalid-json-fails-with-config-error` | `Exception Raising` | `loadConfig` | a malformed JSON file fails with \`ConfigError\` whose cause names "invalid JSON" | implemented |
| `load-config-unknown-root-key-fails` | `Exception Raising` | `loadConfig` | an unknown top-level key fails with \`ConfigError\` — Schema.Struct would silently strip it | implemented |
| `load-config-unknown-threshold-key-fails` | `Exception Raising` | `loadConfig` | a misspelled threshold key (e.g. \`typecoverage\` lowercase) fails with \`ConfigError\` | implemented |
| `load-config-unknown-folder-override-key-fails` | `Exception Raising` | `loadConfig` | an unknown key inside a \`folderOverrides\["src/x"\]\` block fails with \`ConfigError\` | implemented |
| `load-config-out-of-range-ratio-fails` | `Exception Raising` | `loadConfig` | a ratio outside \[0, 1\] fails through the schema decode → ConfigError | implemented |
| `load-project-context-typecheck` | `Typechecking` | `loadProjectContext` | \`loadProjectContext\` returns a \`ProjectContext\` whose precomputed fields are populated — sources array, paths record, baseUrl string, generatedAtSha string, folders array, subfoldersOf/thresholdsFor/resolveFolder functions | implemented |
| `load-project-context-arity` | `Constant Equality` | `loadProjectContext` | \`loadProjectContext\` accepts 2-3 positional args (fs, path, root=".")\` — fs and path are required, root defaults | implemented |
| `project-context-folders-non-empty-for-self-host` | `Inclusion` | `loadProjectContext` | the codemod's own project tree resolves to a non-empty \`folders\` list and includes the codemod's well-known folders (\`src/spec/grammar\`, \`src/analysis\`) — the precomputed list both commands consume | implemented |
| `project-context-folders-no-duplicates` | `Constant Non-Equality` | `loadProjectContext` | \`ctx.folders\` contains no duplicate entries — every discovered folder appears exactly once | implemented |
| `resolve-folder-canonicalizes-trailing-slash` | `Inclusion` | `loadProjectContext` | a known folder with a trailing slash resolves to the canonical (slash-stripped) form — authoring conveniences don't manifest as \`FolderNotFoundError\` | implemented |
| `resolve-folder-fails-on-typo` | `Exception Raising` | `loadProjectContext` | a folder that doesn't exist resolves to \`FolderNotFoundError\` carrying the original user input — the cli's exit-1 path | implemented |
| `subfolders-of-spec-includes-grammar-and-artifact` | `Inclusion` | `loadProjectContext` | \`ctx.subfoldersOf("src/spec")\` returns \`\["src/spec/artifact", "src/spec/grammar"\]\` — the precomputed immediate-children map that \`buildChildren\` consumes | implemented |
| `subfolders-of-leaf-folder-empty` | `Constant Equality` | `loadProjectContext` | a leaf folder (no SPEC'd subfolders) yields an empty array — degenerate case stays degenerate | implemented |
| `subfolders-of-unknown-folder-empty` | `Constant Equality` | `loadProjectContext` | \`ctx.subfoldersOf(folder)\` returns an empty array (not undefined/null) for any folder NOT in the discovered list — total function, no exceptions | implemented |
| `thresholds-for-default-folder-non-negative` | `Constant Bounds Checking` | `loadProjectContext` | every metric in \`ctx.thresholdsFor(folder)\` is a non-negative number — the gate semantics requires "below threshold" to be meaningful; negative thresholds would invert the comparison | implemented |
| `thresholds-for-typechecks-as-thresholds` | `Typechecking` | `loadProjectContext` | the output of \`ctx.thresholdsFor(folder)\` exposes two \`number\` fields (\`typeCoverage\`, \`preconditionPassRate\`) — the shape \`checkThresholds\` reads in the validate pipeline | implemented |
| `thresholds-for-deterministic` | `Roundtrip` | `loadProjectContext` | \`ctx.thresholdsFor(folder)\` is deterministic — two calls with the same folder return equal Thresholds (the function is pure on the precomputed config) | implemented |
| `project-context-error-roundtrips-payload` | `Roundtrip` | `ProjectContextError` | a \`ProjectContextError\` exposes the \`{path, cause}\` payload it was constructed with — the surface the runtime exit-formatter reads when tsconfig load fails | implemented |
| `project-context-error-is-throwable` | `Exception Raising` | `ProjectContextError` | \`ProjectContextError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` without payload loss — the surface load-time loaders route their failures through | implemented |
| `project-context-error-typecheck` | `Typechecking` | `ProjectContextError` | instances of \`ProjectContextError\` extend \`Error\` and carry \`\_tag\`, \`path\`, \`cause\` strings — the runtime shape Effect's exit-cause renderer expects | implemented |
| `config-error-roundtrips-payload` | `Roundtrip` | `ConfigError` | a \`ConfigError\` exposes the \`{path, cause}\` payload it was constructed with — the surface load-time decoders raise on malformed config | implemented |
| `config-error-is-throwable` | `Exception Raising` | `ConfigError` | \`ConfigError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` — the surface \`loadConfig\` raises on a malformed \`safer-spec.config.json\` | implemented |
| `config-error-typecheck` | `Typechecking` | `ConfigError` | \`ConfigError\` instances expose \`\_tag\` (string), \`path\` (string), and \`cause\` (string) — the shape consumed by the CLI stderr renderer | implemented |
| `folder-not-found-error-roundtrips-payload` | `Roundtrip` | `FolderNotFoundError` | \`FolderNotFoundError\` exposes the \`{requested}\` payload it was constructed with — the cli's stderr message echoes the user's input back so they can spot typos | implemented |
| `folder-not-found-error-is-throwable` | `Exception Raising` | `FolderNotFoundError` | \`FolderNotFoundError\` round-trips through \`Effect.fail\` / \`Effect.catchTag\` — the cli's exit-1 path for unresolved \`--folder\` arguments | implemented |
| `folder-not-found-error-typecheck` | `Typechecking` | `FolderNotFoundError` | \`FolderNotFoundError\` instances extend \`Error\` and expose \`\_tag === "FolderNotFoundError"\` plus a \`requested\` string | implemented |
| `spec-format-version-non-empty-constant` | `Constant Equality` | `SPEC\_FORMAT\_VERSION` | \`SPEC\_FORMAT\_VERSION === "0.1.0"\` — the literal version stamp every SPEC.md frontmatter and sidecar JSON carries; the migrate skill keys committed artifacts on bumps of this string | implemented |
| `spec-format-version-bounded-length` | `Constant Bounds Checking` | `SPEC\_FORMAT\_VERSION` | \`SPEC\_FORMAT\_VERSION\` length stays under 32 chars — keeps the frontmatter YAML compact and the sidecar JSON readable in narrow editor panes | implemented |
| `spec-format-version-typechecks-as-string` | `Typechecking` | `SPEC\_FORMAT\_VERSION` | \`SPEC\_FORMAT\_VERSION\` is a non-empty string — the stable label every emitted SPEC.md frontmatter and sidecar JSON stamps | implemented |
| `spec-format-version-includes-dot-separator` | `Inclusion` | `SPEC\_FORMAT\_VERSION` | the format version string contains a \`.\` separator — the stable signal \`migrate\` keys off of for parsing the major/minor version | implemented |
