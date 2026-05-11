---
name: safer-spec-authoring
description: Use when adding property tests (`itSpec.prop`/`itSpec.todo`), writing per-export `@spec.*` JSDoc directives, choosing a domain folder for new code, or authoring SPEC.md content in the safer-spec-development codebase.
---

# safer-spec-authoring

## Overview

Author property tests, JSDoc directives, and module content for the safer-spec codemod. Tests are the source of truth for properties; `SPEC.md` is generated, not hand-written. Directives carry the residue that types cannot capture.

## When to use

- Adding a new property test with `itSpec.prop` or `itSpec.todo`.
- Writing or updating `@spec.assume` / `@spec.guarantee` / `@spec.residual-contract` on an exported declaration.
- Adding a new file, folder, or module — deciding which domain it belongs in.
- Editing SPEC.md content that is NOT in the generated `## Properties` table.

## When NOT to use

- Editing the `## Properties` section of SPEC.md directly. Run `pnpm safer-spec generate --write` instead — the section is machine-emitted from test JSDoc.
- Adding cross-domain abstractions like `errors/` registries or shared `types.ts` files. Errors live with their producer; types live with the layer that owns the data.
- Modifying CI lint rules to silence a warning. The strict policy is intentional; if a rule fires, fix the code, not the config.

## Core pattern

Tests author properties; the codemod emits `SPEC.md` from tests. Per-export JSDoc on the declaration site, file-level JSDoc only at `index.ts` barrels.

```ts
// src/spec/emit.ts

/**
 * @spec.guarantee "output uses LF endings, lexicographic file order, source-order export order"
 *   reason: byte-determinism is not captured by the return type; downstream `validate` compares bytes.
 * @spec.residual-contract "callers may not pass mutable arrays into `exports`"
 *   reason: the emitter sorts in place when given a writable array; ReadonlyArray is the trust boundary.
 */
export const emitSpec = (input: EmitInput): Effect.Effect<EmittedSpec, EmitError, never> =>
  Effect.gen(function* () { /* ... */ });
```

```ts
// src/spec/__tests__/emit.spec.test.ts

/**
 * @spec.property emit-byte-determ
 * @spec.type Roundtrip
 * @spec.exports emitSpec
 * @spec.claim two emit() calls on the same input produce byte-identical output.
 */
itSpec.todo("emit-byte-determ", {
  type: "Roundtrip",
  exports: [emitSpec],
});
```

After authoring the test, run `pnpm safer-spec generate --write` to update SPEC.md's `## Properties` section. Hand-editing the section is drift, not authorship.

## Quick reference

| Directive | Where it goes | Required? |
|---|---|---|
| `@spec.purpose` | File-level on `index.ts` barrels | One per barrel |
| `@spec.assume` | Per-export on the declaration site | At least one of {assume, guarantee, residual-contract} per export |
| `@spec.guarantee` | Per-export on the declaration site | At least one of the three |
| `@spec.residual-contract` | Per-export on the declaration site (`none reason: ...` is valid) | At least one of the three |
| `@spec.skip "<PropertyType>"` | Per-export on the declaration site | Explicit opt-out from the default-all PropertyTypes policy |
| `@spec.ignore-export <Name>` | File-level on `index.ts` | Optional escape hatch |
| `@spec.ignore` | File-level on any file | Optional file-level escape hatch |
| `@spec.property <id>` | Per-test on `itSpec.prop`/`itSpec.todo` | Required; matches first positional arg |
| `@spec.type <PropertyType>` | Per-test | Required; matches `opts.type` |
| `@spec.exports <symbols>` | Per-test | Required; matches `opts.exports.map(name)` |
| `@spec.claim <one-line>` | Per-test | Required; emitted into SPEC.md `## Properties` row |

Every directive needs a `reason:` line. Missing reason fires `spec-directive-parse-error` lint.

## PropertyTypes (closed enum)

The OOPSLA 9-type taxonomy. Default is all types apply to every export; opt out explicitly per type via `@spec.skip`.

| PropertyType | Typical use |
|---|---|
| `Roundtrip` | Encode/decode, serialize/parse, generate/readback. |
| `Partial Roundtrip` | Normalizing operations that preserve a subset. |
| `Commutative Paths` | Equivalent paths through an API. |
| `Constant Equality` | Known constants, fixed formatting. |
| `Constant Bounds Checking` | Numeric, length, or size bounds. |
| `Constant Non-Equality` | Values that must remain distinct. |
| `Typechecking` | Type-level or schema-shape assertions. |
| `Inclusion` | Membership, coverage, containment. |
| `Exception Raising` | Rejection and failure-channel behavior. |

The set is closed. Repo-specific additions are explicit configuration, not ad-hoc strings.

## Domain choice (where new code goes)

Three layers. Each owns its types, schemas (private), and tagged errors.

| Layer | Owns |
|---|---|
| `commands/` | CLI entrypoint, subcommand handlers, exit-code mapping. `CliExitCode` and `CliUsageError` live here. |
| `spec/` | Everything about the SPEC.md artifact: directive grammar, escape, frontmatter schema, markdown emitter, sidecar JSON schema/writer, link resolution, the `itSpec` test helper. |
| `property-types/` | The closed `PropertyType` enum and the `PROPERTY_TYPES` const. Terminal layer; no upward deps. |

Cross-layer imports use `@safer/<domain>/...`. Relative imports (`./`, `../`) within the same folder are fine; cross-folder relative imports are forbidden by lint.

## Common mistakes

| Mistake | Fix |
|---|---|
| Edited `## Properties` rows by hand | `pnpm safer-spec generate --write`. The table is machine-emitted. |
| Put `@spec.residual-contract` at file level | Move to the export's declaration site. File-level allows only `@spec.purpose` + `@spec.ignore`. |
| Schema constructor exported from `src/index.ts` | Keep the Schema private to its module; export `decode<Thing>` as the boundary. |
| Relative cross-folder import (`../../property-types/`) | Use `@safer/property-types/...`. |
| Centralized tagged error in a shared `errors/` folder | Co-locate with the producer. `ValidateError` → `commands/validate.ts`. |
| Missing `reason:` on a directive | Add it. Required by `spec-directive-parse-error`. |
| Bare string in `@spec.exports` | Reference values: `exports: [Agent]`, not `["Agent"]`. |
| `itSpec.prop` with empty body | Either fill the body OR demote to `itSpec.todo`. Empty `itSpec.prop` body fires `MissingImplError` (exit 13). |
| Added an applicability matrix or required-types-per-shape table | The contract is default-all + explicit `@spec.skip`. No prescriptive defaults. |
| Wrote prose about "we used to do X, now we do Y" in SPEC.md or README | History lives in git log + ADRs. Spec docs are present-tense; describe the current contract only. |

## Gap-class exit codes (for context when writing properties)

`pnpm safer-spec validate --implemented` emits one of three tagged errors:

| Tagged error | Exit | Meaning | Owner |
|---|---|---|---|
| `MissingSpecPropertyError` | 11 | Committed SPEC.md `## Properties` table drifted from test JSDoc OR JSDoc directive doesn't match `itSpec` args. | spec author (run generate) |
| `MissingStubError` | 12 | A required `itSpec` call or its JSDoc directives are missing. | architect |
| `MissingImplError` | 13 | A property is `itSpec.todo` or has an empty body. | implementer |

Write tests aware of which class your stub falls into. Running with `--planned` accepts `itSpec.todo` (no 13); running with `--implemented` requires non-empty `itSpec.prop` bodies.

## Real-world impact

Five rounds of spec convergence on the Stage 5 self-repo validation gate revealed that hand-authored `## Properties` tables drift from test declarations within hours. Inverting the authorship direction — tests author properties, codemod generates the table — eliminates drift by construction. The validate-vs-regenerate check is `Roundtrip` on the codemod's own output.
