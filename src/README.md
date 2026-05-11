# `@chughtapan/safer-spec-development` — package source

Per-folder SPEC.md TypeScript codemod. Generates structured specs from
source + JSDoc directives + Effect Schema + fast-check property tests;
validates property-type coverage, classifier coverage, and precondition
pass-rate gates.

## Folder boundary

| Layer       | Folder            | Responsibility                                                                                                              |
|-------------|-------------------|-----------------------------------------------------------------------------------------------------------------------------|
| commands    | `commands/`       | `safer-spec` binary + the six @effect/cli Commands it composes (`generate`, `validate`, `init`, `doctor`, `migrate`, `explain`) + `SPEC_FORMAT_VERSION` |
| domain      | `spec/`           | The spec format — directive grammar + parser, escape helpers, markdown emitter (`emit.ts`, `frontmatter.ts`), JSON sidecar (`sidecar.ts`, `sidecar-writer.ts`), link resolver, and the `itSpec` authoring helper |
| terminals   | `property-types/` | Closed taxonomy: `PropertyType` (9 OOPSLA assertion kinds)                                                                  |

`src/index.ts` is the curated library facade. It re-exports the small
public contract (`PROPERTY_TYPES`, `PropertyType`, `itSpec`, `ItSpec`).
Library consumers are test authors; CI integrators run the `safer-spec`
binary.

## Default-all + explicit opt-out

The codemod assumes every property type in `PROPERTY_TYPES` applies to
every export. Opting out is explicit via per-export
`@spec.skip "<PropertyType>" reason: <why>` directives. The tool ships no
matrix of "Schema exports must have these property types"; that
prescription lives in the author's skip reasons.

## Domain decomposition

The spec format is one domain. Directive grammar parsed from source
drives the markdown emitter, the sidecar JSON writer, and the link
resolver; they all share the directive vocabulary, escape helpers, and
trust-boundary discipline.

Tagged errors are co-located with the file that emits them.

## Path aliases

Cross-domain imports use TypeScript path aliases (`@safer/<domain>/*`),
configured once in `tsconfig.json` and read by:
- TypeScript at type-check time (native `paths` support).
- `tsc-alias` at build time (rewrites aliases to relative paths in `dist/`).
- Vitest at test time (via `vite-tsconfig-paths` plugin in `vitest.config.ts`).

`src/index.ts` uses `./` downward-relative paths so the package facade
is visibly a composition of subdomains.

## Implementation boundary

Command entrypoints are contract-first: their signatures, tagged errors,
and JSDoc contracts define the integration surface. Stub bodies fail
with `Effect.die` until the implementer wires the runtime behavior.

## Per-export directive discipline

Generated specs use three directive populations:
- File-level barrels (`index.ts`) carry `@spec.purpose` only.
- Per-export declarations carry `@spec.assume` / `@spec.guarantee` /
  `@spec.residual-contract` (one required) + optional
  `@spec.skip "<PropertyType>"` / `@spec.ignore-export`.
- Per-test (above each `itSpec.prop`/`itSpec.todo` call) carries
  `@spec.property` / `@spec.type` / `@spec.exports` / `@spec.claim`.

The `validate --implemented` gate cross-checks JSDoc against runtime
metadata and against the regenerated SPEC.md.
