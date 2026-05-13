---
folder: src/commands
format-version: 0.1.0
generatedAtSha: c70ddc3972678a8d5f8f08d83604da0b724782f2
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

CLI binary. Composes the six subcommands (`init`, `generate`, `validate`, `doctor`, `explain`, `migrate`) into the top-level `safer-spec` Command, then translates each tagged failure into `process.exit(N)` at the runtime boundary.

Exit-code mapping at this boundary:
- `MissingSpecPropertyError` → exit 11
- `MissingStubError`         → exit 12
- `MissingImplError`         → exit 13
- `CliUsageError`            → exit 2 (POSIX usage convention)
- any other defect / failure → `NodeRuntime.runMain` default (non-zero)

Tagged errors `CliExitCode` and `CliUsageError` are co-located here.

## Public surface

### [`CliExitCode`](./index.ts#L35)

```ts
export class CliExitCode extends Data.TaggedError("CliExitCode")<{
  readonly code: number;
}> { /* ... */ }
```

### [`CliUsageError`](./index.ts#L39)

```ts
export class CliUsageError extends Data.TaggedError("CliUsageError")<{
  readonly subcommand: string;
  readonly reason: string;
}> { /* ... */ }
```

## Children

- [`doctor.ts`](./doctor.ts) — \`doctor\` command entrypoint. Health check of configs, deps, sidecar dir, format-version compatibility. Surfaces config drift and version skew before the user hits cryptic gate failures.  Tagged error \`DoctorError\` is co-located here.
- [`explain.ts`](./explain.ts) — \`explain\` command entrypoint. Looks up an error code (e.g. \`MISSING\_SPEC\_PROPERTY\`, \`spec-property-type-coverage\`) and returns the corresponding \`docs/errors.md\` entry.  Tagged error \`ExplainError\` is co-located here.
- [`folder-discovery.ts`](./folder-discovery.ts) — Folder-discovery helpers used by \`generate\` and \`validate\`: recursive walk for the no-\`--folder\` mode (\`discoverFolders\`), immediate-children walk for the parent SPEC.md's \`## Children\` section (\`discoverImmediateSubfolders\`), and the \`buildChildren\` helper that composes the merged file + subfolder list emit consumes. Extracted from \`validate-pipeline.ts\` so each file fits the strict max-lines cap.
- [`generate.ts`](./generate.ts) — \`generate\` command entrypoint. Walks one folder under \`--folder X\`, parses \`@spec\*\` JSDoc directives, extracts \`itSpec.\*\` call sites + JSDoc from \`\*.spec.test.ts\`, composes a \`FolderAnalysis\`, and emits one \`SPEC.md\` plus one \`.safer-spec/&lt;slug&gt;.json\` sidecar. Tagged errors \`GenerateError\` and \`GenerateIOError\` are co-located.
- [`index.ts`](./index.ts) — CLI binary. Composes the six subcommands (\`init\`, \`generate\`, \`validate\`, \`doctor\`, \`explain\`, \`migrate\`) into the top-level \`safer-spec\` Command, then translates each tagged failure into \`process.exit(N)\` at the runtime boundary.  Exit-code mapping at this boundary: - \`MissingSpecPropertyError\` → exit 11 - \`MissingStubError\`         → exit 12 - \`MissingImplError\`         → exit 13 - \`CliUsageError\`            → exit 2 (POSIX usage convention) - any other defect / failure → \`NodeRuntime.runMain\` default (non-zero)  Tagged errors \`CliExitCode\` and \`CliUsageError\` are co-located here.
- [`init-export-picker.ts`](./init-export-picker.ts) — "First runtime-named export" resolver for \`commands/init\`. Delegates the in-file scan to \`collectExports\` from \`spec/source-exports\` — the same ts-morph-based resolver \`generate\` and \`validate\` use — so comments, string literals, namespace declarations, generators, \`abstract class\`, \`const enum\`, default re-exports, and aliased re-exports are all handled correctly without bespoke regex.  \`collectExports\` silently drops re-exports whose target file isn't registered as a sibling; init has no project context loaded so the bare star variant (\`export \* from "./x.js"\`) still needs special handling. For those, this module reads the target file, registers it as a sibling, and re-invokes \`collectExports\`. Recursion is bounded by STAR\_MAX\_DEPTH so cyclic chains terminate.  The "first runtime-named export" picker filters out type-only kinds (\`type\`, \`interface\`) and the literal name \`default\`, then returns the source-order-earliest name.
- [`init.ts`](./init.ts) — \`init\` command entrypoint. Scaffolds a folder's \`index.ts\` barrel plus a single \`itSpec.todo\` property stub under \`\_\_tests\_\_/&lt;slug&gt;.spec.test.ts\`. When \`folder\` is omitted, picks a leaf folder (no descendant candidate) among \`index.ts\`-bearing folders without a \`SPEC.md\`, so the default target is always a leaf. When the target already has an \`index.ts\`, the test stub imports the first named runtime export of that barrel; the picker resolves direct value declarations, \`export { ... }\` clauses, \`export \* as ns from ...\` namespace aliases, and follows \`export \* from ...\` re-exports up to STAR\_MAX\_DEPTH levels deep. Refuses if no runtime-named export resolves. Targets TTHW &lt;10 minutes.  Tagged error \`InitError\` is co-located here.
- [`migrate.ts`](./migrate.ts) — \`migrate\` command entrypoint. Walks SPEC.md + config files for format-version transitions; emits a diff for human review; idempotent. Format-version bumps are signposted in CHANGELOG before migration support changes.  Tagged error \`MigrateError\` is co-located here.
- [`project-context.ts`](./project-context.ts) — Project-wide loader for the codemod. Walks the project tree for every non-test \`.ts\` source, reads the tsconfig \`paths\` map, and reads the current git HEAD SHA. \`collectExports\` consumes the sources + paths so barrel re-exports across files and aliases resolve; emit needs the SHA for SpecFrontmatter and SpecArtifact metadata.  Tagged error \`ProjectContextError\` is co-located here.
- [`validate-checks.ts`](./validate-checks.ts) — Validate's gap-class cross-checks. Co-locates the four tagged errors (MissingSpecPropertyError, MissingStubError, MissingImplError, NoFoldersResolvedError) with the check effects that emit them and the diagnostic-builder helpers that shape their bodies.  Extracted from \`validate.ts\` to keep the orchestration file under the strict max-lines cap; the public surface still routes through \`validate.ts\` (this module is internal to the commands layer).
- [`validate-pipeline.ts`](./validate-pipeline.ts) — Shared analysis pipeline for \`validate\`. Walks the same inputs as \`generate\` (sources, tests, index barrel) and returns the \`FolderAnalysis\` that the markdown emitter consumes plus the per-test issues list (\`ItSpecIssue\[\]\`) that \`validate.ts\` maps to its gap-class exit codes.
- [`validate.ts`](./validate.ts) — \`validate\` command entrypoint. Walks each folder that has an \`index.ts\` barrel, runs the same analysis pipeline as \`generate\`, diffs the regenerated SPEC.md + sidecar against the on-disk artifacts, enforces coverage thresholds, and reports gap-class failures via tagged errors mapped to POSIX exit codes {1, 11, 12, 13}.  \`commands/index.ts\` translates each tag at the runtime boundary. The per-check effects and their tagged errors live in \`commands/validate-checks.ts\`; the shared analysis pipeline (folder walking, directive parsing, sidecar regeneration, threshold lookup) lives in \`commands/validate-pipeline.ts\`. This file is orchestration only.  \`--planned\`: regenerate SPEC.md + sidecar, diff on-disk; enforce per-folder coverage thresholds; per-test directive completeness is enforced via \`extractProperties\` issues + the diff check.  \`--implemented\`: planned-mode checks plus every \`itSpec.prop\` body is non-empty (no \`itSpec.todo\` placeholder).  Diagnostics carry a problem / cause / fix / docsLink quartet so agents can route the next remediation step.
- [`version.ts`](./version.ts) — Format version constant for SPEC.md frontmatter and the \`.safer-spec/&lt;folder&gt;.json\` sidecar JSON. Co-located with the commands because \`migrate.ts\` bumps it during format-version transitions and \`generate.ts\` stamps it onto every emitted SPEC.md.
- [`__tests__/cli.spec.test.ts`](./__tests__/cli.spec.test.ts) — Property stubs for the CLI surface. Exception Raising: the CLI rejects invalid flag combos with a structured \`CliUsageError\`. The \`validate\` subcommand exits with one of {0, 11, 12, 13} according to the validate gap-class map.  The CLI subcommand handlers are inlined in \`commands/index.ts\`; properties reference the \`validate\` command as the export under test.
- [`__tests__/init.spec.test.ts`](./__tests__/init.spec.test.ts) — Property stubs for the \`init\` command entrypoint. \`init\` scaffolds a folder's first \`index.ts\` barrel plus one \`itSpec.todo\` property stub under \`\_\_tests\_\_/&lt;slug&gt;.spec.test.ts\`, refuses to overwrite existing work, and picks a default leaf folder when no \`--folder\` is given. The scaffolded output must pass \`generate --write\` followed by \`validate --planned\`.
- [`__tests__/validate.spec.test.ts`](./__tests__/validate.spec.test.ts) — Property stubs for the \`validate\` command entrypoint. Validate enforces four cross-checks: JSDoc directives exist on every itSpec call, JSDoc values match runtime metadata, committed SPEC.md equals regenerated output, and every implemented property has a non-empty body.

## Properties

| Property | Type | Exports | Claim | Status |
|---|---|---|---|---|
| `cli-validate-rejects-conflicting-flags` | `Exception Raising` | `validate` | --planned and --implemented passed together fail with CliUsageError exit code 2 | todo |
| `cli-validate-exit-code-contract` | `Exception Raising` | `validate` | ValidateGapError tags propagate to process.exit(N) with N in {11, 12, 13} | todo |
| `generate-folderless-discovers-every-index-folder` | `Inclusion` | `generate` | \`safer-spec generate --write\` (no --folder) writes a SPEC.md + sidecar to every directory under the project root that contains an index.ts barrel | todo |
| `folder-input-canonicalized-before-stamping` | `Constant Equality` | `generate` | \`--folder $PWD/src\`, \`--folder ./src/\`, and \`--folder src//commands\` produce byte-identical SPEC.md and sidecar artifacts to their canonical cwd-relative forms | todo |
| `root-folder-uses-root-sidecar-slug` | `Constant Equality` | `generate` | \`--folder .\` (project root) writes the sidecar to \`.safer-spec/root.json\`, never \`.safer-spec/.json\`; generate, validate, and the sidecar-writer all agree on the slug | todo |
| `validate-diagnostics-route-to-stderr` | `Constant Equality` | `validate` | \`safer-spec validate\` failures write the diagnostic body to stderr; stdout stays empty so success-path stdout-piping scripts aren't polluted | todo |
| `init-refuses-existing-spec-md` | `Exception Raising` | `init` | init fails with InitError when &lt;folder&gt;/SPEC.md already exists | todo |
| `init-scaffolds-index-and-test-stub` | `Inclusion` | `init` | after init, &lt;folder&gt;/index.ts and &lt;folder&gt;/\_\_tests\_\_/&lt;slug&gt;.spec.test.ts both exist with the expected scaffolding | todo |
| `init-output-passes-validate-planned` | `Constant Equality` | `init` | running generate --write + validate --planned on the freshly scaffolded folder exits 0 | todo |
| `init-picks-default-folder-when-omitted` | `Inclusion` | `init` | init without --folder targets a leaf folder under the project root that has an index.ts but no SPEC.md | todo |
| `init-test-stub-imports-existing-barrel-export` | `Inclusion` | `init` | when the target folder already has an index.ts with at least one named export, the scaffolded test stub imports that export name (not the unused \`placeholder\` symbol) | todo |
| `init-refuses-existing-barrel-without-named-export` | `Exception Raising` | `init` | when the target folder has an index.ts that declares no named export (only \`export default\` or empty), init fails with InitError naming the missing-named-export precondition | todo |
| `init-prefers-leaf-over-ancestor-when-both-lack-spec` | `Inclusion` | `init` | when both \`src/index.ts\` and \`src/components/index.ts\` lack SPEC.md, init without --folder picks the deeper leaf, not the ancestor | todo |
| `init-prefers-deeper-leaf-when-root-also-lacks-spec` | `Inclusion` | `init` | when \`./index.ts\` (project root) and a descendant both lack SPEC.md, init picks the descendant — the project root never wins the default-leaf selection if any descendant candidate exists | todo |
| `init-skips-type-only-exports-when-picking-stub-target` | `Inclusion` | `init` | when an existing barrel's first export is \`type\` or \`interface\` (erased at runtime), the scaffolded stub skips it and binds to the first runtime-value export instead | todo |
| `init-uses-re-export-alias-public-name` | `Inclusion` | `init` | for an \`export { internal as publicName }\` re-export the scaffolded stub imports \`publicName\` (the publicly-bound symbol), not \`internal\` (the local-only name) | todo |
| `init-skips-const-enum-when-picking-stub-target` | `Inclusion` | `init` | \`export const enum Foo\` is treated as a type-only declaration and skipped by the export picker — the scaffolded stub binds to a later runtime-value export, never to the \`enum\` keyword | todo |
| `init-skips-default-re-exports-when-picking-stub-target` | `Inclusion` | `init` | re-export clauses that publicly bind to \`default\` (\`export { default }\`, \`export { foo as default }\`) are skipped — the scaffolded stub never emits \`import { default }\` | todo |
| `init-uses-namespace-alias-on-star-re-export` | `Inclusion` | `init` | for \`export \* as ns from "./x.js"\` the scaffolded stub imports \`ns\` (the runtime module-namespace binding) without recursing into the target file | todo |
| `init-follows-bare-star-re-export-to-target` | `Inclusion` | `init` | for \`export \* from "./x.js"\` the picker reads \`./x.ts\` (or \`.tsx\`/index variants), finds the first runtime-named export there, and imports it under that name — bounded by STAR\_MAX\_DEPTH levels of recursion | todo |
| `init-strips-comments-and-strings-before-picking-export` | `Inclusion` | `init` | \`// export const fake = 1\` and quoted-string text containing \`export const fake\` do not contribute candidates to the picker — only real declarations are considered | todo |
| `init-accepts-abstract-class-as-runtime-export` | `Inclusion` | `init` | \`export abstract class Foo\` is treated as a runtime named export — the scaffolded stub imports \`Foo\` rather than the picker refusing the barrel | todo |
| `init-star-scan-keeps-working-after-string-stripper` | `Inclusion` | `init` | direct/clause scans run on a strings+comments-stripped source while the star-re-export scan runs on the raw source — so a star-only barrel (\`export \* as ns from "./x"\` or \`export \* from "./x"\`) still resolves | todo |
| `init-supports-generator-function-exports` | `Inclusion` | `init` | \`export function\* stream()\` and \`export async function\* stream()\` are recognized as runtime named exports — the scaffolded stub imports \`stream\` | todo |
| `init-uses-top-level-namespace-as-stub-target` | `Inclusion` | `init` | \`export namespace api { export const inner = 1 }\` resolves to \`api\` (the top-level binding), never to nested \`inner\` — \`namespace\`/\`module\` keywords match earlier than nested \`export const\` declarations | todo |
| `init-namespace-alias-star-requires-resolvable-target` | `Exception Raising` | `init` | \`export \* as ns from "./missing.js"\` only resolves when at least one TS candidate for the specifier exists on disk; otherwise the picker skips this match (so a commented/quoted star-alias cannot fabricate a stub target) | todo |
| `validate-gate-determ` | `Roundtrip` | `validate` | two validate runs at the same tree SHA produce byte-identical reports modulo generated-at-sha | todo |
| `validate-emits-gap-cls` | `Exception Raising` | `validate` | every gate failure emits a typed ValidateError with gapClass in {11, 12, 13} | todo |
| `validate-diagnostic-shape` | `Typechecking` | `validate`, `formatDiagnostic` | every emitted diagnostic conforms to {problem, cause, fix, docsLink} | todo |
| `properties-table-self-host` | `Inclusion` | `validate` | the codemod's own SPEC.md ## Properties table equals what generate would emit from this codemod's test JSDoc | todo |
| `properties-table-self-host-bodied` | `Inclusion` | `validate` | every itSpec.prop in the codemod's own tree has a non-empty fast-check body (no it.todo, no empty body) | todo |
| `validate-flags-misplaced-per-export-directive` | `Exception Raising` | `validate` | a per-export directive (\`@spec.assume\`/\`@spec.guarantee\`/\`@spec.residual-contract\`/\`@spec.skip\`) placed in file-level JSDoc, or naming a symbol the folder doesn't export, fails as MissingSpecPropertyError with exit code 11 | todo |
| `validate-drift-gate-uses-folder-wide-export-set` | `Constant Equality` | `validate` | directives that reference internal helpers (exported by a non-barrel source file in the folder) validate successfully; the drift gate's known-exports set is the union of every local source file's exports, not the barrel only | todo |
| `validate-drift-ignores-external-source-directives` | `Constant Equality` | `validate` | a barrel re-exporting a subset of symbols from a sibling-folder source file validates without flagging the source file's other (unrelated) per-export directives as drift; drift checks scope to local sources only | todo |
| `validate-records-git-worktree-head-sha` | `Constant Equality` | `validate` | when run from a git worktree (\`.git\` is a file with a \`gitdir:\` pointer, not a directory), \`generatedAtSha\` resolves to the actual HEAD SHA via the pointer, not \`uncommitted\` | todo |
