import * as os from "node:os";
import * as path from "node:path";

const TILDE_PREFIX = process.platform === "win32" ? /^~(?:[\\/]|$)/ : /^~(?:\/|$)/;

/** Expand a current-user `~` or `~/...` prefix. Named-user `~user` paths are left unchanged. */
export function expandTilde(input: string): string {
  const prefix = input.match(TILDE_PREFIX)?.[0];
  return prefix ? path.join(os.homedir(), input.slice(prefix.length)) : input;
}
