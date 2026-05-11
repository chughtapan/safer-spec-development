/**
 * @spec.purpose Closed taxonomy that defines what properties this codemod
 *   covers. Three pieces of vocabulary, all related to "what kinds of
 *   property tests apply to what kinds of source exports":
 *
 *     1. `PropertyType` — the 9 OOPSLA-significant property assertion types
 *        (Roundtrip, Inclusion, Exception Raising, …). The HOW: the way a
 *        property test asserts against an export.
 *     2. `ExportShape` — the 6 structural shapes a TypeScript export can
 *        take (Schema, RpcDefinition, function, type, Branded, unknown).
 *        The WHAT: the shape of the source artifact under test.
 *     3. `APPLICABILITY_MATRIX` — the cross-product: per ExportShape, the
 *        set of property types that MUST appear on the export's coverage
 *        (unless `@spec.skip`-ed with reason).
 *
 *   Terminal domain — no upward dependencies. `source/` consumes
 *   `ExportShape` (its detector outputs it) and `APPLICABILITY_MATRIX` (its
 *   resolver applies it). `spec/` and `sidecar/` consume `PropertyType`
 *   (their schemas embed it as `Schema.Literal(...PROPERTY_TYPES)`).
 *
 *   `PropertyType` membership: Ravi & Coblenz, OOPSLA 2025 (12 categories),
 *   filtered to the 9 statistically significant ones. Dropped:
 *   Generated-Expression Bounds Checking (p=0.0627), Generated-Expression
 *   Non-Equality (p=0.3299), Constant Inclusion (p=0.8969).
 *
 *   Per-repo extension via `safer-spec.config.ts`
 *   `propertyTypesExtension: PropertyType[]`.
 */

/**
 * @spec.guarantee "membership order is stable across versions; the index of each property type is part of the contract"
 *   reason: per-repo `propertyTypesExtension` appends only; never reorders.
 * @spec.residual-contract none
 *   reason: shape captured by `as const` tuple.
 */
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

export type PropertyType = (typeof PROPERTY_TYPES)[number];

// Intentionally no `isPropertyType` predicate. Validation crosses a boundary,
// so the boundary uses the Schema directly:
//   `Schema.decodeUnknown(Schema.Literal(...PROPERTY_TYPES))`.
// A standalone predicate is easy to forget at trust boundaries. Callers
// outside this domain decode via the consuming Schema (for example,
// spec/directives.ts's PropertyTypeDirectiveSchema or sidecar/schema.ts's
// SpecExportEntry.requiredPropertyTypes).

export type ExportShape =
  | "Schema"
  | "RpcDefinition"
  | "function"
  | "type"
  | "Branded"
  | "unknown";

interface ApplicabilityRow {
  readonly shape: ExportShape;
  readonly requiredPropertyTypes: ReadonlyArray<PropertyType>;
  readonly conditionalPropertyTypes: ReadonlyArray<{
    readonly propertyType: PropertyType;
    readonly when: "result-is-collection";
  }>;
}

/**
 * @spec.guarantee "matrix membership is closed; every ExportShape has exactly one row"
 *   reason: contract; missing rows would silently skip property-type
 *           coverage checks for that shape.
 * @spec.residual-contract "conditional property types fire only when the named condition (`result-is-collection`) holds; runtime decision is the validate gate's"
 *   reason: behavioral residue not captured in the static row data.
 */
export const APPLICABILITY_MATRIX: ReadonlyArray<ApplicabilityRow> = [
  {
    shape: "Schema",
    requiredPropertyTypes: ["Roundtrip", "Exception Raising", "Typechecking"],
    conditionalPropertyTypes: [],
  },
  {
    shape: "RpcDefinition",
    requiredPropertyTypes: ["Roundtrip", "Exception Raising"],
    conditionalPropertyTypes: [
      { propertyType: "Inclusion", when: "result-is-collection" },
    ],
  },
  {
    shape: "function",
    requiredPropertyTypes: [],
    conditionalPropertyTypes: [],
  },
  {
    shape: "type",
    requiredPropertyTypes: ["Typechecking"],
    conditionalPropertyTypes: [],
  },
  {
    shape: "Branded",
    requiredPropertyTypes: [],
    conditionalPropertyTypes: [],
  },
  {
    shape: "unknown",
    requiredPropertyTypes: [],
    conditionalPropertyTypes: [],
  },
];
