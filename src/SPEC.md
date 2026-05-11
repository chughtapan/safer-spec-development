---
folder: src
format-version: 0.1.0
generatedAtSha: 8efa72786c88ffe74a813b8a68c9402f8f2f3cb1
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

Library facade. Re-exports the test-author surface: the `itSpec` helper and the closed property-type taxonomy. The `safer-spec` binary (commands/index.ts) is the integration point for command execution (`generate`, `validate`, `init`, `doctor`, `migrate`, `explain`); those are not re-exported from this facade.

This barrel carries `@spec.purpose` only. Per-export `@spec.assume`, `@spec.guarantee`, and `@spec.residual-contract` directives live on the declarations in their source modules.

## Public surface

### [`ItSpec`](./spec/it-spec.ts#L25)

```ts
export interface ItSpec {
  /**
   * @spec.assume "first positional `id` arg matches the `@spec.property` JSDoc directive value above the call site"
   *   reason: cross-check enforced by `validate --implemented`; mismatch
   *           is exit code 11 (MISSING_SPEC_PROPERTY).
   * @spec.guarantee "registers the property as a Vitest todo placeholder under `id`"
   *   reason: side-effect contract; the call mutates Vitest's collector,
   *           observable only at runtime.
   * @spec.residual-contract none
   *   reason: shape and refinements captured by parameter types.
   */
  todo(id: string, meta: PropertyMeta): void;

  /**
   * @spec.assume "JSDoc directives above this call match `id`, `meta.type`, and `meta.exports` member names"
   *   reason: cross-check enforced by `validate --implemented`.
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`"
   *   reason: side-effect contract; runtime registration with Vitest.
   * @spec.residual-contract "fast-check seed and numRuns are inherited from Vitest config; no override here"
   *   reason: behavioral residue beyond the call signature.
   */
  prop<T>(
    id: string,
    meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void;
}
```

### [`PROPERTY_TYPES`](./property-types/index.ts#L27)

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

### [`PropertyType`](./property-types/index.ts#L39)

```ts
export type PropertyType = (typeof PROPERTY_TYPES)[number];
```

### [`itSpec`](./spec/it-spec.ts#L54)

```ts
export const itSpec: ItSpec = {
  todo(id: string, _meta: PropertyMeta): void {
    it.todo(id);
  },
  prop<T>(
    id: string,
    _meta: PropertyMeta,
    _arb: fc.Arbitrary<T>,
    _body: (sample: T) => void | Promise<void>,
  ): void {
    // Registers as a Vitest placeholder until property execution is wired.
    // `validate --implemented` reports MISSING_IMPL (13) for promoted
    // properties that still lack a real body.
    it.todo(id);
  },
};
```

## Files

- `src/index.ts`

## Properties

_No `itSpec` calls in test files._
