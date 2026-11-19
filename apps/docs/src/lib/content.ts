import { getCollection, getEntry, type CollectionEntry } from "astro:content";

import { AVAILABLE_FRAMEWORKS } from "./frameworks";
import type { NavPage } from "./nav";
import { INTRODUCTION_SLUG } from "./routes";

export type DocEntry = CollectionEntry<"docs">;
export type ErrorsEntry = CollectionEntry<"errors">;

/** Every docs entry. A production build leaves drafts out; dev shows them. */
export async function getDocs(): Promise<DocEntry[]> {
  const entries = await getCollection("docs", (entry) => !import.meta.env.PROD || entry.data.status !== "draft");
  const introduction = entries.find((entry) => entry.id === INTRODUCTION_SLUG);
  const missing = AVAILABLE_FRAMEWORKS.filter((framework) => !introduction?.data.frameworks.includes(framework));
  if (missing.length > 0) {
    throw new Error(`docs/${INTRODUCTION_SLUG}.mdx must exist for ${missing.join(", ")}: alternates fall back to it`);
  }
  return entries;
}

export const toNavPage = (entry: DocEntry): NavPage => ({
  slug: entry.id,
  title: entry.data.title,
  navTitle: entry.data.navTitle,
  section: entry.data.section,
  order: entry.data.order,
  frameworks: entry.data.frameworks,
});

export async function getErrors(): Promise<ErrorsEntry> {
  const entry = await getEntry("errors", "errors");
  if (!entry) throw new Error("src/content/errors.mdx is missing");
  return entry;
}
