---
name: safer-spec-reviewing
description: Use when reviewing safer-spec-development code, SPEC.md output, sidecar contracts, README/design text, or `@spec.*` JSDoc for cold-readability, contract correctness, and generated-artifact drift.
---

# safer-spec-reviewing

## Purpose

Review safer-spec artifacts as a first-time maintainer who must trust them to
write or review code without conversation history.

The core question is not "does this document explain how we got here?" It is:

Can a cold reader understand the current contract, find the source of truth,
and know what to change next?

## Review Model

There are two tracks:

- Cold-readability: the artifact is present-tense, self-contained, and free of
  process history.
- Contract correctness: generated output matches source JSDoc, test JSDoc, and
  the safer-spec validation model.

Review generated artifacts by reviewing their inputs. `SPEC.md` can reveal a
problem, but the fix usually belongs in source JSDoc or test JSDoc.

## Cold-Reader Questions

A passing artifact lets a fresh reader answer:

1. What does this folder or export do?
2. What is the public surface?
3. What behavior is not captured by types?
4. Which properties cover that behavior?
5. Which gaps are intentionally skipped, and why?
6. Which command regenerates or validates the artifact?

If the answer requires issue history, PR history, stage numbers, amendment
numbers, or prior chat context, request changes.

## Strip These

| Pattern | Why it fails cold-readability |
|---|---|
| "Stage N", "Amendment N", "per finding", "after review" | Requires history the reader does not have. |
| "Previously X, now Y" | Git history can answer that; specs state current contracts. |
| "This PR does..." | PR descriptions can describe diffs; docs describe durable behavior. |
| "Temporary until..." | File an issue if needed; do not put roadmap prose in the contract. |
| Long motivation paragraphs | Keep only the operational contract a maintainer needs. |
| Cross-references to comments, chats, or issue debates | Not stable enough for generated or architecture docs. |

## Keep These

| Keep | Why |
|---|---|
| Function names, exported types, tagged errors, exit codes | These are the reviewable contract. |
| Directive grammar and placement rules | Authors need exact syntax and location. |
| One focused example per concept | Examples teach faster than rationale. |
| Code paths for durable source references | Readers can inspect the implementation. |
| Skip reasons and residual-contract reasons | These explain behavior types cannot encode. |

## Contract Checks

### JSDoc Placement

- `@spec.purpose` belongs at file level on `index.ts` barrels.
- `@spec.assume`, `@spec.guarantee`, `@spec.residual-contract`,
  `@spec.skip`, and `@spec.ignore-export` belong on exported declarations.
- `@spec.property`, `@spec.kind`, `@spec.exports`, and `@spec.claim` belong
  immediately above `itSpec.todo` or `itSpec.prop`.
- Per-export directives on a barrel are findings.
- Generated `## Properties` rows should not be hand-edited.

### Property Metadata

For every `itSpec` call:

- `@spec.property` matches the first positional id.
- `@spec.kind` matches `meta.kind`.
- `@spec.exports` matches the referenced export values by name.
- `@spec.claim` is one-line and specific enough to review.
- `itSpec.prop` has a meaningful body; otherwise it should be `itSpec.todo`.

### Residual Contracts

A good residual contract states behavior that the signature cannot prove:

- failure-channel behavior,
- ordering or lifecycle assumptions,
- side effects,
- determinism,
- trust-boundary behavior,
- persistence or filesystem semantics.

Reject residual text that only restates the type, schema shape, or obvious
parameter names.

### Property Kinds

Use `@spec.kind`, not `@spec.type`. Check that kind names come from the closed
`KINDS` list and that skips are explicit with reasons.

### Domain Cohesion

Check that code is placed by ownership:

- `cli/` owns CLI wiring and process exit-code translation.
- `modes/` owns command modes and mode-specific tagged errors.
- `spec/` owns SPEC.md grammar, parsing, frontmatter, emission, and escaping.
- `source/` owns TypeScript source analysis, applicability, and link resolution.
- `sidecar/` owns structured JSON schema and writing.
- `kinds/` owns the closed kind vocabulary.
- `authoring/` owns the `itSpec` helper.

Do not approve new `errors/`, `types.ts`, `utils/`, `kernel/`, or similar
dumping grounds unless there is a concrete ownership argument.

### Public Surface

The package root should stay small. It exposes author-facing API:

- `KINDS`
- `Kind`
- `itSpec`
- `ItSpec`

Mode internals and schema constructors should stay behind domain boundaries
unless there is a concrete external consumer.

### Generated Artifacts

For generated `SPEC.md` or sidecar changes:

- Review source JSDoc and test JSDoc first.
- Confirm `pnpm safer-spec generate --write` was run if generated output is
  stale.
- Confirm `validate --planned` or `validate --implemented` matches the state of
  the property bodies.
- Treat generated markdown as a symptom; fix the source input.

## Commands To Run

Use the narrowest command that checks the change:

```bash
pnpm safer-spec generate --dry-run
pnpm safer-spec validate --planned
pnpm safer-spec validate --implemented
pnpm --filter @chughtapan/safer-spec-development build
pnpm --filter @chughtapan/safer-spec-development test
pnpm lint
```

If package-local lint fails only because its script omits knip, run root
`pnpm lint`; the root script is the repo-level gate.

## Review Findings

Order findings by risk:

1. Contract drift: generated artifact does not match source/test metadata.
2. Missing evidence: required property, directive, or reason is absent.
3. Wrong source of truth: hand-edited generated output.
4. Misleading prose: history, stages, or external conversation context.
5. API leakage: public facade exports internal schemas or mode internals.
6. Domain drift: code moved to a folder that does not own the concept.

Use concrete file and line references. State the fix in terms of the source of
truth: edit source JSDoc, edit test JSDoc, regenerate, or implement the
property body.

## Common Reviewer Mistakes

| Mistake | Better review behavior |
|---|---|
| Reviewing generated `## Properties` text as if it were hand-authored | Review the test JSDoc that generated it. |
| Accepting historical prose because it explains motivation | Ask for present-tense contract text. |
| Asking for more rationale when the contract is already clear | Prefer shorter docs with exact examples. |
| Treating skipped kinds as harmless | Require a specific `reason:` for every skip. |
| Approving empty `itSpec.prop` bodies | Require implementation or demotion to `itSpec.todo`. |
| Expanding the public facade "for convenience" | Require a named consumer. |

## Verdict

- Approve when the artifact is cold-readable, generated output matches inputs,
  and validation/build checks pass.
- Request changes when a reader needs hidden context, the wrong source of truth
  was edited, property metadata drifts, or a residual contract is missing.
-- Reject only for changes that make validation misleading, leak internal API,
  or normalize generated-artifact drift.
