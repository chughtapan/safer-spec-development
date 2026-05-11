# Design

`@chughtapan/safer-spec-development` is a TypeScript codemod for keeping
per-folder `SPEC.md` files synchronized with source code, JSDoc directives,
and property-test metadata.

The tool has two outputs:

- `SPEC.md` for human readers.
- `.safer-spec/<folder>.json` for tools and agents that need structured,
  sanitized context.

The core invariant is simple: source declarations describe the public surface,
test declarations describe the properties, and validation fails when the
generated artifacts drift from either source of truth.

## Goals

- Generate one `SPEC.md` for each source folder that exposes an `index.ts`.
- Keep behavioral contracts close to the export they describe through
  `@spec.*` JSDoc directives.
- Default every export to requiring all property types; opting out of a
  property type is explicit via `@spec.skip "<PropertyType>" reason: <why>`.
- Keep generated markdown deterministic so `validate` can compare committed
  output against regenerated output.
- Emit structured JSON so downstream agents do not need to scrape prose.

## Artifacts

### `SPEC.md`

The markdown file is the reader-facing artifact. It contains frontmatter and
canonical sections:

- `Purpose`: folder-level intent from `@spec.purpose`.
- `Public surface`: exported symbols, observed property types, skipped
  property types (with reasons), and residual contracts.
- `Files`: source and test files in the folder.
- `Properties`: property rows extracted from `itSpec.todo` and `itSpec.prop`
  call sites.
- `Architecture`: import policy and other repo rules when available.

Generated output uses LF endings, stable ordering, escaped directive bodies,
and deterministic formatting.

### Sidecar JSON

Every generated markdown file has a paired sidecar under `.safer-spec/`. The
sidecar is the tool-facing contract. It contains the format version, folder,
source references, observed and skipped property types, residual contracts,
coverage data, and thresholds.

The JSON schema lives in `src/spec/sidecar.ts`. Directive strings are
size-capped and escaped before they are emitted.

## Source Domains

The package is organized by knowledge ownership rather than by generic
technical layers.

| Domain | Folder | Owns |
|---|---|---|
| Commands | `commands/` | `safer-spec` binary entrypoint, the six @effect/cli Commands (`init`, `generate`, `validate`, `doctor`, `migrate`, `explain`), and the format-version constant. |
| Spec artifact | `spec/` | JSDoc directive grammar + parser, markdown emitter, frontmatter schema, sidecar JSON schema + writer, escape helpers, link resolver, and the `itSpec` authoring helper. |
| Terminals | `property-types/` | Closed `PropertyType` enum (9 OOPSLA-significant property types). |

Commands orchestrate the spec domain. The spec domain consumes the
property-type taxonomy.

## Directive Grammar

All directives live in JSDoc. Directive bodies are intentionally one-line and
size-capped.

File-level directives:

```ts
/**
 * @spec.purpose Identity RPC descriptors and schemas.
 */

/**
 * @spec.ignore
 */
```

Per-export directives:

```ts
/**
 * @spec.assume "channel.connect() completed before this call"
 *   reason: lifecycle ordering cannot be encoded in the parameter type.
 * @spec.guarantee "validates target format before any RPC call"
 *   reason: side-effect ordering is not captured by the return type.
 */
export const sendInvite = ...

/**
 * @spec.skip "Partial Roundtrip"
 *   reason: normalization intentionally discards whitespace.
 */
export const NormalizedName = ...

/**
 * @spec.residual-contract none
 *   reason: shape and refinements are captured by Effect Schema.
 */
export const Agent = ...
```

Per-test directives:

```ts
/**
 * @spec.property agent-roundtrip
 * @spec.type Roundtrip
 * @spec.exports Agent
 * @spec.claim encode(decode(agent)) preserves valid agents
 */
itSpec.todo("agent-roundtrip", {
  type: "Roundtrip",
  exports: [Agent],
});
```

`validate` cross-checks the JSDoc metadata against the runtime metadata passed
to `itSpec`.

## Property Types

`src/property-types/index.ts` defines the closed built-in property-type set:

| PropertyType | Typical use |
|---|---|
| `Roundtrip` | Encode/decode, serialize/parse, generate/readback. |
| `Partial Roundtrip` | Normalizing operations that preserve a subset. |
| `Commutative Paths` | Equivalent paths through an API. |
| `Constant Equality` | Known constants and fixed formatting. |
| `Constant Bounds Checking` | Numeric, length, or size bounds. |
| `Constant Non-Equality` | Values that must remain distinct. |
| `Typechecking` | Type-level or schema-shape assertions. |
| `Inclusion` | Membership, coverage, and containment. |
| `Exception Raising` | Rejection and failure-channel behavior. |

The built-in set is closed so generated artifacts are comparable across
folders. Repo-specific additions should be explicit configuration rather than
ad hoc strings in comments.

## Applicability

Every property type applies to every export by default. Opting out is
explicit per export via:

```ts
/**
 * @spec.skip "Roundtrip"
 *   reason: normalization intentionally discards whitespace.
 */
export const NormalizedName = ...
```

The codemod records observed property types (from `itSpec` calls), skipped
property types (from `@spec.skip` directives), and computes the gap as
`PROPERTY_TYPES \ (observed ∪ skipped)`. The gap drives the validation
gates below.

No built-in classification of exports into shapes. Per-shape prescriptions,
if a repo wants them, live in the author's `@spec.skip` reasons.

## Commands

| Command | Job |
|---|---|
| `safer-spec init [folder]` | Scaffold an initial `SPEC.md`, config, and property-test stub. |
| `safer-spec generate [--folder X] [--write|--dry-run] [--watch]` | Regenerate markdown and sidecar artifacts. |
| `safer-spec validate [--folder X] [--planned|--implemented]` | Regenerate in memory, diff artifacts, and assert gates. |
| `safer-spec doctor` | Check config, dependencies, sidecar layout, and format-version compatibility. |
| `safer-spec explain <error-code>` | Return the docs entry for a validation or lint diagnostic. |
| `safer-spec migrate` | Apply format-version transitions to specs and config. |

`--planned` validates metadata that can exist before property bodies are
implemented. `--implemented` also requires classifier and precondition data
from test execution sidecars.

## Validation Gates

`validate` reports typed errors so the CLI can route failures to stable exit
codes:

| Error | Exit | Meaning |
|---|---:|---|
| `MissingSpecPropertyError` | 11 | Committed `SPEC.md` or property table drifted from test metadata. |
| `MissingStubError` | 12 | A required `itSpec` call or its JSDoc directives are missing. |
| `MissingImplError` | 13 | A property is still a placeholder or has no meaningful body. |

Each diagnostic should include a problem, cause, concrete fix, and docs link.

Coverage gates:

- `property-type-coverage`: every property type in `PROPERTY_TYPES` is either
  covered by an `itSpec` call targeting the export or explicitly skipped via
  `@spec.skip "<PropertyType>" reason: <why>`.
- `classifier-coverage`: declared partitions from property tests are exercised
  above the configured threshold.
- `precondition-pass-rate`: generated samples should pass preconditions often
  enough to make the property meaningful.
- `branch-coverage-from-spec-tests`: diagnostic trend signal, not the primary
  quality gate.

## Link Resolution

Backticked symbols in generated prose are resolved through explicit resolvers:

- Local source declarations.
- Property test declarations.
- Cross-spec references inside the workspace.
- Known architecture-rule docs.
- External package docs when configured.

Internal unresolved references fail validation. External misses are allowed to
remain unresolved because they may depend on third-party packages.

## Trust Boundaries

JSDoc is user-controlled input. The codemod therefore treats directive bodies
as untrusted until they pass through the directive parser, length cap, and
surface-specific escaping.

Tools and agents should consume sidecar JSON rather than raw markdown because
the sidecar has a typed schema and bounded strings.

## Public API

The package facade exports only:

- `PROPERTY_TYPES` and `PropertyType`.
- `itSpec` and `ItSpec`.

The CLI owns command execution. Programmatic access to command internals
should use explicit subpath exports only when there is a real consumer
that needs them.
