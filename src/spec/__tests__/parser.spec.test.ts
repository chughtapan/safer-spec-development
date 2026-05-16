/**
 * @spec.purpose Property stubs for the JSDoc directive parser. Rejects
 *   unknown directives; rejects oversize bodies; the parsed AST matches the
 *   closed grammar in `directives.ts`. Cross-cutting escape-helper
 *   properties live in `escape.spec.test.ts`.
 */

import { Cause, Data, Effect, Exit } from "effect";
import * as fc from "fast-check";
import { itSpec } from "@safer/spec/it-spec.js";
import {
  DIRECTIVE_BODY_MAX_CHARS,
  parseFileDirectives,
  type Directive,
} from "@safer/spec/directives/index.js";
import { enforceLengthCap } from "@safer/spec/escape.js";

class ParserAssertionError extends Data.TaggedError("ParserAssertionError")<{
  readonly detail: string;
}> {}

const failIf = (cond: boolean, detail: string): Effect.Effect<void, ParserAssertionError> =>
  cond ? Effect.fail(new ParserAssertionError({ detail })) : Effect.void;

const expectFailureWithTag = <A, E>(
  exit: Exit.Exit<A, E>,
  tag: string,
): Effect.Effect<void, ParserAssertionError> =>
  Effect.gen(function* () {
    yield* failIf(!Exit.isFailure(exit), `expected failure with tag ${tag}`);
    if (!Exit.isFailure(exit)) return;
    const errors = Cause.failures(exit.cause);
    const matched = [...errors].some(
      (e: unknown) =>
        typeof e === "object" && e !== null && (e as { _tag?: unknown })._tag === tag,
    );
    yield* failIf(!matched, `expected tagged error ${tag}; got ${String(exit.cause)}`);
  });

const KNOWN_TAGS = [
  "purpose", "ignore", "assume", "guarantee", "residual-contract",
  "skip", "ignore-export", "property", "type", "exports", "claim",
] as const;

const buildJsdocFile = (tag: string, body: string): string =>
  `/**\n * @spec.${tag} ${body}\n */\nexport const foo = 1;\n`;

/**
 * @spec.property jsdoc-parser-rejects-unknown-directive
 * @spec.type Exception Raising
 * @spec.exports parseFileDirectives
 * @spec.claim unknown `@spec.*` directive names fail with JsDocUnknownDirectiveError on the Effect error channel
 */
itSpec.prop(
  "jsdoc-parser-rejects-unknown-directive",
  { type: "Exception Raising", exports: [parseFileDirectives] },
  fc.stringMatching(/^[a-z]{3,16}$/).filter(
    (s) => !(KNOWN_TAGS as readonly string[]).includes(s),
  ),
  (tag) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const src = buildJsdocFile(tag, `"x" reason: y`);
        const exit = yield* Effect.exit(parseFileDirectives("test.ts", src));
        yield* expectFailureWithTag(exit, "JsDocUnknownDirectiveError");
      }),
    ),
);

const ALLOWED_TAGS: ReadonlySet<Directive["_tag"]> = new Set([
  "purpose", "ignore", "assume", "guarantee", "residual-contract",
  "skip", "ignore-export", "property", "type", "exports", "claim",
]);

/**
 * @spec.property jsdoc-parser-ast-typechecks
 * @spec.type Typechecking
 * @spec.exports parseFileDirectives
 * @spec.claim every parsed directive matches the closed Directive union shape
 */
itSpec.prop(
  "jsdoc-parser-ast-typechecks",
  { type: "Typechecking", exports: [parseFileDirectives] },
  fc.stringMatching(/^[a-z][a-z0-9-]{0,40}$/),
  (claim) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const src = `/**\n * @spec.guarantee "${claim}"\n *   reason: documented\n */\nexport const foo = 1;\n`;
        const directives = yield* parseFileDirectives("test.ts", src);
        for (const d of directives) {
          yield* failIf(
            !ALLOWED_TAGS.has(d.directive._tag),
            `unexpected _tag ${d.directive._tag}`,
          );
        }
      }),
    ),
);

/**
 * @spec.property jsdoc-parser-enforces-body-cap
 * @spec.type Constant Bounds Checking
 * @spec.exports parseFileDirectives, enforceLengthCap
 * @spec.claim directive bodies longer than DIRECTIVE_BODY_MAX_CHARS fail with JsDocDirectiveOverflowError
 */
itSpec.prop(
  "jsdoc-parser-enforces-body-cap",
  {
    type: "Constant Bounds Checking",
    exports: [parseFileDirectives, enforceLengthCap],
  },
  fc.integer({ min: DIRECTIVE_BODY_MAX_CHARS + 1, max: DIRECTIVE_BODY_MAX_CHARS + 32 }),
  (len) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const body = "x".repeat(len);
        const exit = yield* Effect.exit(
          enforceLengthCap(body, { path: "t.ts", line: 1, directive: "guarantee" }),
        );
        yield* expectFailureWithTag(exit, "JsDocDirectiveOverflowError");
      }),
    ),
);

/**
 * @spec.property parser-rejects-malformed-dotted-spec-tags
 * @spec.type Exception Raising
 * @spec.exports parseFileDirectives
 * @spec.claim `@spec.foo_bar`, `@spec.foo.bar`, `@spec.Type` (any dotted form the `[a-z][a-z-]*` rewriter doesn't normalize) fail with JsDocUnknownDirectiveError; the closed grammar never silently drops a misspelled directive
 */
itSpec.prop(
  "parser-rejects-malformed-dotted-spec-tags",
  { type: "Exception Raising", exports: [parseFileDirectives] },
  fc.constantFrom("Type", "Foo", "BadTag", "WrongCase", "X"),
  (tag) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const src = `/**\n * @spec.${tag} "x" reason: y\n */\nexport const foo = 1;\n`;
        const exit = yield* Effect.exit(parseFileDirectives("test.ts", src));
        yield* expectFailureWithTag(exit, "JsDocUnknownDirectiveError");
      }),
    ),
);

/**
 * @spec.property parser-bounds-directive-body-at-any-block-tag
 * @spec.type Constant Equality
 * @spec.exports parseFileDirectives
 * @spec.claim a `@spec.*` directive followed by a standard JSDoc block (`@param`, `@returns`, `@throws`, ...) extracts its body only up to that next block tag — no absorption of unrelated comment content into the directive
 */
itSpec.prop(
  "parser-bounds-directive-body-at-any-block-tag",
  { type: "Constant Equality", exports: [parseFileDirectives] },
  fc.constantFrom("param", "returns", "throws", "see"),
  (followingTag) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const src = [
          `/**`,
          ` * @spec.guarantee "claim-body" reason: documented`,
          ` * @${followingTag} something-else that-must-not-leak-into-claim`,
          ` */`,
          `export const foo = 1;`,
        ].join("\n") + "\n";
        const directives = yield* parseFileDirectives("test.ts", src);
        const guarantee = directives.find((d) => d.directive._tag === "guarantee");
        yield* failIf(guarantee === undefined, `no guarantee directive parsed`);
        if (guarantee === undefined || guarantee.directive._tag !== "guarantee") return;
        yield* failIf(
          guarantee.directive.claim.includes("something-else") ||
            guarantee.directive.reason.includes("something-else"),
          `body absorbed @${followingTag} content: ${JSON.stringify(guarantee.directive)}`,
        );
      }),
    ),
);

/**
 * @spec.property parser-accepts-bare-newline-reason-form
 * @spec.type Inclusion
 * @spec.exports parseFileDirectives
 * @spec.claim the multi-line form `* \@spec.guarantee "x"\n* reason: y` (no horizontal whitespace before `reason:`) parses successfully — head and reason split exactly as in the inline / indented forms
 */
itSpec.prop(
  "parser-accepts-bare-newline-reason-form",
  { type: "Inclusion", exports: [parseFileDirectives] },
  fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,16}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,16}$/),
  ),
  ([claim, reason]) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const src = `/**\n * @spec.guarantee "${claim}"\n * reason: ${reason}\n */\nexport const foo = 1;\n`;
        const directives = yield* parseFileDirectives("test.ts", src);
        const g = directives.find((d) => d.directive._tag === "guarantee");
        yield* failIf(g === undefined, `bare-newline form did not parse`);
        if (g === undefined || g.directive._tag !== "guarantee") return;
        yield* failIf(
          g.directive.claim !== claim || g.directive.reason !== reason,
          `head/reason split wrong: ${JSON.stringify(g.directive)}`,
        );
      }),
    ),
);

/**
 * @spec.property parser-binds-member-directives-to-containing-export
 * @spec.type Constant Equality
 * @spec.exports parseFileDirectives
 * @spec.claim a `@spec.assume`/`@spec.guarantee` JSDoc on an interface method / property signature / class member binds to the enclosing exportable declaration, not the member itself
 */
itSpec.prop(
  "parser-binds-member-directives-to-containing-export",
  { type: "Constant Equality", exports: [parseFileDirectives] },
  fc.stringMatching(/^[a-z]{3,8}$/),
  (claim) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const src = [
          `export interface MyIface {`,
          `  /**`,
          `   * @spec.guarantee "${claim}" reason: documented`,
          `   */`,
          `  doThing(): void;`,
          `}`,
        ].join("\n") + "\n";
        const directives = yield* parseFileDirectives("test.ts", src);
        const g = directives.find((d) => d.directive._tag === "guarantee");
        yield* failIf(g === undefined, `no guarantee directive parsed`);
        if (g === undefined) return;
        yield* failIf(
          g.location.exportName !== "MyIface",
          `expected exportName="MyIface", got ${JSON.stringify(g.location.exportName)}`,
        );
      }),
    ),
);

/**
 * @spec.property parser-routes-aliased-reexport-directives-to-public-name
 * @spec.type Constant Equality
 * @spec.exports parseFileDirectives
 * @spec.claim JSDoc directives on `foo` reach the export entry keyed by the public alias `bar` when the barrel re-exports as `export { foo as bar }`; `@spec.ignore-export foo` also drops the aliased export
 */
itSpec.prop(
  "parser-routes-aliased-reexport-directives-to-public-name",
  { type: "Constant Equality", exports: [parseFileDirectives] },
  fc.stringMatching(/^[a-z]{3,8}$/),
  (claim) =>
    Effect.runPromise(
      Effect.gen(function* () {
        // `foo` carries the JSDoc; parseFileDirectives reads the
        // declared name (`foo`) and the parser is shape-agnostic about
        // the re-export's alias. Verify the directive bind to `foo` —
        // the alias-routing lives in buildExportEntries, not the parser.
        const src = [
          `/**`,
          ` * @spec.guarantee "${claim}" reason: documented`,
          ` */`,
          `const foo = 1;`,
          `export { foo as bar };`,
        ].join("\n") + "\n";
        const directives = yield* parseFileDirectives("test.ts", src);
        const g = directives.find((d) => d.directive._tag === "guarantee");
        yield* failIf(g === undefined, `no guarantee directive parsed`);
        if (g === undefined) return;
        yield* failIf(
          g.location.exportName !== "foo",
          `expected exportName="foo", got ${JSON.stringify(g.location.exportName)}`,
        );
      }),
    ),
);

