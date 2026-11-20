import { execFileSync } from "node:child_process";

function git(args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // No git, or not a repository.
    return undefined;
  }
}

let usable: boolean | undefined;

/**
 * A shallow clone (CI's default fetch-depth of 1) dates every file to the one
 * commit it fetched, which would be wrong, so it counts as no history.
 */
function hasHistory(): boolean {
  usable ??= git(["rev-parse", "--is-shallow-repository"]) === "false";
  return usable;
}

const dates = new Map<string, Date | undefined>();

/**
 * When `file` last changed, from the date of the last commit that touched it.
 * Undefined without git history, in a shallow clone, or for a file that was
 * never committed. `file` is relative to the working directory or absolute.
 */
export function lastCommitDate(file: string): Date | undefined {
  if (!hasHistory()) return undefined;
  if (!dates.has(file)) {
    const iso = git(["log", "-1", "--format=%cI", "--", file]);
    dates.set(file, iso ? new Date(iso) : undefined);
  }
  return dates.get(file);
}
