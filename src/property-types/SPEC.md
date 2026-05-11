---
folder: src/property-types
format-version: 0.1.0
generatedAtSha: 857a48bac27460a685add1c69bc2dd8976fd5fc6
generatedFrom:
  jsdoc: ts-morph + @microsoft/tsdoc
  exports: ts-morph getExportedDeclarations
  schemas: []
  properties:
    - fast-check
  eslint: eslint-plugin-agent-code-guard
coverage:
  typeCoverage: 0
  classifierCoverage: null
  preconditionPassRate: null
  branchCoverageFromSpecTests: null
thresholds:
  typeCoverage: 0
  classifierCoverage: 0
  preconditionPassRate: 0
---

# SPEC

## Purpose

Closed taxonomy of property assertion types. Terminal domain — no upward dependencies.

The 9 OOPSLA-significant property types (Roundtrip, Inclusion, Exception Raising, …). Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered to the 9 statistically significant ones. Dropped: Generated-Expression Bounds Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299), Constant Inclusion (p=0.8969).

The codemod assumes ALL property types apply to every export by default. Opting out is explicit via per-export `@spec.skip "<PropertyType>" reason: <why>` directives. There is no built-in matrix mapping export shapes to required property types — that prescription belongs in the author's `@spec.skip` reasons, not in the tool.

Per-repo extension via `safer-spec.config.ts` `propertyTypesExtension: PropertyType[]`.

## Public surface

### [`PROPERTY_TYPES`](./index.ts#L27)

```ts
export const PROPERTY_TYPES = [
  "Roundtrip",
  "Partial Roundtrip",
  "Commutative Paths",
  "Constant Equality",
  "Constant Bounds Checking",
  "Constant Non-Equality",
  "Typechecking",
  "Inclusion",
  "Exception Raising",
] as const;
```

**Guarantees:**
- "membership order is stable across versions; the index of each property type is part of the contract" — _per-repo \`propertyTypesExtension\` appends only; never reorders._

**Residual contract:** none — _shape captured by \`as const\` tuple._

### [`PropertyType`](./index.ts#L39)

```ts
export type PropertyType = (typeof PROPERTY_TYPES)[number];
```

## Files

- `src/property-types/index.ts`

## Properties

_No `itSpec` calls in test files._
