# stage5-synthetic-gaps

Adversarial fixtures consumed by `validate-emits-gap-cls` (Stage 5 spec
sub-issue #3, `## Source properties`). Each fixture is a small repository
tree that injects exactly one coverage gap class:

| Subdir | Gap class | Expected exit |
|---|---|---|
| `missing-spec-property/` | `MISSING_SPEC_PROPERTY` | 11 |
| `missing-stub/` | `MISSING_STUB` | 12 |
| `missing-impl/` | `MISSING_IMPL` | 13 |

The implementer (sub-issue #5) authors the fixtures. Stage 1 architect leaves
this directory as a placeholder so the directory exists for the property
stub's `observation surface` reference.
