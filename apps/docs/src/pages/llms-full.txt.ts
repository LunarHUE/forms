import type { APIRoute } from "astro";

import { llmsFull } from "@/lib/llms";
import { sitePages } from "@/lib/pages";
import { textResponse } from "@/lib/responses";

export const GET: APIRoute = async () => textResponse(llmsFull(await sitePages()));
