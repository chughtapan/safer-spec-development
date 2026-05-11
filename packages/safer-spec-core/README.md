# @chughtapan/safer-spec-core

Shared types and schemas for [safer-spec-development](https://github.com/chughtapan/safer-spec-development).

- The closed `Kind` enum (9 OOPSLA-significant property kinds)
- The `SpecDirective` grammar (`@spec.purpose`, `@spec.skip`, `@spec.residual-contract`, `@spec.assume`, `@spec.guarantee`)
- The `SpecArtifact` schema (the `.safer-spec/<folder>.json` sidecar consumed by LLM agents)
- The `SPEC_FORMAT_VERSION` constant

Pure types and Effect Schema definitions; no runtime side effects. Consumed by `@chughtapan/safer-spec-development` (the codemod) and by ESLint rules in `@chughtapan/agent-code-guard`.

See [`../../docs/DESIGN.md`](../../docs/DESIGN.md) for the rationale.
