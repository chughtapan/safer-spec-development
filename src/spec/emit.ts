/**
 * @spec.purpose
 *   Canonical SPEC.md markdown serializer + sidecar JSON serializer.
 *   Consumes a `FolderAnalysis` (built by `generate.ts` from parsed
 *   directives + test extraction) and produces the two output artifacts.
 *
 *   Canonical form: LF endings, lexicographic sort for filesystem lists,
 *   source-order sort for exports. Per `validate-gate-determ`, re-emission
 *   at the same source state must be byte-stable.
 */

import type { PropertyType } from "@safer/property-types/index.js";
import { SPEC_FORMAT_VERSION } from "@safer/commands/version.js";

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
    lines.push(`- "${x.claim}" — _${x.reason}_`);
  }
  return lines;
};

const emitResidualContract = (
  rc: ResidualContract | null,
): ReadonlyArray<string> => {
  if (rc === null) return [];
  if (rc._tag === "none") return ["", `**Residual contract:** none — _${rc.reason}_`];
  return ["", `**Residual contract:** "${rc.body}" — _${rc.reason}_`];
};

const emitSkipped = (
  skipped: ExportEntry["skipped"],
): ReadonlyArray<string> => {
  if (skipped.length === 0) return [];
  const lines: string[] = ["", "**Skipped property types:**"];
  for (const s of skipped) {
    lines.push(`- \`${s.propertyType}\` — _${s.reason}_`);
  }
  return lines;
};

/**
 * Compute a relative anchor link from the SPEC.md (at `<folder>/SPEC.md`)
 * to the declaration's source file + line. `#Lnnn` is GitHub/IDE-style.
 */
const sourceLink = (folder: string, path: string, line: number): string => {
  const prefix = folder + "/";
  const relPath = path.startsWith(prefix) ? "./" + path.slice(prefix.length) : path;
  return `${relPath}#L${String(line)}`;
};

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
    const exports = p.exports.map((s) => "`" + s + "`").join(", ");
    const status = p.stubbed ? "todo" : "implemented";
    lines.push(
      `| \`${p.id}\` | \`${p.propertyType}\` | ${exports} | ${p.claim} | ${status} |`,
    );
  }
  return lines;
};

/**
 * @spec.guarantee "two calls with the same `analysis` produce byte-identical markdown"
 *   reason: roundtrip contract on the emit step.
 * @spec.residual-contract "internal section ordering is fixed: Purpose → Public Surface → Files → Properties"
 *   reason: behavioral contract beyond the FolderAnalysis shape.
 */
export const emitMarkdown = (a: FolderAnalysis): string => {
  const lines: string[] = [
    "---",
    `folder: ${a.folder}`,
    `format-version: ${SPEC_FORMAT_VERSION}`,
    "---",
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

/**
 * @spec.guarantee "stable JSON encoding; key order follows the FolderAnalysis shape"
 *   reason: roundtrip contract; downstream `validate` compares bytes.
 * @spec.residual-contract none
 *   reason: pure transformation.
 */
export const emitSidecar = (a: FolderAnalysis): string =>
  JSON.stringify(
    {
      formatVersion: SPEC_FORMAT_VERSION,
      folder: a.folder,
      purpose: a.purpose,
      exports: a.exports,
      properties: a.properties,
      files: { source: a.sourceFiles, test: a.testFiles },
    },
    null,
    2,
  ) + "\n";
