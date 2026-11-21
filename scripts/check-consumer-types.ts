// Checks that a consumer who depends only on an adapter can type-check the
// declarations tsc writes for its own code. Strict installs (pnpm, Bun
// isolated) don't let that consumer resolve @lunarhue/forms-core, so every
// type its declarations name has to come from the adapter. The adapters
// bundle core's declarations into their own for that (see typesBuild in
// tsdown.base.ts), and this also checks that their entries share one copy.
// The schema, bind and devtools plugins bundle core's declarations the same way, so a
// consumer of an adapter and those plugins needs no core either.
//
// For each consumer, it links the built packages and their peers into a
// project outside the repo, emits declarations for a small module with
// inferred types, then type-checks them with skipLibCheck off. Build first:
//
//   bun run build && bun run check:consumer-types
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(root, "node_modules", ".bin", "tsc");

interface Consumer {
  readonly name: string;
  readonly source: string;
  // What the consumer installs: package name to its folder under the repo root.
  readonly links: Readonly<Record<string, string>>;
}

const plugins = (adapter: string) => `
import { createForms, defineField, type FieldApi, type refuse as fromMain } from "@lunarhue/forms-${adapter}";
import { history, refuse, ruled, rules } from "@lunarhue/forms-${adapter}/plugins";
import { digits, masked } from "@lunarhue/forms-${adapter}/text";

// refuse is a unique symbol, so a second copy of core's types would be a second type.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const oneCopy: Same<typeof fromMain, typeof refuse> = true;

export const PhoneField = defineField((_props: { readonly field: FieldApi<string> }) => null, masked({ clean: digits }));

export const forms = createForms({ plugins: [history(), rules()], fields: { PhoneField } });

export const Contact = forms.fieldset<{ email: string; phone: string }, typeof rules>(
  ruled({ email: (value) => ({ hidden: value.phone !== "" }) }),
);

export const order = forms.define(
  { defaultValues: { pickup: false, city: "", phone: "" } },
  ruled({ city: (value) => ({ disabled: value.pickup }) }),
  PhoneField.at("phone"),
);

export const undoLimit = history(10);
`;

// Valibot, zustand and devtools with React, zod and a signal with Solid, so
// each of the five plugin entries shows up in one consumer.
const reactSchemaBind = `
import { createForms } from "@lunarhue/forms-react";
import { devtools } from "@lunarhue/forms-devtools";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { zustand } from "@lunarhue/forms-bind/zustand";
import { createStore } from "zustand/vanilla";
import * as v from "valibot";

export const forms = createForms({ plugins: [valibot(), devtools({ enabled: () => true })] });

const store = createStore(() => ({ email: "", name: "" }));

export const signUp = forms.define({
  schema: v.object({ email: v.string(), name: v.string() }),
  plugins: [zustand(store)],
});

export const nameOnly = createForms().define({
  defaultValues: { name: "" },
  plugins: [zustand(store, { select: (state) => ({ name: state.name }), update: (value) => value })],
});
`;

const solidSchemaBind = `
import { createForms } from "@lunarhue/forms-solid";
import { zod } from "@lunarhue/forms-schema/zod";
import { signal } from "@lunarhue/forms-bind/solid";
import { createSignal } from "solid-js";
import { z } from "zod";

export const forms = createForms({ plugins: [zod()] });

const [get, set] = createSignal({ email: "" });

export const signUp = forms.define({ schema: z.object({ email: z.string() }), plugins: [signal(get, set)] });
`;

// /mini: a form with each portable part, and the same refuse as the main entry's.
const reactMini = `
import { createForms, fieldValidators, observe, perField, refuse, text, transform, type FieldApi, type FormOf } from "@lunarhue/forms-react/mini";
import type { refuse as fromPlugins } from "@lunarhue/forms-react/plugins";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const oneCopy: Same<typeof fromPlugins, typeof refuse> = true;

export const forms = createForms({ subscribe: perField() });

export const Query = forms.fieldset<string>(
  transform((value) => value.trimStart()),
  text((value) => value.toUpperCase()),
  observe((value) => console.log(value)),
);

export const search = forms.define(
  {
    defaultValues: { q: "", page: 1 },
    validate: { fields: fieldValidators({ q: (value: string) => (value ? undefined : { message: "Type something." }) }) },
    onSubmit: (value) => value.q,
  },
  Query.at("q"),
);

export const label = (field: FieldApi<string>) => field.text;

export const TextField = (_props: { readonly field: FieldApi<string>; readonly label: string }) => null;
export const withFields = createForms({ fields: { TextField } });
export const signIn = withFields.define({ defaultValues: { email: "" } });
export declare const signInForm: FormOf<typeof signIn>;
export const BoundText = signInForm.TextField;
`;

const ours = (name: string) => ({ [`@lunarhue/forms-${name}`]: `packages/${name}` });
const react = { ...ours("react"), react: "packages/react/node_modules/react", "@types/react": "packages/react/node_modules/@types/react" };
const solid = { ...ours("solid"), "solid-js": "packages/solid/node_modules/solid-js", "@solidjs/web": "packages/solid/node_modules/@solidjs/web" };

const consumers: readonly Consumer[] = [
  { name: "react", source: plugins("react"), links: react },
  { name: "solid", source: plugins("solid"), links: solid },
  { name: "react/mini", source: reactMini, links: react },
  {
    name: "react + schema + bind",
    source: reactSchemaBind,
    links: {
      ...react,
      ...ours("schema"),
      ...ours("bind"),
      ...ours("devtools"),
      valibot: "packages/schema/node_modules/valibot",
      zustand: "packages/bind/node_modules/zustand",
    },
  },
  {
    name: "solid + schema + bind",
    source: solidSchemaBind,
    links: { ...solid, ...ours("schema"), ...ours("bind"), zod: "packages/schema/node_modules/zod" },
  },
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
for (const { name, source, links } of consumers) {
  const dir = mkdtempSync(join(tmpdir(), "forms-consumer-"));
  try {
    for (const [pkg, path] of Object.entries(links)) link(dir, pkg, join(root, path));
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
      console.log(`${name}: ok`);
      continue;
    }
    failed = true;
    console.error(`${name}: ${emitted === undefined ? "the emitted declarations don't type-check" : "emit failed"}`);
    console.error(checked);
    if (emitted === undefined) console.error(`\nout/index.d.ts:\n${readFileSync(join(dir, "out", "index.d.ts"), "utf8")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failed) process.exit(1);
