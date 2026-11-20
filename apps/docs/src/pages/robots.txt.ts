import type { APIRoute } from "astro";

import { LLMS_FULL_HREF, LLMS_HREF } from "@/lib/llms";
import { textResponse } from "@/lib/responses";
import { absoluteUrl } from "@/lib/site";

export const GET: APIRoute = () =>
  textResponse(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
      "",
      "# For language models and agents:",
      `# ${absoluteUrl(LLMS_HREF)} indexes the docs (also at ${absoluteUrl("/agents.txt")}).`,
      `# ${absoluteUrl(LLMS_FULL_HREF)} has every page as Markdown.`,
      "# Any docs page's URL plus .md is that page as Markdown.",
      "",
    ].join("\n"),
  );
