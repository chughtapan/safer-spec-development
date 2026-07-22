/**
 * @spec.purpose Escape directive body content for safe emission into Markdown
 *   prose and property-table cells. Defuses prompt-injection vectors via
 *   residual-contract strings that downstream agents will read as context.
 *
 *   Two surfaces: `escapeForMarkdownProse` for running prose, and
 *   `escapeForMarkdownTableCellProse` for un-code-spanned table cells (adds
 *   pipe escaping and maps newlines to `&lt;br>`). Each function's own
 *   `@spec.guarantee` documents its surface-specific safety claim.
 */

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

// Shared markdown escape chain for both prose surfaces: strip control chars,
// then escape backslash first (so later escapes are not double-escaped) and
// the markdown/HTML syntax characters. Callers append their newline handling
// (and the table-cell caller its pipe escape).
const escapeMarkdownCore = (input: string): string =>
  input
    .replace(CONTROL_CHARS, "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * @spec.guarantee "safe inside an un-code-spanned table cell; pipes, backticks, asterisks, underscores, brackets, angle brackets are escaped; CR/LF become `<br>`; control chars stripped; single pass so backslashes are not double-escaped"
 *   reason: property-table `Claim` carries author-controlled directive prose;
 *           chaining prose + table-cell helpers would double-escape `\\`.
 * @spec.residual-contract "one-way; round-trip through a markdown decoder does not return the original string"
 *   reason: same as the other escape helpers.
 */
export const escapeForMarkdownTableCellProse = (input: string): string =>
  escapeMarkdownCore(input)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");

/**
 * @spec.guarantee "output is safe to interpolate into markdown PROSE; backticks, code-fences, link syntax characters, asterisks, underscores, and HTML angle brackets are escaped; control characters are stripped"
 *   reason: trust contract; emitted into MODULE.md prose where
 *           attacker-controlled directive bodies could otherwise inject markup.
 * @spec.residual-contract "one-way; round-trip through a markdown decoder does not return the original string"
 *   reason: downstream readers see the escaped form.
 */
export const escapeForMarkdownProse = (input: string): string =>
  escapeMarkdownCore(input).replace(/\r?\n/g, " ");
