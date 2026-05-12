---
folder: src/spec/directives
format-version: 0.1.0
generatedAtSha: 951341efc8a5e2645303480519dcdaefc9528fc3
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

Directive grammar entry point. Walks TypeScript source via ts-morph and dispatches each parsed TSDoc block (via `tsdoc-bridge`) to its per-population parser. Returns the typed `LocatedDirective` stream.

The population modules (`file-level`, `per-export`, `per-test`) co-locate each directive's Schema with its parse function. The `tsdoc-bridge` module owns the TSDoc configuration and the byte-accurate body extraction.

## Public surface

### [`DIRECTIVE_BODY_MAX_CHARS`](./shared.ts#L17)

```ts
export const DIRECTIVE_BODY_MAX_CHARS = 500;
```

Trust-boundary cap on directive bodies routed as agent context
(assume / guarantee / residual-contract / skip reasons / per-test
claim).

### [`JsDocDirectiveOverflowError`](./shared.ts#L28)

```ts
export class JsDocDirectiveOverflowError extends Data.TaggedError(
  "JsDocDirectiveOverflowError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly length: number;
  readonly limit: number;
}> { /* ... */ }
```

### [`JsDocDirectiveParseError`](./shared.ts#L38)

```ts
export class JsDocDirectiveParseError extends Data.TaggedError(
  "JsDocDirectiveParseError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
  readonly reason: string;
}> { /* ... */ }
```

### [`JsDocUnknownDirectiveError`](./shared.ts#L47)

```ts
export class JsDocUnknownDirectiveError extends Data.TaggedError(
  "JsDocUnknownDirectiveError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}> { /* ... */ }
```

### [`ParseError`](./shared.ts#L55)

```ts
export type ParseError =
  | JsDocDirectiveOverflowError
  | JsDocDirectiveParseError
  | JsDocUnknownDirectiveError;
```

### [`Directive`](./index.ts#L67)

```ts
export type Directive =
  | PurposeDirective
  | IgnoreFileDirective
  | AssumeDirective
  | GuaranteeDirective
  | ResidualContractDirective
  | SkipDirective
  | IgnoreExportDirective
  | PropertyDirective
  | TypeDirective
  | ExportsDirective
  | ClaimDirective;
```

### [`LocatedDirective`](./index.ts#L87)

```ts
export interface LocatedDirective {
  readonly directive: Directive;
  readonly location: DirectiveLocation;
}
```

### [`parseFileDirectives`](./index.ts#L247)

```ts
export const parseFileDirectives = (
  path: string,
  source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, ParseError> => /* ... */
```

**Guarantees:**
- "every emitted directive validates against the closed grammar before downstream consumption" — _trust-boundary; agents consume parsed directive bodies as context._

## Children

- [`file-level.ts`](./file-level.ts) — File-level directives — \`@spec.purpose\` and \`@spec.ignore\`. These attach to \`index.ts\` barrels; the parser treats their location \`exportName\` as \`null\`.
- [`index.ts`](./index.ts) — Directive grammar entry point. Walks TypeScript source via ts-morph and dispatches each parsed TSDoc block (via \`tsdoc-bridge\`) to its per-population parser. Returns the typed \`LocatedDirective\` stream.  The population modules (\`file-level\`, \`per-export\`, \`per-test\`) co-locate each directive's Schema with its parse function. The \`tsdoc-bridge\` module owns the TSDoc configuration and the byte-accurate body extraction.
- [`per-export.ts`](./per-export.ts) — Per-export directives — \`@spec.assume\`, \`@spec.guarantee\`, \`@spec.residual-contract\`, \`@spec.skip\`, \`@spec.ignore-export\`. These attach to public-surface exported declarations; the parser records the declaration's name in \`location.exportName\`. Each directive in this population carries a required \`reason:\` line.
- [`per-test.ts`](./per-test.ts) — Per-test directives — \`@spec.property\`, \`@spec.type\`, \`@spec.exports\`, \`@spec.claim\`. These attach above each \`itSpec.prop\`/\`itSpec.todo\` call site; the parser records \`location.exportName\` as \`null\`.
- [`shared.ts`](./shared.ts) — Shared infrastructure for the per-population directive modules: size caps, the \`ParseError\` union, the three tagged errors the parser can emit, and the small string helpers each population uses (unquote, splitReason).
- [`tsdoc-bridge.ts`](./tsdoc-bridge.ts) — \`@microsoft/tsdoc\` adapter layer. Owns the TSDoc configuration (closed set of \`@specXxx\` block-tag definitions), the parser singleton, the TSDoc-tag ↔ internal-name map, and the byte- accurate body extraction that bypasses TSDoc's content tree (so embedded \`@\`-references and angle-bracketed placeholders in prose bodies survive intact).

## Properties

_No `itSpec` calls in test files._
