import { installCommand } from "../components/mdx/install/commands";

import type { Framework } from "./frameworks";

/** One file of a demo, as the page's code tabs show it. */
export interface DemoSource {
  /** The path inside the demo folder, like `contact.tsx`. */
  readonly name: string;
  readonly code: string;
}

export interface MarkdownPage {
  readonly title: string;
  readonly description: string;
  /** The MDX source without frontmatter (`entry.body`). */
  readonly body: string;
  /** The framework the page renders for. Leave out on framework-free pages. */
  readonly framework?: Framework;
  /** The page's path, like `/react/plugins/masks`. Relative links resolve against it. */
  readonly url: string;
  /** The files of a `<Demo name>`, entry file first. */
  readonly demo?: (name: string) => readonly DemoSource[];
  /** A `<Compare app>` block as Markdown: its sizes table and both libraries' files. */
  readonly compare?: (app: string) => string;
}

const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const ONLY_OPEN = /^<Only\s+framework="([\w-]+)"\s*>\s*$/;
const ONLY_CLOSE = /^<\/Only>\s*$/;
const DEMO = /^<Demo\s+name="([^"]+)"\s*\/>\s*$/;
const COMPARE = /^<Compare\b(.*?)\/>\s*$/;
const INSTALL = /^<Install\b(.*?)\/>\s*$/;
const CALLOUT_OPEN = /^<Callout\b(.*?)>\s*$/;
const CALLOUT_CLOSE = /^<\/Callout>\s*$/;
const ESM = /^(import|export)\s/;
const LINK = /\]\(([^)\s]+)\)/g;

/** A string attribute from a JSX tag's attribute text. */
const attribute = (text: string, name: string): string | undefined =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(text)?.[1];

/** A bare boolean attribute, like `adapter` in `<Install adapter />`. */
const flag = (text: string, name: string): boolean => new RegExp(`(^|\\s)${name}(\\s|$)`).test(text);

/**
 * The fence's opening line with the docs-only meta dropped: `framework` and
 * `lineNumbers` mean nothing outside the site. `title` stays.
 */
function openingFence(indent: string, marker: string, info: string): string {
  const [lang = "", ...rest] = info.trim().split(/\s+/);
  const title = /\btitle=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(rest.join(" "));
  const name = title?.slice(1).find((value) => value !== undefined);
  return `${indent}${marker}${lang}${name ? ` title="${name}"` : ""}`;
}

/** Stands in for whichever host serves the docs, so paths resolve against a page's path. */
const ORIGIN = "https://docs.invalid";

/**
 * Turn a link into a root-relative path, to the `.md` copy when it points at
 * a docs page. Paths stay relative to the host, so each deployment's copies
 * link to that deployment.
 */
function resolveLink(href: string, base: URL): string {
  if (href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  const url = new URL(href, base);
  if (url.pathname !== "/" && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += ".md";
  return `${url.pathname}${url.search}${url.hash}`;
}

function fence(lang: string, code: string, title?: string): string {
  const ticks = "`".repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map((match) => match[0].length + 1)));
  return `${ticks}${lang}${title ? ` title="${title}"` : ""}\n${code.replace(/\n$/, "")}\n${ticks}`;
}

/**
 * The page as plain Markdown, for the `.md` routes and llms-full.txt.
 *
 * Works on the MDX source line by line, the way the docs write it:
 * `<Only>`, `<Demo>`, `<Install>` and `<Callout>` each sit on lines of their
 * own. For `framework`:
 * - `<Only>` blocks and tagged fences for other frameworks are dropped.
 * - `<Demo name>` becomes its files, each in a fence titled with its name.
 * - `<Compare app>` becomes its sizes table and both libraries' files.
 * - `<Install>` becomes an npm command.
 * - `<Callout>` becomes a blockquote.
 * - Links become root-relative paths, and links to docs pages point at their `.md`.
 * The MDX imports go. A `Source:` line with the page's path follows the
 * description.
 */
export function toMarkdown({ title, description, body, framework, url, demo, compare }: MarkdownPage): string {
  const base = new URL(url, ORIGIN);
  const out: string[] = [];
  const shown: boolean[] = [];
  let open: { marker: string; keep: boolean } | undefined;
  let quote = false;

  const push = (line: string) => {
    if (shown.includes(false)) return;
    out.push(quote ? (line.trim() === "" ? ">" : `> ${line}`) : line);
  };

  for (const line of body.split("\n")) {
    if (open) {
      const close = FENCE.exec(line);
      const done =
        close !== null &&
        close[3].trim() === "" &&
        close[2][0] === open.marker[0] &&
        close[2].length >= open.marker.length;
      if (open.keep) push(done ? `${close[1]}${open.marker}` : line);
      if (done) open = undefined;
      continue;
    }

    const start = FENCE.exec(line);
    if (start) {
      const [, indent = "", marker = "", info = ""] = start;
      const tagged = /\bframework=["']?([\w-]+)/.exec(info)?.[1];
      open = { marker, keep: tagged === undefined || framework === undefined || tagged === framework };
      if (open.keep) push(openingFence(indent, marker, info));
      continue;
    }

    const only = ONLY_OPEN.exec(line);
    if (only) {
      shown.push(framework === undefined || only[1] === framework);
      continue;
    }
    if (ONLY_CLOSE.test(line)) {
      shown.pop();
      continue;
    }
    if (shown.includes(false)) continue;

    if (ESM.test(line)) continue;

    const demoName = DEMO.exec(line)?.[1];
    if (demoName !== undefined) {
      const files = demo?.(demoName) ?? [];
      if (files.length === 0) throw new Error(`${url}: <Demo name="${demoName}"> has no files for ${framework}`);
      push(files.map((file) => fence(file.name.split(".").at(-1) ?? "", file.code, file.name)).join("\n\n"));
      continue;
    }

    const compareTag = COMPARE.exec(line)?.[1];
    if (compareTag !== undefined) {
      const app = attribute(compareTag, "app");
      if (app === undefined || compare === undefined) throw new Error(`${url}: <Compare> needs an app and a compare source`);
      push(compare(app));
      continue;
    }

    const install = INSTALL.exec(line)?.[1];
    if (install !== undefined) {
      const packages = [
        ...(flag(install, "adapter") && framework ? [`@lunarhue/forms-${framework}`] : []),
        ...(attribute(install, "packages")?.split(/\s+/).filter(Boolean) ?? []),
      ];
      push(fence("bash", installCommand("npm", packages)));
      continue;
    }

    const callout = CALLOUT_OPEN.exec(line)?.[1];
    if (callout !== undefined) {
      quote = true;
      const label = attribute(callout, "title") ?? (attribute(callout, "type") === "warning" ? "Warning" : "Note");
      push(`**${label}**`);
      continue;
    }
    if (CALLOUT_CLOSE.test(line)) {
      quote = false;
      if (out.at(-1) === ">") out.pop();
      continue;
    }

    push(line.replace(LINK, (_, href: string) => `](${resolveLink(href, base)})`));
  }

  const text = out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `# ${title}\n\n> ${description}\n\nSource: ${url}\n\n${text}\n`;
}
