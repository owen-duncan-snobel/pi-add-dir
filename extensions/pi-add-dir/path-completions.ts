import * as fs from "node:fs";
import * as path from "node:path";
import { expandTilde } from "./paths.js";

export interface DirectoryCompletion {
  value: string;
  label: string;
  description: string;
}

/**
 * Complete directory paths while preserving the path style typed by the user.
 * Relative paths are resolved from the current pi working directory, and `~/`
 * resolves to the current user's home directory (matching `/add-dir`).
 *
 * Completions always use `/` as the separator because pi's autocomplete treats
 * a trailing `/` as "directory, keep completing".
 */
export function completeDirectoryPaths(prefix: string, cwd: string): DirectoryCompletion[] | null {
  if (prefix === "~") {
    return [{ value: "~/", label: "~/", description: expandTilde("~") }];
  }

  const lastSeparator = prefix.lastIndexOf("/");
  const typedParent = prefix.slice(0, lastSeparator + 1);
  const partialName = prefix.slice(lastSeparator + 1);
  const parentPath = expandTilde(typedParent || ".");
  const searchDir = path.resolve(cwd, parentPath);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(searchDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const lowerPartial = partialName.toLowerCase();
  const toCompletion = (name: string): DirectoryCompletion => ({
    value: `${typedParent}${name}/`,
    label: `${name}/`,
    description: path.join(searchDir, name),
  });

  // Offer `./` and `../` so typing `.` or `..` opens the dropdown and can keep
  // drilling into the current or parent directory.
  const navigation = [".", ".."]
    .filter(name => name.startsWith(partialName) && partialName.startsWith("."))
    .map(toCompletion);

  const suggestions = entries
    .filter(entry => isDirectoryEntry(entry, searchDir))
    .filter(entry => entry.name.toLowerCase().startsWith(lowerPartial))
    // Deliberately hide dot-directories on an empty segment (unlike pi's @-file
    // completion). Non-empty segments are already filtered by the prefix match.
    .filter(entry => partialName !== "" || !entry.name.startsWith("."))
    .map(entry => toCompletion(entry.name))
    .sort((a, b) => a.label.localeCompare(b.label));

  const completions = [...navigation, ...suggestions];
  return completions.length > 0 ? completions : null;
}

function isDirectoryEntry(entry: fs.Dirent, searchDir: string): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return fs.statSync(path.join(searchDir, entry.name)).isDirectory();
  } catch {
    return false;
  }
}
