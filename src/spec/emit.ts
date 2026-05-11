/**
 * @spec.purpose Canonical SPEC.md serializer + `SpecArtifact` builder. Emits
 *   the `SpecFrontmatter`-shaped block and the typed sidecar value from a
 *   `FolderAnalysis` + `SpecMeta`. Canonical form: LF endings, lex-sort for
 *   file lists, source-order for exports; re-emission is byte-identical.
 */

import { PROPERTY_TYPES, type PropertyType } from "@safer/property-types/index.js";
import { SPEC_FORMAT_VERSION } from "@safer/commands/version.js";
import {
  escapeForMarkdownProse,
  escapeForMarkdownTableCell,
} from "@safer/spec/escape.js";
import { relativeToFolder } from "@safer/spec/link-resolver.js";
import type { SpecArtifact } from "@safer/spec/sidecar.js";

interface ResidualEntry {
  readonly claim: string;
  readonly reason: string;
}

type ResidualContract =
  | { readonly _tag: "none"; readonly reason: string }
  | { readonly _tag: "some"; readonly body: string; readonly reason: string };

export type ExportKind =
  | "const"
  | "function"
  | "type"
  | "interface"
  | "class"
  | "enum"
  | "other";

export interface ExportEntry {
  readonly name: string;
  readonly kind: ExportKind;
  readonly signature: string;
  readonly description: string;
  readonly sourceRef: { readonly path: string; readonly line: number };
  readonly assumes: ReadonlyArray<ResidualEntry>;
  readonly guarantees: ReadonlyArray<ResidualEntry>;
  readonly residualContract: ResidualContract | null;
  readonly skipped: ReadonlyArray<{
    readonly propertyType: PropertyType;
    readonly reason: string;
  }>;
}

export interface PropertyRow {
  readonly id: string;
  readonly propertyType: PropertyType;
  readonly exports: ReadonlyArray<string>;
  readonly claim: string;
  readonly sourceRef: { readonly path: string; readonly line: number };
  readonly stubbed: boolean;
}

export interface FolderAnalysis {
  readonly folder: string;
  readonly purpose: string | null;
  readonly exports: ReadonlyArray<ExportEntry>;
  readonly properties: ReadonlyArray<PropertyRow>;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly testFiles: ReadonlyArray<string>;
}

const emitResidualList = (
  label: string,
  items: ReadonlyArray<ResidualEntry>,
): ReadonlyArray<string> => {
  if (items.length === 0) return [];
  const lines: string[] = ["", `**${label}:**`];
  for (const x of items) {
    lines.push(
      `- "${escapeForMarkdownProse(x.claim)}" — _${escapeForMarkdownProse(x.reason)}_`,
    );
  }
  return lines;
};

const emitResidualContract = (
  rc: ResidualContract | null,
): ReadonlyArray<string> => {
  if (rc === null) return [];
  if (rc._tag === "none") {
    return ["", `**Residual contract:** none — _${escapeForMarkdownProse(rc.reason)}_`];
  }
  return [
    "",
    `**Residual contract:** "${escapeForMarkdownProse(rc.body)}" — _${escapeForMarkdownProse(rc.reason)}_`,
  ];
};

const emitSkipped = (
  skipped: ExportEntry["skipped"],
): ReadonlyArray<string> => {
  if (skipped.length === 0) return [];
  const lines: string[] = ["", "**Skipped property types:**"];
  for (const s of skipped) {
    lines.push(`- \`${s.propertyType}\` — _${escapeForMarkdownProse(s.reason)}_`);
  }
  return lines;
};

/**
 * Compute a relative anchor link from the SPEC.md (at `<folder>/SPEC.md`)
 * to the declaration's source file + line. `#Lnnn` is GitHub/IDE-style.
 */
const sourceLink = (folder: string, path: string, line: number): string =>
  `${relativeToFolder(folder, path)}#L${String(line)}`;

const emitSignatureBlock = (e: ExportEntry): ReadonlyArray<string> => {
  if (e.signature.length === 0) return [];
  return ["", "```ts", e.signature, "```"];
};

const emitDescription = (e: ExportEntry): ReadonlyArray<string> => {
  if (e.description.length === 0) return [];
  return ["", e.description];
};

const emitExportSection = (
  folder: string,
  e: ExportEntry,
): ReadonlyArray<string> => [
  `### [\`${e.name}\`](${sourceLink(folder, e.sourceRef.path, e.sourceRef.line)})`,
  ...emitSignatureBlock(e),
  ...emitDescription(e),
  ...emitResidualList("Assumes", e.assumes),
  ...emitResidualList("Guarantees", e.guarantees),
  ...emitResidualContract(e.residualContract),
  ...emitSkipped(e.skipped),
  "",
];

const emitPropertiesTable = (
  properties: ReadonlyArray<PropertyRow>,
): ReadonlyArray<string> => {
  if (properties.length === 0) return ["_No `itSpec` calls in test files._"];
  const lines: string[] = [
    "| Property | Type | Exports | Claim | Status |",
    "|---|---|---|---|---|",
  ];
  for (const p of properties) {
    const id = escapeForMarkdownTableCell(p.id);
    const exports = p.exports
      .map((s) => "`" + escapeForMarkdownTableCell(s) + "`")
      .join(", ");
    const status = p.stubbed ? "todo" : "implemented";
    const claim = escapeForMarkdownTableCell(p.claim);
    lines.push(
      `| \`${id}\` | \`${p.propertyType}\` | ${exports} | ${claim} | ${status} |`,
    );
  }
  return lines;
};

export interface SpecMeta {
  readonly generatedAtSha: string;
  readonly coverage: {
    readonly typeCoverage: number;
    readonly classifierCoverage: number | null;
    readonly preconditionPassRate: number | null;
    readonly branchCoverageFromSpecTests: number | null;
  };
  readonly thresholds: {
    readonly typeCoverage: number;
    readonly classifierCoverage: number;
    readonly preconditionPassRate: number;
  };
  readonly generatedFrom: {
    readonly jsdoc: string;
    readonly exports: string;
    readonly schemas: ReadonlyArray<string>;
    readonly properties: ReadonlyArray<string>;
    readonly eslint: string;
  };
}

const yamlScalar = (v: number | null): string => {
  if (v === null) return "null";
  return String(v);
};

const emitFrontmatter = (a: FolderAnalysis, meta: SpecMeta): ReadonlyArray<string> => [
  "---",
  `folder: ${a.folder}`,
  `format-version: ${SPEC_FORMAT_VERSION}`,
  `generatedAtSha: ${meta.generatedAtSha}`,
  "generatedFrom:",
  `  jsdoc: ${meta.generatedFrom.jsdoc}`,
  `  exports: ${meta.generatedFrom.exports}`,
  meta.generatedFrom.schemas.length === 0
    ? "  schemas: []"
    : "  schemas:",
  ...meta.generatedFrom.schemas.map((s) => `    - ${s}`),
  meta.generatedFrom.properties.length === 0
    ? "  properties: []"
    : "  properties:",
  ...meta.generatedFrom.properties.map((s) => `    - ${s}`),
  `  eslint: ${meta.generatedFrom.eslint}`,
  "coverage:",
  `  typeCoverage: ${String(meta.coverage.typeCoverage)}`,
  `  classifierCoverage: ${yamlScalar(meta.coverage.classifierCoverage)}`,
  `  preconditionPassRate: ${yamlScalar(meta.coverage.preconditionPassRate)}`,
  `  branchCoverageFromSpecTests: ${yamlScalar(meta.coverage.branchCoverageFromSpecTests)}`,
  "thresholds:",
  `  typeCoverage: ${String(meta.thresholds.typeCoverage)}`,
  `  classifierCoverage: ${String(meta.thresholds.classifierCoverage)}`,
  `  preconditionPassRate: ${String(meta.thresholds.preconditionPassRate)}`,
  "---",
];

/**
 * @spec.guarantee "two calls with the same `analysis` + `meta` produce byte-identical markdown; frontmatter decodes through `decodeSpecFrontmatter`"
 *   reason: roundtrip contract on the emit step.
 * @spec.residual-contract "internal section ordering is fixed: Purpose → Public Surface → Files → Properties"
 *   reason: behavioral contract beyond the FolderAnalysis shape.
 */
export const emitMarkdown = (a: FolderAnalysis, meta: SpecMeta): string => {
  const lines: string[] = [
    ...emitFrontmatter(a, meta),
    "",
    "# SPEC",
    "",
    "## Purpose",
    "",
    a.purpose ?? "_No `@spec.purpose` directive found._",
    "",
    "## Public surface",
    "",
  ];
  if (a.exports.length === 0) lines.push("_No exports._");
  else for (const e of a.exports) lines.push(...emitExportSection(a.folder, e));
  lines.push("## Files", "");
  const allFiles = [...a.sourceFiles, ...a.testFiles].sort();
  if (allFiles.length === 0) lines.push("_No files._");
  else for (const f of allFiles) lines.push(`- \`${f}\``);
  lines.push("", "## Properties", "", ...emitPropertiesTable(a.properties), "");
  return lines.join("\n");
};

type Shape = "Schema" | "RpcDefinition" | "function" | "type" | "Branded" | "unknown";

const SHAPE_BY_KIND: Readonly<Record<ExportKind, Shape>> = {
  function: "function",
  type: "type",
  interface: "type",
  class: "type",
  enum: "unknown",
  const: "unknown",
  other: "unknown",
};

const skippedPropertyTypes = (e: ExportEntry): ReadonlySet<PropertyType> =>
  new Set(e.skipped.map((s) => s.propertyType));

const observedPropertyTypesFor = (
  exportName: string,
  properties: ReadonlyArray<PropertyRow>,
): ReadonlyArray<PropertyType> => {
  const seen = new Set<PropertyType>();
  for (const p of properties) {
    if (p.exports.includes(exportName)) seen.add(p.propertyType);
  }
  return [...seen];
};

const requiredPropertyTypesFor = (e: ExportEntry): ReadonlyArray<PropertyType> => {
  const skipped = skippedPropertyTypes(e);
  return PROPERTY_TYPES.filter((pt) => !skipped.has(pt));
};

/**
 * @spec.guarantee "returned `SpecArtifact` decodes through `decodeSpecArtifact` without error"
 *   reason: sidecar contract; downstream agents consume this shape.
 * @spec.residual-contract "fields the codemod cannot yet compute (e.g. per-export sourceRef.sha) reuse `meta.generatedAtSha` as the closest stable identifier"
 *   reason: per-line blame would require a separate git pass; the run-level
 *           SHA is a sound default for now.
 */
export const buildSpecArtifact = (
  a: FolderAnalysis,
  meta: SpecMeta,
): SpecArtifact => ({
  formatVersion: SPEC_FORMAT_VERSION,
  folder: a.folder,
  generatedAtSha: meta.generatedAtSha,
  exports: a.exports.map((e) => ({
    name: e.name,
    shape: SHAPE_BY_KIND[e.kind],
    requiredPropertyTypes: requiredPropertyTypesFor(e),
    observedPropertyTypes: observedPropertyTypesFor(e.name, a.properties),
    residualAssumes: e.assumes.map((r) => ({ claim: r.claim, reason: r.reason })),
    residualGuarantees: e.guarantees.map((r) => ({ claim: r.claim, reason: r.reason })),
    sourceRef: {
      path: e.sourceRef.path,
      line: e.sourceRef.line,
      sha: meta.generatedAtSha,
    },
  })),
  coverage: {
    typeCoverage: meta.coverage.typeCoverage,
    ...(meta.coverage.classifierCoverage !== null
      ? { classifierCoverage: meta.coverage.classifierCoverage }
      : {}),
    ...(meta.coverage.preconditionPassRate !== null
      ? { preconditionPassRate: meta.coverage.preconditionPassRate }
      : {}),
    ...(meta.coverage.branchCoverageFromSpecTests !== null
      ? { branchCoverageFromSpecTests: meta.coverage.branchCoverageFromSpecTests }
      : {}),
  },
  thresholds: meta.thresholds,
});

/**
 * @spec.guarantee "type coverage = (observed ∪ skipped) / |PROPERTY_TYPES| averaged across exports; returns 1.0 when there are no exports"
 *   reason: design-doc gate definition; validate compares against thresholds.typeCoverage.
 * @spec.residual-contract "classifier coverage and precondition pass rate are null in `--planned` mode (no test execution sidecars)"
 *   reason: lifecycle contract; populated only by `validate --implemented`.
 */
export const computeTypeCoverage = (a: FolderAnalysis): number => {
  if (a.exports.length === 0) return 1;
  const total = PROPERTY_TYPES.length;
  let sum = 0;
  for (const e of a.exports) {
    const skipped = skippedPropertyTypes(e);
    const observed = new Set(observedPropertyTypesFor(e.name, a.properties));
    const covered = new Set<PropertyType>([...skipped, ...observed]);
    sum += covered.size / total;
  }
  return sum / a.exports.length;
};

/**
 * @spec.guarantee "returns the property types that are required by at least one export but observed by no test row across the folder; sorted in PROPERTY_TYPES tuple order"
 *   reason: validate's typeCoverage diagnostic needs the missing-type list to
 *           route remediation; PROPERTY_TYPES order is the stable contract.
 * @spec.residual-contract "property types explicitly skipped on every export that would otherwise require them are not listed; skipped == covered for gating purposes"
 *   reason: skipped is a deliberate opt-out and counts toward coverage.
 */
export const findMissingPropertyTypes = (
  a: FolderAnalysis,
): ReadonlyArray<PropertyType> => {
  const required = new Set<PropertyType>();
  const observed = new Set<PropertyType>();
  for (const e of a.exports) {
    for (const rt of requiredPropertyTypesFor(e)) required.add(rt);
    for (const ot of observedPropertyTypesFor(e.name, a.properties)) observed.add(ot);
  }
  return PROPERTY_TYPES.filter((pt) => required.has(pt) && !observed.has(pt));
};
