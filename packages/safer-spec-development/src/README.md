# `@chughtapan/safer-spec-development` — package source

Per-folder SPEC.md TypeScript codemod. Generates structured specs from
source + JSDoc directives + Effect Schema + fast-check property tests;
validates the resulting artifact against kind-coverage,
classifier-coverage, and precondition-pass-rate gates.

## Folder boundary (domain decomposition)

| Layer       | Folder              | Responsibility                                                                                              |
|-------------|---------------------|-------------------------------------------------------------------------------------------------------------|
| entrypoint  | `cli/`              | `safer-spec` binary; composes mode entries; co-locates `CliExitCode` + `CliUsageError` tagged errors        |
| modes       | `modes/`            | Six mode entries (`generate`, `validate`, `init`, `doctor`, `migrate`, `explain`) + their tagged errors + `SPEC_FORMAT_VERSION` |
| domains     | `spec/`             | SPEC.md artifact (directive grammar, parser, frontmatter, emitter, escape) + their tagged errors            |
|             | `source/`           | TypeScript source analysis (kind detection, applicability matrix, link resolver) + their tagged errors      |
|             | `sidecar/`          | `.safer-spec/<folder>.json` JSON artifact (Schema, decode boundary, writer) + their tagged errors           |
| terminals   | `kinds/`            | Closed `Kind` enum + `KINDS` array (OOPSLA 9-kind taxonomy)                                                 |
|             | `authoring/`        | Author-facing `itSpec` test helper                                                                          |

`src/index.ts` is the curated library facade. It re-exports the small
public contract (`KINDS`, `Kind`, `itSpec`, `ItSpec`). CLI modes stay behind
the `safer-spec` binary unless a concrete programmatic consumer needs a
subpath export.

## Why domain decomposition (not functional layers)

Functional layers (parser / emitter / detector / etc.) group "things that
DO similar things." Domain decomposition groups "things that KNOW about
the same artifact": JSDoc parser + emitter + frontmatter + escape all
share knowledge of the SPEC.md format, so they live under `spec/`.
ts-morph kind detection + applicability + link resolution all share
TypeScript-source-analysis knowledge, so they live under `source/`.

Files in the same domain change together. Domain boundaries are where
contracts are defined.

## Path aliases

Cross-domain imports use TypeScript path aliases (`@safer/<domain>/*`),
configured once in `tsconfig.json` and read by:
- TypeScript at type-check time (native `paths` support).
- `tsc-alias` at build time (rewrites aliases to relative paths in `dist/`).
- Vitest at test time (via `vite-tsconfig-paths` plugin in `vitest.config.ts`).

`src/index.ts` is the one exception: it uses `./` downward-relative paths
so the package facade is visibly a composition of subdomains, no alias
indirection.

## Implementation boundary

Some mode and analyzer entrypoints are contract-first stubs that currently
fail with `Effect.die`. Their signatures, tagged errors, and JSDoc contracts
define the integration surface; runtime behavior belongs behind those same
boundaries.

## Per-export directive discipline

Generated specs use three directive populations:
- File-level barrels (`index.ts`) carry `@spec.purpose` only.
- Per-export declarations carry `@spec.assume` / `@spec.guarantee` /
  `@spec.residual-contract` (one of these is required) + optional
  `@spec.skip` / `@spec.ignore-export`.
- Per-test (above each `itSpec.prop`/`itSpec.todo` call) carries
  `@spec.property` / `@spec.kind` / `@spec.exports` / `@spec.claim`.

The `validate --implemented` gate cross-checks JSDoc against runtime
metadata and against the regenerated SPEC.md.
