import type { APIRoute } from "astro";

import { sitePages } from "@/lib/pages";
import { textResponse } from "@/lib/responses";
import { absoluteUrl } from "@/lib/site";

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

// Every page of the latest version. Older versions and redirects stay out.
export const GET: APIRoute = async () => {
  const urls = (await sitePages()).map((page) => {
    const lastmod = page.lastUpdated ? `<lastmod>${page.lastUpdated.toISOString()}</lastmod>` : "";
    return `  <url><loc>${escape(absoluteUrl(page.href))}</loc>${lastmod}</url>`;
  });
  return textResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    "application/xml",
  );
};
