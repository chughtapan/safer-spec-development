---
folder: src/spec
format-version: 0.1.0
generatedAtSha: 4a84c8a158ef9e717ac64d92d72ea82c1daa7ccd
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

Spec domain barrel. Anchors `src/spec/SPEC.md` (codemod requires every folder with a SPEC to expose an `index.ts` barrel) and re-exports the test-author surface (`itSpec`, `ItSpec`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated `@chughtapan/safer-spec-development/reporter` subpath (not this barrel) so config-time consumers don't transitively load `it-spec.ts`'s `vitest` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by `commands/` via path aliases; routing it through this barrel would be ceremony without a caller.

## Public surface

### [`ItSpec`](./grammar/it-spec.ts#L54)

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
   * @spec.guarantee "registers a fast-check property under `id` that runs `body` against samples drawn from `arb`; on completion attaches `{numRuns, numSkips, classifiers}` to the Vitest task's `meta.fastCheck` slot"
   *   reason: side-effect contract; reporter reads `meta.fastCheck` to
   *           build per-folder execution sidecars.
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
- "registers a fast-check property under \`id\` that runs \`body\` against samples drawn from \`arb\`; on completion attaches \`{numRuns, numSkips, classifiers}\` to the Vitest task's \`meta.fastCheck\` slot" — _side-effect contract; reporter reads \`meta.fastCheck\` to build per-folder execution sidecars._

**Residual contract:** "fast-check seed and numRuns come from fast-check's own defaults (numRuns=100, seed via FC env or random); Vitest config does NOT propagate to fast-check, and this wrapper passes no override" — _behavioral residue beyond the call signature; downstream authors need to know the property runner is not configured through Vitest._

### [`itSpec`](./grammar/it-spec.ts#L121)

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
    // eslint-disable-next-line sonarjs/assertions-in-tests -- fc.check + Effect.fail IS the assertion; sonarjs only recognizes expect/chai/jest patterns
    it(id, (ctx) =>
      Effect.runPromise(runProperty(id, property, ctx.task.meta as TaskMetaSlot)),
    );
  },
};
```

## Children

- [`artifact/`](./artifact/SPEC.md) — Public barrel for \`spec/artifact/\`. Re-exports the external surface — what other layers (analysis, commands) reach for, not what the folder uses internally. The parsers \`decodeSpecFrontmatter\` and \`decodeSpecArtifact\` are deliberately NOT re-exported: they exist for their own roundtrip tests + \`sidecar-writer.ts\`'s same-folder roundtrip assertion. \`decodeExecutionSidecar\` IS exposed because \`analysis/pipeline.ts\` parses execution sidecars during the \`--implemented\` freshness check.
- [`grammar/`](./grammar/SPEC.md) — Barrel for \`spec/grammar/\`. Re-exports the \`@spec.\*\` directive parsers, the closed \`PropertyType\` vocabulary, and the \`itSpec\` runtime encoding. The directive grammar has two sides — JSDoc (authored, parsed) and runtime (\`itSpec.todo\`/\`itSpec.prop\`) — both expressed here. \`validate --implemented\` cross-checks the two encodings.
- [`index.ts`](./index.ts) — Spec domain barrel. Anchors \`src/spec/SPEC.md\` (codemod requires every folder with a SPEC to expose an \`index.ts\` barrel) and re-exports the test-author surface (\`itSpec\`, \`ItSpec\`) consumed by the package facade. The Vitest reporter class is exposed via the dedicated \`@chughtapan/safer-spec-development/reporter\` subpath (not this barrel) so config-time consumers don't transitively load \`it-spec.ts\`'s \`vitest\` import, which throws when evaluated from a config file. The richer spec-format machinery (directive parser, emitter, sidecar writer, link resolver) is consumed directly by \`commands/\` via path aliases; routing it through this barrel would be ceremony without a caller.

## Properties

_No `itSpec` calls in test files._
