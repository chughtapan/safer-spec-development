---
name: safer-spec-authoring
description: Use when writing code, JSDoc directives, or property tests that feed safer-spec-development, especially when adding exports, declaring residual contracts, choosing property kinds, or updating generated SPEC.md artifacts.
---

# safer-spec-authoring

## Purpose

Use safer-spec to make the contract of a folder obvious to the next reader.
The reader should not need project history, issue context, or a prior agent
conversation. They need to know:

- What this folder exposes.
- What behavior the type system does not capture.
- Which properties prove the behavior.
- Which gaps are intentionally skipped and why.

`SPEC.md` is generated output. Authorship happens in source JSDoc and test
JSDoc.

## First-use mental model

There are two sources of truth:

- Source exports describe the public surface and residual contracts.
- Property tests describe evidence for those contracts.

`safer-spec generate` reads both and emits:

- Human-readable `SPEC.md`.
- Tool-readable `.safer-spec/<folder>.json`.

`safer-spec validate` checks that generated artifacts still match source and
tests.

## What To Write

### 1. Put purpose on the barrel

Use `@spec.purpose` at the file level for an `index.ts` barrel. Keep it short.

```ts
/**
 * @spec.purpose Parses SPEC.md directives and emits typed directive records.
 */
```

### 2. Put contracts on declarations

Every exported declaration should say what types cannot say. If there is no
residual behavior, say `none` and give the reason.

```ts
/**
 * @spec.guarantee "malformed directive bodies fail on the Effect error channel"
 *   reason: failure-channel behavior is not visible from the return type alone.
 * @spec.residual-contract "directive body length is capped before emit"
 *   reason: trust-boundary behavior protects generated markdown and sidecar JSON.
 */
export const parseFileDirectives = ...
```

```ts
/**
 * @spec.residual-contract none
 *   reason: shape and refinements are captured by Effect Schema.
 */
export const SpecFrontmatter = ...
```

### 3. Put property metadata above `itSpec`

Each property stub or implementation carries four directives. The runtime
metadata must match the JSDoc.

```ts
/**
 * @spec.property frontmatter-rejects-malformed
 * @spec.kind Exception Raising
 * @spec.exports decodeSpecFrontmatter
 * @spec.claim malformed YAML fails on the Effect error channel, never throws
 */
itSpec.todo("frontmatter-rejects-malformed", {
  kind: "Exception Raising",
  exports: [decodeSpecFrontmatter],
});
```

When implemented, use `itSpec.prop` with a real arbitrary and non-empty body.
`itSpec.todo` is acceptable only for planned work.

### 4. Skip explicitly

Do not silently omit an expected property kind. Use `@spec.skip` when a kind is
not meaningful for an export.

```ts
/**
 * @spec.skip "Partial Roundtrip"
 *   reason: normalization intentionally discards whitespace, so the original input is not recoverable.
 */
export const normalizeName = ...
```

## Property Kinds

Choose the kind that describes the behavior under test.

| Kind | Use when proving |
|---|---|
| `Roundtrip` | encode/decode, parse/serialize, generate/readback stability. |
| `Partial Roundtrip` | normalization preserves the intended subset. |
| `Commutative Paths` | two valid paths through the API produce equivalent results. |
| `Constant Equality` | fixed constants, stable output, known values. |
| `Constant Bounds Checking` | numeric, length, size, or partition bounds. |
| `Constant Non-Equality` | values that must remain distinct. |
| `Typechecking` | decoded data or detected shapes match declared types. |
| `Inclusion` | membership, containment, coverage, or presence. |
| `Exception Raising` | invalid input is rejected on the intended failure path. |

## Domain Placement

Place code by what it knows, not by generic technical category.

| Folder | Belongs there when it owns |
|---|---|
| `cli/` | CLI composition and process exit-code translation. |
| `modes/` | Mode entrypoints: `init`, `generate`, `validate`, `doctor`, `migrate`, `explain`. |
| `spec/` | SPEC.md grammar, parsing, frontmatter, markdown emission, escaping. |
| `source/` | TypeScript source analysis, export-shape detection, applicability, links. |
| `sidecar/` | `.safer-spec/<folder>.json` schema and writer. |
| `kinds/` | Closed property-kind vocabulary. |
| `authoring/` | `itSpec` helper used by property authors. |

Use `@safer/<domain>/...` for cross-domain imports. Same-folder sibling imports
can use `./sibling.js`.

## Authoring Workflow

1. Add or change the export.
2. Add declaration-level `@spec.*` JSDoc for residual behavior.
3. Add `itSpec.todo` or `itSpec.prop` with matching property JSDoc.
4. Run `pnpm safer-spec generate --write`.
5. Run `pnpm safer-spec validate --planned` for metadata-only work or
   `pnpm safer-spec validate --implemented` when property bodies are real.
6. Run the normal package build, tests, and lint.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Hand-editing generated `## Properties` rows | Edit the test JSDoc and run generate. |
| Writing history in a directive | State the current contract only. |
| Restating the type in `@spec.guarantee` | Put only behavior types cannot express. |
| Using `@spec.type` | Use `@spec.kind`. |
| Passing string exports in `itSpec` metadata | Use value references: `exports: [Agent]`. |
| Missing `reason:` under a residual or skip directive | Add a concrete reason. |
| Putting per-export directives on the barrel | Move them to the declaration site. |
| Creating shared `errors/` or `types.ts` dumping grounds | Keep errors and types with the domain that owns them. |
| Leaving `itSpec.prop` empty | Use `itSpec.todo` or implement the property body. |

## Exit Codes

| Error | Exit | Meaning |
|---|---:|---|
| `MissingSpecPropertyError` | 11 | Generated properties drifted from test metadata, or metadata mismatches runtime args. |
| `MissingStubError` | 12 | A required `itSpec` call or its JSDoc is missing. |
| `MissingImplError` | 13 | Implemented validation found a todo or empty property body. |

Use these codes to decide the fix: regenerate specs, add metadata/stubs, or
finish the property implementation.
