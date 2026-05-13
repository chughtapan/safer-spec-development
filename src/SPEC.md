---
folder: src
format-version: 0.1.0
generatedAtSha: 5269a9225cb8a9779bccf32e5a2016fd1b96d0c0
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
   * @spec.residual-contract "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override"
   *   reason: behavioral residue beyond the call signature; downstream
   *           authors need to know the property runner is not configured
   *           through Vitest.
   */
  prop<T>(
    id: string,
    meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void;
}
```

**Assumes:**
- "first positional \`id\` arg matches the \`@spec.property\` JSDoc directive value above the call site" — _cross-check enforced by \`validate --implemented\`; mismatch is exit code 11 (MISSING\_SPEC\_PROPERTY)._
- "JSDoc directives above this call match \`id\`, \`meta.type\`, and \`meta.exports\` member names" — _cross-check enforced by \`validate --implemented\`._

**Guarantees:**
- "registers the property as a Vitest todo placeholder under \`id\`" — _side-effect contract; the call mutates Vitest's collector, observable only at runtime._
- "registers a fast-check property under \`id\` that runs \`body\` against samples drawn from \`arb\`" — _side-effect contract; runtime registration with Vitest._

**Residual contract:** "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override" — _behavioral residue beyond the call signature; downstream authors need to know the property runner is not configured through Vitest._

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

### [`itSpec`](./spec/it-spec.ts#L56)

```ts
export const itSpec: ItSpec = {
  todo(id: string, _meta: PropertyMeta): void {
    it.todo(id);
  },
  prop<T>(
    id: string,
    _meta: PropertyMeta,
    arb: fc.Arbitrary<T>,
    body: (sample: T) => void | Promise<void>,
  ): void {
    const property = fc.asyncProperty(arb, (sample) => Promise.resolve(body(sample)));
    // eslint-disable-next-line sonarjs/assertions-in-tests -- fc.assert IS the assertion; sonarjs only recognizes expect/chai/jest patterns
    it(id, () => fc.assert(property));
  },
};
```

## Children

- [`commands/`](./commands/SPEC.md) — CLI binary. Composes the six subcommands (\`init\`, \`generate\`, \`validate\`, \`doctor\`, \`explain\`, \`migrate\`) into the top-level \`safer-spec\` Command, then translates each tagged failure into \`process.exit(N)\` at the runtime boundary.  Exit-code mapping at this boundary: - \`MissingSpecPropertyError\` → exit 11 - \`MissingStubError\`         → exit 12 - \`MissingImplError\`         → exit 13 - \`CliUsageError\`            → exit 2 (POSIX usage convention) - any other defect / failure → \`NodeRuntime.runMain\` default (non-zero)  Tagged errors \`CliExitCode\` and \`CliUsageError\` are co-located here.
- [`property-types/`](./property-types/SPEC.md) — Closed taxonomy of property assertion types. Terminal domain — no upward dependencies.  The 9 OOPSLA-significant property types (Roundtrip, Inclusion, Exception Raising, …). Source: Ravi & Coblenz, OOPSLA 2025 (12 categories), filtered to the 9 statistically significant ones. Dropped: Generated-Expression Bounds Checking (p=0.0627), Generated-Expression Non-Equality (p=0.3299), Constant Inclusion (p=0.8969).  The codemod assumes ALL property types apply to every export by default. Opting out is explicit via per-export \`@spec.skip "&lt;PropertyType&gt;" reason: &lt;why&gt;\` directives. There is no built-in matrix mapping export shapes to required property types — that prescription belongs in the author's \`@spec.skip\` reasons, not in the tool.  Per-repo extension via \`safer-spec.config.ts\` \`propertyTypesExtension: PropertyType\[\]\`.
- [`spec/`](./spec/SPEC.md) — Spec domain barrel. Anchors \`src/spec/SPEC.md\` (codemod requires every folder with a SPEC to expose an \`index.ts\` barrel) and re-exports the test-author surface (\`itSpec\`, \`ItSpec\`) consumed by the package facade. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by \`commands/\` via path aliases; routing it through this barrel would be ceremony without a caller.
- [`index.ts`](./index.ts) — Library facade. Re-exports the test-author surface: the \`itSpec\` helper and the closed property-type taxonomy. The \`safer-spec\` binary (commands/index.ts) is the integration point for command execution (\`generate\`, \`validate\`, \`init\`, \`doctor\`, \`migrate\`, \`explain\`); those are not re-exported from this facade.  This barrel carries \`@spec.purpose\` only. Per-export \`@spec.assume\`, \`@spec.guarantee\`, and \`@spec.residual-contract\` directives live on the declarations in their source modules.

## Properties

_No `itSpec` calls in test files._
