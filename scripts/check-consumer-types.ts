// Checks that a consumer who depends only on an adapter can type-check the
// declarations tsc writes for its own code. Strict installs (pnpm, Bun
// isolated) don't let that consumer resolve @lunarhue/forms-core, so every
// type its declarations name has to come through the adapter's entries.
//
// For each adapter, it links the built package and its peers into a project
// outside the repo, emits declarations for a small module with inferred
// types, then type-checks them with skipLibCheck off. Build first:
//
//   bun run build && bun scripts/check-consumer-types.ts
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(root, "node_modules", ".bin", "tsc");

interface Consumer {
  readonly adapter: string;
  // Packages the consumer installs next to the adapter, found in the adapter's node_modules.
  readonly peers: readonly string[];
  readonly source: string;
}

const shared = (adapter: string) => `
import { createForms } from "@lunarhue/forms-${adapter}";
import { digits, history, mask, rules } from "@lunarhue/forms-${adapter}/plugins";

export const forms = createForms({ plugins: [history()] });

export const orderRules = rules<{ pickup: boolean; city: string }>({
  city: (value) => ({ disabled: value.pickup }),
});

export const order = forms.define({
  defaultValues: { pickup: false, city: "", phone: "" },
  plugins: [mask({ phone: digits }), orderRules],
});

export const undoLimit = history(10);
`;

const consumers: readonly Consumer[] = [
  { adapter: "react", peers: ["react", "@types/react"], source: shared("react") },
  { adapter: "solid", peers: ["solid-js", "@solidjs/web"], source: shared("solid") },
];

const compilerOptions = {
  target: "es2022",
  lib: ["es2022", "dom"],
  module: "preserve",
  moduleResolution: "bundler",
  strict: true,
  skipLibCheck: false,
  types: [],
};

function link(dir: string, name: string, target: string): void {
  const path = join(dir, "node_modules", name);
  mkdirSync(dirname(path), { recursive: true });
  symlinkSync(target, path, "dir");
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function run(cwd: string, project: string): string | undefined {
  try {
    execFileSync(tsc, ["-p", project], { cwd, encoding: "utf8", stdio: "pipe" });
    return undefined;
  } catch (error) {
    // execFileSync's error carries the child's output as strings, given an encoding.
    const thrown = typeof error === "object" && error !== null ? error : {};
    const stdout = "stdout" in thrown ? text(thrown.stdout) : "";
    const stderr = "stderr" in thrown ? text(thrown.stderr) : "";
    return `${stdout}${stderr}`.trim() || String(error);
  }
}

let failed = false;
for (const { adapter, peers, source } of consumers) {
  const dir = mkdtempSync(join(tmpdir(), `forms-consumer-${adapter}-`));
  try {
    const pkg = join(root, "packages", adapter);
    link(dir, `@lunarhue/forms-${adapter}`, pkg);
    for (const peer of peers) link(dir, peer, join(pkg, "node_modules", peer));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(join(dir, "index.ts"), source);
    writeFileSync(
      join(dir, "tsconfig.emit.json"),
      JSON.stringify({ compilerOptions: { ...compilerOptions, declaration: true, emitDeclarationOnly: true, outDir: "out" }, files: ["index.ts"] }),
    );
    writeFileSync(join(dir, "tsconfig.check.json"), JSON.stringify({ compilerOptions: { ...compilerOptions, noEmit: true }, files: ["out/index.d.ts"] }));

    const emitted = run(dir, "tsconfig.emit.json");
    const checked = emitted ?? run(dir, "tsconfig.check.json");
    if (checked === undefined) {
      console.log(`${adapter}: ok`);
      continue;
    }
    failed = true;
    console.error(`${adapter}: ${emitted === undefined ? "the emitted declarations don't type-check" : "emit failed"}`);
    console.error(checked);
    if (emitted === undefined) console.error(`\nout/index.d.ts:\n${readFileSync(join(dir, "out", "index.d.ts"), "utf8")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failed) process.exit(1);
