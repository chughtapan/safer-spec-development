---
name: safer-spec-reviewing
description: Use when reviewing generated or hand-written code, SPEC.md output, sidecar JSON, @spec.* JSDoc, or itSpec property tests in any project using safer-spec-development for spec-driven development.
---

# safer-spec-reviewing

## Core Point

Review `safer-spec-development` projects as a cold reader who must trust the
spec to write code or review generated code without hidden context.

The first question is not whether the generated prose sounds reasonable. The
first question is:

Which explicit contract or property would fail if this implementation were
wrong?

Generated `SPEC.md` and sidecar JSON are summaries. The reviewable sources of
truth are source JSDoc, test JSDoc, and `itSpec` runtime metadata.

Assume the author or generated-code agent may be new to property-based
testing. Review whether the contract is understandable from the toolchain:
TypeScript types and Effect Schema refinements define the valid interface,
schema-derived fast-check arbitraries sample that interface, and `PropertyType`
metadata explains which behavior is being tested over those samples.

## Review Order

1. Read generated `SPEC.md` or sidecar JSON only to discover the public
   surface, residual contracts, properties, and skips.
2. Trace every important claim back to source JSDoc, Effect Schema/refinement
   definitions, or test JSDoc.
3. Check that property arbitraries sample the same refined domain the export
   accepts.
4. Review implementation or generated code against those claims.
5. Check that every built-in `PropertyType` is covered or explicitly skipped
   with a concrete reason.
6. Check that property bodies are real when validating in implemented mode.
7. Treat generated artifact drift as a symptom; fix the input directives or
   property metadata, then regenerate.

Do not keep historical context alive in the review. If a claim needs PR
history, issue history, or a prior agent conversation, it is not cold-readable
enough.

## Cold-Reader Questions

A passing change lets a fresh maintainer answer:

1. What public export or behavior changed?
2. What behavior is not captured by TypeScript or schema types?
3. Which Effect Schema or refinement defines the valid input domain?
4. Which arbitrary generates values from that domain?
5. Which residual contract states behavior outside the type boundary?
6. Which property type covers it?
7. Which `itSpec` property would fail for a wrong implementation?
8. Which property types are skipped, and why are they truly irrelevant?
9. Which command regenerates and validates the artifacts?

If the answer is "read the conversation" or "remember why we did this", request
changes.

## Reviewing Generated Code

Generated code is acceptable only when it satisfies the explicit spec. Style,
naming, and plausible control flow are not enough.

For each touched export:

- Read its declaration-level `@spec.*` directives.
- Read the TypeScript type, Effect Schema, or refinement that defines valid
  inputs and outputs.
- Read each `itSpec` property targeting the export.
- Check that the arbitrary is derived from, or explicitly constrained to, the
  same schema/refinement domain.
- Check invalid inputs, failure channels, normalization, side effects, and
  boundary behavior against the residual contracts.
- Check that the property body would fail for a common wrong implementation.
- Check that generated code did not add undocumented behavior that now needs a
  contract or property.

If code changes behavior, update source/test JSDoc first or request that the
implementation be brought back under the existing contract.

## Contract Checks

### JSDoc Placement

- `@specPurpose` belongs at file level on the public entry file or barrel.
- `@specAssume`, `@specGuarantee`, `@specResidualContract`,
  `@specSkip`, and `@specIgnoreExport` belong on exported declarations.
- `@specProperty`, `@specType`, `@specExports`, and `@specClaim` belong
  immediately above `itSpec.todo` or `itSpec.prop`.
- Generated `SPEC.md` property rows should not be hand-edited.

### Metadata Consistency

For every `itSpec` call:

- `@specProperty` matches the first positional id.
- `@specType` matches `meta.type`.
- `@specExports` matches the referenced export values by name.
- `@specClaim` is specific, present-tense, and falsifiable.
- `itSpec.prop` has meaningful arbitraries and assertions.
- `itSpec.todo` is used only for planned evidence.

### Residual Contracts

A good residual contract states behavior a type signature cannot prove:

- failure-channel behavior,
- ordering or lifecycle assumptions,
- side effects,
- determinism,
- normalization,
- persistence or filesystem semantics,
- trust-boundary behavior.

Reject residual text that only repeats the type, schema shape, obvious
parameter names, or implementation history.

## Property Evidence

Property-based tests are executable contracts over generated inputs. For a
newcomer, the shape should be visible:

- Domain: the TypeScript type plus Effect Schema/refinement.
- Generator: the fast-check arbitrary, preferably derived from that schema.
- Preconditions: any additional relationship required for the predicate.
- Predicate: the behavior that must hold for every generated sample.
- Classifiers: partitions proving edge cases were actually exercised.

Review the whole shape, plus skip reasons.

| PropertyType | Review question |
|---|---|
| `Roundtrip` | Does a value from the refined schema domain survive encode/key/render/readback exactly where promised? |
| `Partial Roundtrip` | Is the preserved schema-backed subset explicit and checked? |
| `Commutative Paths` | Are both paths independently meaningful and compared at the semantic level? |
| `Constant Equality` | Is the exact constant, tag, format, or exit code asserted? |
| `Constant Bounds Checking` | Are schema/refinement boundaries and generated ranges exercised? |
| `Constant Non-Equality` | Does the test prove distinct values cannot collapse? |
| `Typechecking` | Does the schema-derived, generated, inferred, or emitted shape match the declared type contract? |
| `Inclusion` | Does the required item, case, partition, or generated row have to appear? |
| `Exception Raising` | Does invalid input fail on the intended path, not merely throw somewhere? |

Classifier coverage and precondition pass rates matter because a property can
look correct while generated inputs miss the important partitions. Do not treat
line or branch coverage as a substitute for property-type evidence.

### Arbitrary Review

Reject properties whose generator tests a different domain than the export:

- `fc.string()` for a refined non-empty id unless the property constrains or
  filters it back to the schema domain.
- `fc.anything()` for an interface that already has an Effect Schema.
- Invalid-value generators used for a valid-domain property.
- Broad preconditions that discard most generated samples instead of deriving a
  tighter arbitrary from the schema.

Prefer properties that derive valid samples from the Effect Schema or build a
small adapter around the schema. For negative-path `Exception Raising` tests,
prefer starting from a valid generated value and corrupting one field so the
failure mode is specific.

## Generated Artifacts

For `SPEC.md` or `.safer-spec/<folder>.json` changes:

- Review source JSDoc and test JSDoc first.
- Confirm artifacts were regenerated instead of hand-edited.
- Confirm generated text is present-tense and self-contained.
- Remove process history such as "stage", "amendment", "per review",
  "previously", "this PR", or "temporary until".
- Keep stable contract facts: exports, tagged errors, exit codes, directive
  grammar, property claims, skip reasons, and residual-contract reasons.

Generated text should help a first-time user write or review code. It should
not preserve the path the team took to arrive there.

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

Use `validate --planned` for metadata and todo properties. Use
`validate --implemented` when property bodies are expected to be real and
classifier/precondition sidecars should exist.

## Findings

Order review findings by risk:

1. Implementation or generated code violates a residual contract.
2. Behavior changed without matching source/test JSDoc.
3. Missing property, missing `itSpec`, or weak non-falsifiable property.
4. Missing or vague `@specSkip` reason.
5. Generated artifact drift or hand-edited generated output.
6. Historical prose that blocks cold-readability.

State the fix in terms of the source of truth: edit source JSDoc, edit test
JSDoc, add or implement `itSpec`, regenerate artifacts, or change code to match
the existing contract.

## Common Reviewer Mistakes

| Mistake | Better review behavior |
|---|---|
| Reviewing generated `SPEC.md` as hand-authored prose | Trace confusing output to the directive that produced it. |
| Approving generated code because it looks plausible | Identify the contract and property that constrain it. |
| Accepting broad claims like "handles valid input" | Require a falsifiable behavior statement. |
| Treating skipped property types as harmless | Require a specific semantic reason for every skip. |
| Approving empty or assertion-light `itSpec.prop` bodies | Require real arbitraries and assertions or demote to `itSpec.todo`. |
| Confusing branch coverage with property evidence | Check property type, classifier coverage, and precondition pass rate. |
| Preserving stage or PR history in durable docs | Ask for present-tense contract text only. |

## Verdict

Approve when the contract is cold-readable, generated or hand-written code
satisfies it, property coverage is explicit, and validation/build checks pass.
Request changes when the reader needs hidden context, the wrong source of truth
was edited, property evidence is missing, or generated code changes behavior
without updating the spec first.
