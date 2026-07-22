/**
 * @spec.purpose Rebases a source path onto the folder whose MODULE.md links to
 *   it. Same-folder targets become `./name.ts`, cross-folder targets walk up
 *   with `../`, and absolute paths / URL schemes pass through unchanged. Used
 *   by `emit.ts` to stamp source links relative to each folder's MODULE.md.
 */

/**
 * Path-relative-to-folder for source links inside `&lt;folder>/MODULE.md`.
 * Same-folder: `./name.ts`. Cross-folder: `../...`. Absolute/external:
 * passthrough.
 */
export const relativeToFolder = (folder: string, target: string): string => {
  // Project-root sentinel: a MODULE.md at the repo root reaches every file
  // via `./<target>`. Treating `.` as one path segment would emit `../…`
  // and point outside the repo.
  if (folder === ".") return "./" + target.replace(/^\.?\/?/, "");
  const prefix = folder + "/";
  if (target.startsWith(prefix)) return "./" + target.slice(prefix.length);
  if (target.startsWith("/") || /^[a-zA-Z]+:/.test(target)) return target;
  const fromParts = folder.split("/").filter((s) => s.length > 0);
  const toParts = target.split("/").filter((s) => s.length > 0);
  let shared = 0;
  while (
    shared < fromParts.length && shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) shared += 1;
  return "../".repeat(fromParts.length - shared) + toParts.slice(shared).join("/");
};
