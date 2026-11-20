import type { APIRoute } from "astro";

import { markdownResponse } from "@/lib/responses";
import { sitePages } from "@/lib/pages";

export const GET: APIRoute = async () => {
  const errors = (await sitePages()).find((page) => page.framework === undefined);
  if (!errors) throw new Error("The errors page is missing from sitePages()");
  return markdownResponse(errors.markdown());
};
