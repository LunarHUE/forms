import type { APIRoute } from "astro";

import { LLMS_FULL_HREF, LLMS_HREF } from "@/lib/llms";
import { textResponse } from "@/lib/responses";
import { absoluteUrl, CHANNEL } from "@/lib/site";

const release = [
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
  "",
  "# For language models and agents:",
  `# ${LLMS_HREF} indexes the docs (also at /agents.txt).`,
  `# ${LLMS_FULL_HREF} has every page as Markdown.`,
  "# Any docs page's URL plus .md is that page as Markdown.",
];

// The next site documents unreleased APIs and stays out of search entirely.
const next = ["User-agent: *", "Disallow: /"];

export const GET: APIRoute = () => textResponse([...(CHANNEL === "next" ? next : release), ""].join("\n"));
