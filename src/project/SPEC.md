---
folder: src/project
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
  typeCoverage: 0.02222222222222222
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

Barrel for the `project/` layer. Re-exports `ProjectContext` and the loaders the analysis layer and commands depend on. Each file in this folder owns one slice of project setup (context, config, version, folders); this barrel is the single entry point downstream consumers import.

## Public surface

### [`SPEC_FORMAT_VERSION`](./version.ts#L16)

```ts
export const SPEC_FORMAT_VERSION = "0.1.0" as const;
```

**Guarantees:**
- "value is a stable string literal across all calls within one process" — _declared \`as const\` in source; re-evaluation cannot drift._

**Residual contract:** "callers must treat as opaque; cross-version comparisons go through the safer-spec-migrate skill" — _comparison logic is migrate's responsibility; the skill walks SPEC.md + sidecar artifacts during format-version transitions._

### [`SourceFile`](./context.ts#L30)

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

### [`ProjectContext`](./context.ts#L40)

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
  // Raw `safer-spec.config.json` contents (defaults + per-folder overrides).
  // Resolve per-folder thresholds via `resolveThresholdsFor(ctx.config, folder)`.
  readonly config: Config;
}
```

### [`discoverFolders`](./folders.ts#L59)

```ts
export const discoverFolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<ReadonlyArray<string>, never> => /* ... */
```

**Guarantees:**
- "returns every directory under \`root\` containing an \`index.ts\` barrel; insertion order is root-first depth-first" — _contract; both \`generate\` and \`validate\` iterate this list when no \`--folder\` is given. Walking from \`.\` finds barrels under any top-level layout (\`src/\`, \`packages/&lt;name&gt;/\`, app workspaces)._

**Residual contract:** "dot-prefixed directories, \`\_\_tests\_\_\`, \`node\_modules\`, \`dist\`, \`build\`, \`coverage\`, and \`.safer-spec\` are skipped; symlinks are not followed" — _avoid vendored dependencies, build output, and sidecar dirs._

### [`normalizeFolder`](./context.ts#L64)

```ts
export const normalizeFolder = (folder: string): string => { /* ... */ }
```

Normalize the user-supplied `--folder` value into a path the codemod
stores as artifact identity (frontmatter `folder:`, sidecar slug,
drift-check key). Absolute inputs are rewritten to cwd-relative so they
match the repo-relative paths `loadProjectContext` registers; `./` and
trailing separators are stripped so authoring conveniences don't
manifest as false drift.

### [`discoverImmediateSubfolders`](./folders.ts#L75)

```ts
export const discoverImmediateSubfolders = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  folder: string,
): Effect.Effect<ReadonlyArray<string>, never> => /* ... */
```

**Guarantees:**
- "returns immediate child directories of \`folder\` that contain an \`index.ts\` barrel; not recursive" — _parent SPEC.md's \`## Children\` section lists immediate nested SPEC'd domains; deeper nesting belongs to each subfolder's own SPEC._

### [`resolveThresholdsFor`](./config.ts#L80)

```ts
export const resolveThresholdsFor = (
  config: Config,
  folder: string,
): Thresholds => { /* ... */ }
```

**Guarantees:**
- "returns a Thresholds value with each metric resolved in three-layer priority: folder override &gt; defaultThresholds &gt; 0" — _validate's gate reads this per-folder; the layered fallback lets projects raise a baseline + tighten specific folders without restating the baseline everywhere._

**Residual contract:** "folder match is exact-string against the normalized folder path; glob patterns are NOT supported in this slice" — _scope limit; glob lookup is a future enhancement that needs a defined longest-match resolution rule._

### [`buildChildren`](./folders.ts#L112)

```ts
export const buildChildren = (
  args: BuildChildrenArgs,
): ReadonlyArray<{ display: string; link: string; purpose: string | null }> => { /* ... */ }
```

**Guarantees:**
- "result emits in three concatenated groups: immediate SPEC'd subfolders (alphabetic), source files (alphabetic), then test files (alphabetic)" — _implementation surface (subfolders + sources) leads \`## Children\`; tests are secondary documentation grouped at the end so the section reads as primary-then-secondary._

**Residual contract:** "files are displayed by their path relative to the folder; subfolders are displayed with a trailing slash" — _visual cue for readers; subfolder links target \`&lt;sub&gt;/SPEC.md\`, file links target \`./&lt;rel&gt;\`._

### [`loadProjectContext`](./context.ts#L272)

```ts
export const loadProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
): Effect.Effect<ProjectContext, ProjectContextError | ConfigError> => /* ... */
```

**Guarantees:**
- "loads project-wide context (every non-test \`.ts\` under \`root\`, tsconfig \`paths\`, git HEAD SHA, \`safer-spec.config.json\`); collectExports consumes sources+paths so barrel re-exports resolve" — _ts-morph cannot follow \`export ... from\` without target files registered; validate's threshold gate reads the loaded config._

**Residual contract:** "missing tsconfig.json yields empty \`paths\`; missing \`.git/HEAD\` yields \`generatedAtSha = 'uncommitted'\`; missing safer-spec.config.json yields permissive all-zero thresholds" — _projects without aliases, git history, or per-folder gate configuration still load with no false failures._

### [`loadValidateProjectContext`](./context.ts#L292)

```ts
export const loadValidateProjectContext = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
): Effect.Effect<ProjectContext, ProjectContextError | ConfigError> => /* ... */
```

## Children

- [`config.ts`](./config.ts) — \`safer-spec.config.json\` schema + loader + per-folder threshold resolver. Two-layer fallback for each of the three coverage metrics: \`folderOverrides\[folder\]\` &gt; \`defaultThresholds\` &gt; 0. Extracted from \`project-context.ts\` to keep that file under its line cap; the loader is consumed by \`loadProjectContext\` so every command sees the same parsed config.  Tagged error \`ConfigError\` is co-located here. Schema rejects unknown keys at both the root level and the per-thresholds object level — a misspelled \`typecoverage\` (lowercase) would otherwise silently disable the intended gate.
- [`context.ts`](./context.ts) — Project-wide loader for the codemod. Walks the project tree for every non-test \`.ts\` source, reads the tsconfig \`paths\` map, the git HEAD SHA, and the optional \`safer-spec.config.json\` (via \`commands/config.ts\`). \`collectExports\` consumes the sources + paths so barrel re-exports across files and aliases resolve; emit needs the SHA for SpecFrontmatter and SpecArtifact metadata; validate's threshold gate reads \`config\` per-folder via \`resolveThresholdsFor\` (also from \`commands/config.ts\`).  Tagged error \`ProjectContextError\` is co-located here; \`ConfigError\` lives in \`commands/config.ts\` with the schema it guards.
- [`folders.ts`](./folders.ts) — Folder-discovery helpers used by \`generate\` and \`validate\`: recursive walk for the no-\`--folder\` mode (\`discoverFolders\`), immediate-children walk for the parent SPEC.md's \`## Children\` section (\`discoverImmediateSubfolders\`), and the \`buildChildren\` helper that composes the merged file + subfolder list emit consumes. Extracted from \`validate-pipeline.ts\` so each file fits the strict max-lines cap.
- [`index.ts`](./index.ts) — Barrel for the \`project/\` layer. Re-exports \`ProjectContext\` and the loaders the analysis layer and commands depend on. Each file in this folder owns one slice of project setup (context, config, version, folders); this barrel is the single entry point downstream consumers import.
- [`version.ts`](./version.ts) — Format version constant for SPEC.md frontmatter and the \`.safer-spec/&lt;folder&gt;.json\` sidecar JSON. Co-located with the commands because \`generate.ts\` stamps it onto every emitted SPEC.md. CHANGELOG signposts bumps before they ship; the \`safer-spec-migrate\` skill walks committed artifacts across the bump.
- [`__tests__/config.spec.test.ts`](./__tests__/config.spec.test.ts) — Property tests for \`resolveThresholdsFor\` — the per-folder threshold resolver \`buildSpecMeta\` calls. Three layers of fallback: folder override &gt; default thresholds &gt; 0. Tests assert each layer wins independently and that missing fields cascade correctly.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `resolve-config-empty-yields-zero-thresholds` | `Constant Equality` | `resolveThresholdsFor` | an empty Config (no defaultThresholds, no folderOverrides) resolves every metric to 0 for every folder name | implemented |
| `resolve-config-default-applies-to-all-folders` | `Constant Equality` | `resolveThresholdsFor` | with \`defaultThresholds\` set and no folder overrides, every folder resolves to those exact values (each metric independently) | implemented |
| `resolve-config-folder-override-trumps-default` | `Constant Equality` | `resolveThresholdsFor` | a folder-specific override beats the default for the same metric while leaving unspecified metrics to inherit from the default layer | implemented |
| `resolve-config-rejects-unknown-threshold-keys` | `Exception Raising` | `resolveThresholdsFor` | a misspelled threshold key (e.g. \`typecoverage\` lowercase) in either \`defaultThresholds\` or a \`folderOverrides\` value MUST cause \`safer-spec.config.json\` decoding to fail with a ConfigError — silently stripping unknown keys would disable the intended gate | implemented |
