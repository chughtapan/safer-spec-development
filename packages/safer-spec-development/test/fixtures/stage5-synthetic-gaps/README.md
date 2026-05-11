# synthetic-gaps

Adversarial fixtures consumed by `validate-emits-gap-cls`. Each fixture is a
small repository tree that injects exactly one coverage gap class:

| Subdir | Gap class | Expected exit |
|---|---|---|
| `missing-spec-property/` | `MISSING_SPEC_PROPERTY` | 11 |
| `missing-stub/` | `MISSING_STUB` | 12 |
| `missing-impl/` | `MISSING_IMPL` | 13 |

Fixtures are intentionally minimal so each failure maps to one diagnostic and
one exit code.
