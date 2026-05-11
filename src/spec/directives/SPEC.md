---
folder: src/spec/directives
format-version: 0.1.0
generatedAtSha: 29d1d020e5a7df0a34e0113947f89e503bcfa2e2
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

### [`DIRECTIVE_BODY_MAX_CHARS`](./shared.ts#L19)

```ts
export const DIRECTIVE_BODY_MAX_CHARS = 500;
```

Trust-boundary cap on directive bodies routed as agent context
(assume / guarantee / residual-contract / skip reasons / per-test
claim).

### [`JsDocDirectiveOverflowError`](./shared.ts#L30)

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

### [`JsDocDirectiveParseError`](./shared.ts#L40)

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

### [`JsDocUnknownDirectiveError`](./shared.ts#L49)

```ts
export class JsDocUnknownDirectiveError extends Data.TaggedError(
  "JsDocUnknownDirectiveError",
)<{
  readonly path: string;
  readonly line: number;
  readonly directive: string;
}> { /* ... */ }
```

### [`ParseError`](./shared.ts#L57)

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

### [`parseFileDirectives`](./index.ts#L233)

```ts
export const parseFileDirectives = (
  path: string,
  source: string,
): Effect.Effect<ReadonlyArray<LocatedDirective>, ParseError> => /* ... */
```

**Guarantees:**
- "every emitted directive validates against the closed grammar before downstream consumption" — _trust-boundary; agents consume parsed directive bodies as context._

## Files

- `src/spec/directives/file-level.ts`
- `src/spec/directives/index.ts`
- `src/spec/directives/per-export.ts`
- `src/spec/directives/per-test.ts`
- `src/spec/directives/shared.ts`
- `src/spec/directives/tsdoc-bridge.ts`

## Properties

_No `itSpec` calls in test files._
