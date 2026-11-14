// Fails when a pull request changes what a published package ships and adds
// no changeset. Run with bun from the repo root:
//
//   bun scripts/check-changeset.ts origin/main
//
// The argument is the base the pull request merges into. CI skips this check
// itself when the pull request has the no-changeset label.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspace } from "../e2e/changed/workspace.js";
import { checkChangeset, type Package } from "./changeset.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const base = process.argv[2];
if (base === undefined) throw new Error("Pass the base ref, such as origin/main.");

/** Files changed since the merge base with `base`, limited by `git diff` filter flags. */
const diff = (...flags: string[]): string[] =>
  execFileSync("git", ["diff", "--name-only", ...flags, `${base}...HEAD`], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");

const packages: Package[] = readWorkspace(root).map(({ name, dir }) => {
  // A package.json may mark itself private.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const manifest = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")) as { private?: boolean };
  return { name, dir, published: manifest.private !== true };
});

const verdict = checkChangeset(diff(), diff("--diff-filter=A"), packages);
for (const reason of verdict.reasons) console.log(reason);
process.exit(verdict.ok ? 0 : 1);
