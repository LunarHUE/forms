import type { APIRoute } from "astro";

import { sitePages } from "@/lib/pages";
import { textResponse } from "@/lib/responses";
import { absoluteUrl, CHANNEL } from "@/lib/site";

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

// Every page of the latest version. Older versions and redirects stay out.
// The next site lists nothing, since it is kept out of search.
export const GET: APIRoute = async () => {
  const pages = CHANNEL === "next" ? [] : await sitePages();
  const urls = pages.map((page) => {
    const lastmod = page.lastUpdated ? `<lastmod>${page.lastUpdated.toISOString()}</lastmod>` : "";
    return `  <url><loc>${escape(absoluteUrl(page.href))}</loc>${lastmod}</url>`;
  });
  return textResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    "application/xml",
  );
};
