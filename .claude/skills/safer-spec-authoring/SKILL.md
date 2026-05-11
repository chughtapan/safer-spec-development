---
name: safer-spec-authoring
description: Use when applying safer-spec-development in any TypeScript repo to author source JSDoc directives, residual contracts, property metadata, planned or implemented itSpec tests, generated SPEC.md files, or sidecar artifacts for spec-driven development and generated-code workflows.
---

# safer-spec-authoring

## Core Point

`safer-spec-development` is a general-purpose spec-driven development package.
It is not a guide to this repository's folder layout.

Use it to make a TypeScript export answerable to an explicit contract before
or while code is written, including code written by an agent. A cold reader
should be able to read the generated `SPEC.md`, trace each claim to source or
test JSDoc, and know which property would fail if the implementation is wrong.

Do not assume the reader is an expert in property-based testing. Teach the
toolchain in this order: types define the valid domain, Effect Schema enforces
the domain at runtime, schema-derived arbitraries sample that domain, and
properties assert behavior over the samples.

The durable sources of truth are:

- Source JSDoc on exported declarations.
- Test JSDoc above `itSpec.todo` or `itSpec.prop`.
- Runtime metadata passed to `itSpec`.

`SPEC.md` and `.safer-spec/<folder>.json` are generated projections. Do not
hand-edit them to change the contract.

## Authoring Loop

1. Define the interface with TypeScript types plus Effect Schema refinements.
2. Derive or adapt a fast-check arbitrary from the schema so generated values
   satisfy the same refinements the code accepts.
3. Add only residual behavior in `@spec.*` JSDoc: assumptions, guarantees,
   side effects, failure channels, ordering, persistence, determinism,
   normalization, or trust-boundary behavior.
4. For each built-in `PropertyType`, add a property or an explicit
   `@spec.skip "<PropertyType>" reason: <why>`.
5. Use `itSpec.todo` when the property is planned and `itSpec.prop` when the
   property has real arbitraries and assertions.
6. Generate artifacts, then validate the level of evidence you have.

This is the habit to preserve: do not write the spec after the implementation
as documentation. Write enough contract and property metadata that an
implementation can be generated or reviewed against it.

## Sources Of Truth

| Need | Put it here |
|---|---|
| Folder purpose | `@spec.purpose` on the folder barrel or public entry file. |
| Residual export behavior | `@spec.assume`, `@spec.guarantee`, or `@spec.residual-contract` on the exported declaration. |
| No residual behavior | `@spec.residual-contract none` with a concrete `reason:`. |
| Property identity | `@spec.property` above the matching `itSpec` call. |
| Property category | `@spec.type <PropertyType>` and `type: "<PropertyType>"`. |
| Targeted exports | `@spec.exports Name` and `exports: [Name]` using value references. |
| Property claim | `@spec.claim` as a falsifiable one-line behavior statement. |
| Intentional opt-out | `@spec.skip "<PropertyType>" reason: <why>` on the export. |
| Human summary | Generated `SPEC.md`. |
| Tool summary | Generated `.safer-spec/<folder>.json`. |

## Export Contracts

Start with the typed boundary. In this toolchain, Effect Schema and refinements
describe the valid input space. The generated arbitrary should come from the
same boundary, not from a looser `fc.string()` or `fc.anything()` unless the
property is intentionally testing unknown input.

Use your repo's schema-to-fast-check adapter when one exists. The adapter name
is project-local; the important contract is that it samples values accepted by
the schema and preserves shrinking.

```ts
const UserIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64));

export const UserSchema = Schema.Struct({
  id: UserIdSchema,
  displayName: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80)),
});

export type User = Schema.Schema.Type<typeof UserSchema>;

const userArbitrary = arbitraryFromSchema(UserSchema);
```

After the schema covers shape and refinements, write JSDoc only for behavior
that remains outside the type boundary:

```ts
/**
 * @spec.guarantee "storage keys preserve the exact refined user id"
 *   reason: the string format is an interop contract, not part of the User type.
 * @spec.residual-contract "key format is stable across releases"
 *   reason: persisted callers may store the key outside this process.
 */
export const toUserStorageKey = (user: User): string => `user:${user.id}`;
```

If TypeScript plus Effect Schema captures the whole contract, say so
explicitly with `@spec.residual-contract none` and a reason.

## Property Metadata

A property is not "a test with a random value." It has three parts:

- An arbitrary: how to generate samples from the valid domain.
- Optional preconditions: which samples are meaningful for this property.
- A predicate: what must be true for every generated sample.

The `PropertyType` names are prompts for choosing the predicate. They are not
TypeScript types.

In `safer-spec-development`, the JSDoc and runtime metadata must agree:

```ts
/**
 * @spec.property user-storage-key-roundtrip
 * @spec.type Roundtrip
 * @spec.exports toUserStorageKey parseUserStorageKey UserSchema
 * @spec.claim parsing a storage key produced from a valid User returns that User id
 */
itSpec.todo("user-storage-key-roundtrip", {
  type: "Roundtrip",
  exports: [toUserStorageKey, parseUserStorageKey, UserSchema],
});
```

When implemented, the arbitrary should sample the refined schema domain and the
body should fail for a wrong implementation:

```ts
/**
 * @spec.property user-storage-key-roundtrip
 * @spec.type Roundtrip
 * @spec.exports toUserStorageKey parseUserStorageKey UserSchema
 * @spec.claim parsing a storage key produced from a valid User returns that User id
 */
itSpec.prop(
  "user-storage-key-roundtrip",
  {
    type: "Roundtrip",
    exports: [toUserStorageKey, parseUserStorageKey, UserSchema],
  },
  userArbitrary,
  (user) => {
    expect(parseUserStorageKey(toUserStorageKey(user))).toEqual(user.id);
  },
);
```

`Exception Raising` still matters, especially at unknown-input boundaries. Do
not let it become the default example for every schema. Valid-domain properties
usually say more about the implementation than "invalid input reaches the error
channel."

## PropertyType Prompts

Treat the closed `PropertyType` set as prompts for finding a falsifiable
contract. Every type applies by default until the export proves otherwise with
a specific skip reason.

| PropertyType | Ask before writing or skipping |
|---|---|
| `Roundtrip` | If a valid value is encoded, keyed, rendered, parsed, read back, or re-imported, what must survive exactly? |
| `Partial Roundtrip` | If normalization loses information, what schema-backed subset must still survive? |
| `Commutative Paths` | Are two valid paths through the API required to produce equivalent results? |
| `Constant Equality` | Which exact values, formats, tags, or exit codes must never drift? |
| `Constant Bounds Checking` | Which schema/refinement bounds, lengths, sizes, retries, or partitions must always hold? |
| `Constant Non-Equality` | Which states, tags, keys, or sentinel values must stay distinct? |
| `Typechecking` | What schema-derived, generated, inferred, or emitted shape must match the declared type? |
| `Inclusion` | What required item, case, partition, export, or generated row must be present? |
| `Exception Raising` | Which invalid inputs must fail, and on which failure path? |

Good properties are not examples with random inputs. A wrong but plausible
implementation should falsify them.

## Arbitrary Discipline

Prefer this order:

1. Generate valid values from the Effect Schema or refinement-backed interface.
2. Use preconditions only for relationships that cannot be encoded into the
   schema-derived arbitrary.
3. Classify meaningful partitions so validation can tell whether generated
   samples exercised edge cases.
4. Generate invalid values only for `Exception Raising` or trust-boundary
   tests, usually by starting from valid values and corrupting one field.

Avoid hand-written arbitraries that are broader than the type. If the property
takes `User`, but the arbitrary can generate empty ids that `UserSchema`
rejects, the property is testing a different contract than the export exposes.

## Skips

Default-all coverage is a design discipline. Missing property types are not
silently ignored.

```ts
/**
 * @spec.skip "Roundtrip"
 *   reason: the parser intentionally discards comments and original whitespace.
 */
export const parseConfig = ...
```

A skip reason must explain why the property type is not meaningful for this
export, not why nobody wrote the test yet. Use `itSpec.todo` for planned work.

## Generated-Code Workflow

When using safer-spec to guide generated code:

1. Give the agent the generated `SPEC.md` or sidecar as compact context.
2. Require the agent to read the source and test JSDoc for touched exports.
3. Ask for implementation that satisfies the residual contracts and property
   claims.
4. If the generated code needs behavior not covered by the spec, edit the
   directives or property metadata first.
5. Review the implementation by asking which property would fail if the code
   were wrong.

Do not patch around ambiguous generated code with undocumented behavior. Make
the contract explicit, then implement.

## Commands

Use the narrowest gate that matches the current evidence:

```bash
pnpm safer-spec generate --write
pnpm safer-spec validate --planned
pnpm safer-spec validate --implemented
```

`validate --planned` accepts property metadata and todos. `validate
--implemented` requires real property bodies plus classifier and precondition
sidecar data.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing repo-history, PR history, or chat context in directives | State the present contract only. |
| Hand-editing generated `SPEC.md` or sidecar JSON | Edit source/test JSDoc and regenerate. |
| Restating TypeScript signatures in `@spec.guarantee` | Put only residual behavior in directives. |
| Passing string names in `itSpec` metadata | Use value references: `exports: [toUserStorageKey]`. |
| Skipping with "not applicable" only | Explain the semantic reason the property type cannot apply. |
| Leaving `itSpec.prop` empty or assertion-free | Use `itSpec.todo` or implement a falsifiable property. |
| Treating example tests as property evidence | Add arbitraries, preconditions, and a predicate over generated inputs. |

## Exit Codes

| Error | Exit | Meaning |
|---|---:|---|
| `MissingSpecPropertyError` | 11 | Generated properties drifted from test metadata, or metadata mismatches runtime args. |
| `MissingStubError` | 12 | A required `itSpec` call or its JSDoc is missing. |
| `MissingImplError` | 13 | Implemented validation found a todo or empty property body. |

Use these codes to decide whether to regenerate artifacts, add metadata, add
stubs, or finish the property implementation.
