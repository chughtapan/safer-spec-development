# `@chughtapan/safer-spec-development` — package source

Per-folder SPEC.md TypeScript codemod. Generates structured specs from
source + JSDoc directives + Effect Schema + fast-check property tests;
validates the resulting artifact against property-type coverage,
classifier coverage, and precondition pass-rate gates.

## Folder boundary

| Layer       | Folder            | Responsibility                                                                                                       |
|-------------|-------------------|----------------------------------------------------------------------------------------------------------------------|
| commands    | `commands/`       | `safer-spec` binary + the six @effect/cli Commands it composes (`generate`, `validate`, `init`, `doctor`, `migrate`, `explain`) + `SPEC_FORMAT_VERSION` |
| domains     | `spec/`           | Spec output artifact — directive grammar + parser, escape helpers, markdown emitter (`emit.ts`, `frontmatter.ts`) AND JSON sidecar (`sidecar.ts`, `sidecar-writer.ts`). Two serializations of the same data. |
|             | `source/`         | TypeScript source analysis (shape detector, applicability resolver, link resolver)                                   |
| terminals   | `property-types/` | Closed taxonomy: `PropertyType` (9 OOPSLA assertion kinds), `ExportShape` (6 source shapes), `APPLICABILITY_MATRIX`   |

`spec/it-spec.ts` exports the author-facing `itSpec` test helper. It
lives with the rest of the spec format (directives, frontmatter, emit,
sidecar) because writing spec tests IS authoring the spec format.

`src/index.ts` is the curated library facade. It re-exports the small
public contract (`PROPERTY_TYPES`, `PropertyType`, `itSpec`, `ItSpec`).
Library consumers are test authors; CI integrators run the `safer-spec`
binary.

## Domain decomposition

Domains group files that share knowledge of the same artifact:
- `spec/` knows about the codemod's two output formats. The directive
  grammar parsed from source feeds both the markdown emitter and the
  sidecar JSON; they share escape helpers and `PROPERTY_TYPES` references.
- `source/` knows about TypeScript source analysis via ts-morph: shape
  detection, applicability resolution, link resolution. Independent of
  what the codemod outputs.

Tagged errors are co-located with the file that emits them; there is no
shared `errors/` folder.

## Path aliases

Cross-domain imports use TypeScript path aliases (`@safer/<domain>/*`),
configured once in `tsconfig.json` and read by:
- TypeScript at type-check time (native `paths` support).
- `tsc-alias` at build time (rewrites aliases to relative paths in `dist/`).
- Vitest at test time (via `vite-tsconfig-paths` plugin in `vitest.config.ts`).

`src/index.ts` uses `./` downward-relative paths so the package facade
is visibly a composition of subdomains.

## Implementation boundary

Command and analyzer entrypoints are contract-first: their signatures,
tagged errors, and JSDoc contracts define the integration surface.
Stub bodies fail with `Effect.die` until the implementer wires the
runtime behavior.

## Per-export directive discipline

Generated specs use three directive populations:
- File-level barrels (`index.ts`) carry `@spec.purpose` only.
- Per-export declarations carry `@spec.assume` / `@spec.guarantee` /
  `@spec.residual-contract` (one required) + optional
  `@spec.skip` / `@spec.ignore-export`.
- Per-test (above each `itSpec.prop`/`itSpec.todo` call) carries
  `@spec.property` / `@spec.type` / `@spec.exports` / `@spec.claim`.

The `validate --implemented` gate cross-checks JSDoc against runtime
metadata and against the regenerated SPEC.md.
