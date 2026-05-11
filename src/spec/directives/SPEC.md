---
folder: src/spec/directives
format-version: 0.1.0
---

# SPEC

## Purpose

Directive grammar entry point. Walks TypeScript source via ts-morph and dispatches each parsed TSDoc block (via `tsdoc-bridge`) to its per-population parser. Returns the typed `LocatedDirective` stream.

The population modules (`file-level`, `per-export`, `per-test`) co-locate each directive's Schema with its parse function. The `tsdoc-bridge` module owns the TSDoc configuration and the byte-accurate body extraction.

## Public surface

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

### [`parseFileDirectives`](./index.ts#L225)

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
