---
folder: src
format-version: 0.1.0
---

# SPEC

## Purpose

Library facade. Re-exports the test-author surface: the `itSpec` helper and the closed property-type taxonomy. The `safer-spec` binary (commands/index.ts) is the integration point for command execution (`generate`, `validate`, `init`, `doctor`, `migrate`, `explain`); those are not re-exported from this facade.

This barrel carries `@specPurpose` only. Per-export `@specAssume`, `@specGuarantee`, and `@specResidualContract` directives live on the declarations in their source modules.

## Public surface

_No exports._
## Files

- `src/index.ts`

## Properties

_No `itSpec` calls in test files._
