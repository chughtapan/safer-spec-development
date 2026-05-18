# `project/` — project-wide setup

What's the project we're operating on, and what gates does its config impose? The four files here are everything the commands and analysis layer need to know about the *target project* before doing any work.

| File | Job |
|---|---|
| `context.ts` | `loadProjectContext` — walks the project tree for sources, reads `tsconfig.json` `paths`/`baseUrl`, reads git HEAD SHA, calls `loadConfig`. The `ProjectContext` returned is passed to every analysis-layer function. Tagged error: `ProjectContextError`. |
| `config.ts` | `safer-spec.config.json` schema + `loadConfig` effect + `resolveThresholdsFor(config, folder)` resolver. Per-folder threshold overrides for `validate`'s gate. Tagged error: `ConfigError`. |
| `version.ts` | `SPEC_FORMAT_VERSION` constant. Stamped onto every emitted MODULE.md frontmatter and sidecar JSON. CHANGELOG signposts bumps; the `safer-spec-migrate` skill walks committed artifacts across them. |
| `folders.ts` | `discoverFolders` (recursive walk of `index.ts`-bearing folders), `discoverImmediateSubfolders` (for MODULE.md's `## Children` section), `buildChildren` (merged files + subfolders list). |

Consumed by `analysis/` and `commands/`. Never consumes from those layers (project is the leaf-side setup that everything else builds on).
