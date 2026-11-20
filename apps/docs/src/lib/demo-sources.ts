import { hideDevtools } from "@/components/mdx/demo/devtools";

import type { Framework } from "./frameworks";
import type { DemoSource } from "./markdown";

const sources = import.meta.glob<string>("/src/demos/**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The files of a demo as readers see them: entry file (`contact.tsx` for
 * `masks/contact`) first, the rest by name, without the docs' devtools wiring.
 */
export function demoSources(framework: Framework, name: string): DemoSource[] {
  const folder = `/src/demos/${framework}/${name}/`;
  const entry = `${name.split("/").at(-1)}.tsx`;
  return Object.entries(sources)
    .filter(([path]) => path.startsWith(folder))
    .map(([path, code]) => ({ name: path.slice(folder.length), code: hideDevtools(code).replace(/\n$/, "") }))
    .toSorted((a, b) => (a.name === entry ? -1 : b.name === entry ? 1 : a.name.localeCompare(b.name)));
}
