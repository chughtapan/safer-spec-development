# safer-spec-development

TypeScript codemod for per-folder `SPEC.md` files. It generates structured
specs from source, `@spec.*` JSDoc directives, Effect Schema declarations, and
fast-check property metadata. Validation gates check kind coverage,
classifier coverage, and precondition pass rate so committed specs stay aligned
with code and tests.
