---
name: safer-spec-reviewing
description: Use when reviewing safer-spec PRs, design-doc comments, SPEC.md files, READMEs, or `@spec.*` JSDoc directive bodies for cold-readability and structural correctness. Apply during architect-PR review, cold-reader passes, or before approving any spec artifact change.
---

# safer-spec-reviewing

## Overview

Two-track review of safer-spec artifacts: cold-readability (would a fresh reader understand this?) and structural correctness (does this satisfy the contract?). Cold-reading strips narrative cruft; structural review verifies the typed surface, directive granularity, and lint discipline.

## When to use

- Reviewing a PR against the safer-spec-development repo.
- Running an Amendment 7 cold-reader pass on architect-tier artifacts (PR description, design-doc comments, READMEs, directive bodies).
- Auditing SPEC.md, DESIGN.md, or AUTHORING.md changes for narrative drift.
- Sanity-checking a per-export `@spec.assume` / `@spec.guarantee` body before approving.

## When NOT to use

- Reviewing the TypeScript code itself for correctness, performance, or test coverage — that is structural review-senior work using its own rubric.
- Reviewing a `generate`-emitted `## Properties` section — that section is machine-output, not human-authored prose; review its INPUTS (the test JSDoc) instead.
- Reviewing implement-staff PRs that don't touch spec artifacts.

## Cold-readability track

A fresh maintainer with zero prior conversation context reads each artifact and answers:

1. What does this artifact's contract say?
2. What is its public surface (functions / types / directives / exit codes / domains)?
3. Name one residual contract (something types cannot capture).

Pass: the reader does (1)–(3) without asking >2 clarifying questions and without reading any other context-bearing artifact. Fail: any of the questions requires "what's a v3 finding?" or "what does Amendment N mean?" or "which PR introduced this?"

### Strip these (narrative cruft)

| Pattern | Why strip |
|---|---|
| "Per v3 finding #2", "after Amendment 5", "post-rename", "previously we did X" | History references — context the cold reader does not have. |
| "We considered approach A but chose B because…" | Decision-narrative. Migrate to `docs/decisions/<adr>.md` if load-bearing; otherwise delete. |
| "Per codex finding", "per review-senior round 1", "per team-lead instruction #6(b)" | Inline review-feedback citations. Reference conversations that don't exist for the cold reader. |
| "Currently using X until Y lands", "Stage 0 simplification, will fix later" | In-flight workaround mentions. File an issue and link from a separate operational doc, not the spec body. |
| "This PR does X", "this commit fixes Y" | Spec docs are present-tense contract statements, not changelogs. PR descriptions can summarize the diff; DESIGN.md cannot. |
| Sentences explaining what was removed and why | If something is gone, the doc describes what IS, not what was. |

### Keep these (the contract)

- Function signatures, type shapes, invariants, exit-code semantics, directive grammar, file layout, error class names.
- A one-sentence statement of intent per section. Not a paragraph of motivation.
- Cross-references to code paths (`spec/directives.ts:42`, `commands/validate.ts`). Not to issue comments or PR review threads.
- Worked examples that show the contract in use (one excellent example per concept).

### Cold-reader cleanup output

The cold-reader edits the artifact in place. Output is a single commit titled `cold-reader: cleanup narrative cruft; focus on what`. Constraint: the cold-reader removes, never adds. If an artifact has a gap (missing purpose sentence, missing example), the cold-reader flags it in a summary comment but does not fill it. Filling gaps is the author's job.

## Structural correctness track

Apply the rubric below to any PR that touches `src/**`, `docs/**`, `eslint.config.mjs`, `tsconfig.json`, `package.json`, or `*.spec.test.ts` files.

### 1. Effect-native discipline (P1–P4 of PRINCIPLES.md)

- `grep ': Promise<' src/` returns empty.
- `grep 'throw new ' src/` returns empty in runtime paths (stub `Effect.die(new Error(...))` is acceptable).
- `grep 'console\.' src/` returns empty.
- Every tagged error uses `Data.TaggedError`.
- All file IO via `@effect/platform-node` `FileSystem` + `Path` services.
- All CLI via `@effect/cli` `Command.make`.

### 2. Tagged-error gap classes

- `validate` returns `Effect<ValidatePassReport, MissingSpecPropertyError | MissingStubError | MissingImplError, ...>`.
- POSIX exit codes derived from a single `satisfies`-typed map (no magic 11/12/13 sprinkled in code).
- CLI catches via `Effect.catchTags` + `CliExitCode({ code })` at the `NodeRuntime.runMain` boundary.

### 3. Directive grammar coverage

`spec/directives.ts` defines all three directive populations:

- File-level: `@spec.purpose`, `@spec.ignore`.
- Per-export: `@spec.assume`, `@spec.guarantee`, `@spec.residual-contract`, `@spec.skip`, `@spec.ignore-export`.
- Per-test: `@spec.property`, `@spec.type`, `@spec.exports`, `@spec.claim`.

Every directive parser rejects missing `reason:` lines. Bodies are size-capped and escape-on-emit (defends residual-contract bodies against injection).

### 4. Per-export directive placement

- Every export on the curated public facade has `@spec.assume` / `@spec.guarantee` / `@spec.residual-contract` JSDoc at the actual declaration site (NOT on the barrel `index.ts`).
- File-level `@spec.residual-contract` is a finding — only `@spec.purpose` and `@spec.ignore` belong at file level.

### 5. Test-side directive coverage

Every `itSpec.prop` or `itSpec.todo` call has all four per-test directives. JSDoc values match `itSpec` arguments:

- `@spec.property === itSpec.<call>` first positional arg.
- `@spec.type === opts.type`.
- `@spec.exports === opts.exports.map(deriveName)`.

Mismatch is `MissingSpecPropertyError` at validate time.

### 6. Domain cohesion (not functional layering)

- Three layers only: `commands/`, `spec/`, `property-types/`.
- No `kernel/`, no `errors/`, no `detection/`, no `pipeline/`, no `authoring/`, no `sidecar/` (folded into `spec/`), no `cli/` (renamed to `commands/`).
- Tests, parsers, emitters that share contract knowledge of the same artifact live in the same domain.

### 7. Curated public facade

- `src/index.ts` exports 4 symbols: `PROPERTY_TYPES`, `PropertyType`, `itSpec`, `ItSpec`.
- No schema constructors (`SpecArtifactSchema`, `SpecFrontmatterSchema`, directive schemas) on the public surface.
- `decode<Thing>` boundary functions stay internal unless explicitly part of the user-facing API.

### 8. No-relative-imports policy

- `tsconfig.json` carries `paths: { "@safer/*": ["src/*"] }`.
- ESLint rule (`import/no-relative-parent-imports` or agent-code-guard equivalent) configured `error`.
- `grep -rE 'from "[\.][\.]?/' src/ tests/` returns empty for cross-folder paths.
- Same-folder relative imports (`./sibling.js`) are acceptable.

### 9. Lint + build + test

- `pnpm install && pnpm build && pnpm test && pnpm lint` all exit 0.
- ESLint: **0 errors and 0 warnings** (severity promoted via `promoteWarnToError` helper at config level, not `--max-warnings 0`).
- Knip: 0 unused exports, 0 unused deps. No `ignoreDependencies` or `ignoreExportsUsedInFile` shortcuts.
- TypeScript: `tsc` succeeds; `tsc-alias` rewrites dist output; vite-tsconfig-paths handles test resolution.

### 10. Speculative-stub audit

- Every export in `src/index.ts` has a current consumer.
- No "we'll need this in Stage N" speculation. Stubs without consumers are deleted; the implementer re-adds when wiring real bodies.

## Quick reference

| What you're reviewing | Apply tracks |
|---|---|
| PR description | Cold-readability |
| Design-doc comment on a sub-issue | Cold-readability |
| `docs/DESIGN.md`, `docs/AUTHORING.md` | Both |
| Module `README.md` files | Both |
| Per-export JSDoc bodies | Both |
| `src/**/*.ts` code | Structural |
| `eslint.config.mjs`, `tsconfig.json`, `package.json` | Structural |
| `*.spec.test.ts` | Structural (directive grammar, item 5) |

## Verdict routing

| Verdict | Trigger |
|---|---|
| `approve` | All rubric items pass; no narrative cruft remaining. |
| `changes-requested` (trivial polish) | 1–3 cosmetic items (typo, missing word, redundant sentence). No contradictions, no missing measurements, no contract drift. |
| `reject` / substantive `changes-requested` | Any rubric item fails: Effect-native regression, schema-constructor leak, file-level per-export directives, structural relative imports, lint warnings, ungated speculative exports, cold-readability failure on a load-bearing artifact. |

## Common mistakes (reviewer side)

| Mistake | Fix |
|---|---|
| Flagged a narrative paragraph as "structural" — it's just cruft | Strip it (cold-reader track). Don't gate merge on cruft. |
| Approved with "deferred to follow-up" because the fix felt big | Doctrine: if a rubric item fails, that's `changes-requested`. Follow-ups become PR-2; this PR doesn't merge until clean. |
| Missed that an architect-renamed symbol left stale references in docs | Run `grep -rE '<old-name>' docs/ src/**/*.md` after every rename PR. |
| Accepted `--max-warnings 0` in the lint script instead of config-level severity | That's a runtime trick. The CONFIG is the gate. Reject; demand `promoteWarnToError` at the source rules. |
| Treated a "we considered X" paragraph as load-bearing because it explains a decision | Migrate to `docs/decisions/<adr>.md` and strip from the spec doc. Spec docs are present-tense. |
| Approved with knip `ignoreDependencies` for "stub-stage gaps" | Stub-stage deps should be removed from `package.json` until used. Implementer re-adds. |

## Real-world impact

PR #8 (the original Stage 1 architect PR) merged with 159 lint warnings deferred as "Stage 0 advisory carryovers." Each warning named real architectural drift — public-vendor-type leaks, inventory barrels, missing folder READMEs, sibling-import advisories. Treating warnings as errors at config level and applying this rubric on the follow-up (PR #9) eliminated all 159, trimmed the public surface from 71 symbols to 4, and surfaced multiple unused-stub deletions that simplified the implementer's downstream scope. Strict review prevents the "approve with deferred cleanup" trap that compounds over rounds.
