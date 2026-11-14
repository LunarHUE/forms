// Packs the packages Changesets would publish, with Bun instead of npm. Run from the repo root:
//
//   bun run release:pack --out-dir <dir>              build, then pack into <dir>
//   bun run release:pack --out-dir <dir> --dry-run    ... then run `npm publish --dry-run` on each tarball
//
// In a Bun workspace Changesets packs with `npm pack`, which ships `workspace:` and `catalog:`
// versions as they are, and npm can't install those. `bun pm pack` swaps them for real ranges.
// <dir> gets the layout `changeset pack` writes, so `changeset publish --from-pack-dir <dir>`
// (what changesets/action/publish runs) uploads these tarballs.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** One entry of a Changesets publish plan, as `changeset publish-plan --output` writes it. */
interface Release {
  readonly kind: "publish" | "tag-only";
  readonly name: string;
  readonly version: string;
  readonly access?: string;
  readonly tag?: string;
  tarball?: { path: string; integrity: string };
}

/** Releases in chunks, each chunk after the ones it depends on. */
interface Plan {
  readonly version: 1;
  readonly plan: Release[][];
}

interface Args {
  outDir: string;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let outDir: string | undefined;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--out-dir") {
      index += 1;
      outDir = argv[index];
    } else if (arg.startsWith("--out-dir=")) outDir = arg.slice("--out-dir=".length);
    else throw new Error(`Unknown argument ${arg}.`);
  }
  if (outDir === undefined || outDir === "") throw new Error("--out-dir needs a directory.");
  return { outDir: resolve(outDir), dryRun };
}

function run(command: string, args: readonly string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? result.signal ?? "no status"}.`);
  }
  return result.stdout;
}

/** The parts of a package.json this script reads. */
interface Manifest {
  readonly name?: string;
  readonly version?: string;
}

function parseManifest(text: string): Manifest {
  // A package.json is JSON of this shape, or a superset of it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(text) as Manifest;
}

/** Package name to directory. Every published package lives under packages/. */
function packageDirs(): Map<string, string> {
  const base = join(root, "packages");
  const dirs = new Map<string, string>();
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const file = join(base, entry.name, "package.json");
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const { name } = parseManifest(readFileSync(file, "utf8"));
    if (name !== undefined) dirs.set(name, dirname(file));
  }
  return dirs;
}

/** Packs one package into `packagesDir` and checks the manifest npm will read. */
function pack(release: Release, dir: string, packagesDir: string): string {
  const output = run("bun", ["pm", "pack", "--destination", packagesDir, "--quiet"], dir);
  const tarball = join(packagesDir, basename(output.trim().split("\n").at(-1) ?? ""));
  const manifest = run("tar", ["-xzOf", tarball, "package/package.json"], root);
  const leftover = manifest.match(/"(?:workspace|catalog):[^"]*"/g);
  if (leftover !== null) throw new Error(`${basename(tarball)} still has ${leftover.join(", ")}.`);
  const packed = parseManifest(manifest);
  if (packed.name !== release.name || packed.version !== release.version) {
    throw new Error(`${basename(tarball)} holds ${packed.name ?? "?"}@${packed.version ?? "?"}, not ${release.name}@${release.version}.`);
  }
  return tarball;
}

const args = parseArgs(process.argv.slice(2));
mkdirSync(args.outDir, { recursive: true });
// A stale tarball from an earlier run could end up published.
if (readdirSync(args.outDir).length > 0) throw new Error(`${args.outDir} is not empty.`);
const packagesDir = join(args.outDir, "packages");
mkdirSync(packagesDir);
const planFile = join(args.outDir, "publish-plan.json");

// Changesets decides what to publish: public packages whose version isn't on the registry yet.
run(join(root, "node_modules", ".bin", "changeset"), ["publish-plan", "--output", planFile], root);
// Changesets just wrote this file in this shape.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const plan = JSON.parse(readFileSync(planFile, "utf8")) as Plan;
const releases = plan.plan.flat().filter((release) => release.kind === "publish");
if (releases.length === 0) {
  console.log("Nothing to publish.");
  process.exit(0);
}

const dirs = packageDirs();
for (const release of releases) {
  const dir = dirs.get(release.name);
  if (dir === undefined) throw new Error(`No directory under packages/ holds ${release.name}.`);
  const tarball = pack(release, dir, packagesDir);
  const integrity = `sha256-${createHash("sha256").update(readFileSync(tarball)).digest("base64")}`;
  release.tarball = { path: `packages/${basename(tarball)}`, integrity };
  console.log(`Packed ${release.name}@${release.version}: ${release.tarball.path}`);
}
writeFileSync(planFile, `${JSON.stringify(plan, undefined, 2)}\n`);

if (args.dryRun) {
  // Same order and flags as `changeset publish`, without the upload.
  for (const release of releases) {
    const tarball = join(args.outDir, release.tarball?.path ?? "");
    run("npm", ["publish", tarball, "--dry-run", "--access", release.access ?? "public", "--tag", release.tag ?? "latest"], root);
  }
}
