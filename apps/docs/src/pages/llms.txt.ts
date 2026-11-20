import type { APIRoute } from "astro";

import { llmsIndex } from "@/lib/llms";
import { sitePages } from "@/lib/pages";
import { textResponse } from "@/lib/responses";

export const GET: APIRoute = async () => textResponse(llmsIndex(await sitePages()));
