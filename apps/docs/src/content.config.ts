import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import { FRAMEWORK_IDS } from "./lib/frameworks";
import { SECTION_IDS } from "./lib/nav";

/** One page per file, shared by every framework. The path under docs/ is the slug. */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.enum(SECTION_IDS),
    /** Position in its sidebar section. Ties sort by title. */
    order: z.number(),
    /** Frameworks that get this page. */
    frameworks: z.array(z.enum(FRAMEWORK_IDS)).default(["react", "solid"]),
    /** A production build leaves drafts out. */
    status: z.enum(["stable", "draft"]).default("stable"),
    /** Shorter sidebar label. Defaults to the title. */
    navTitle: z.string().optional(),
  }),
});

/** The error code reference at /errors. */
const errors = defineCollection({
  loader: glob({ pattern: "errors.mdx", base: "./src/content" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { docs, errors };
