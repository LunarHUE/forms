import type { APIRoute, GetStaticPaths } from "astro";

import { AVAILABLE_FRAMEWORKS, type Framework } from "@/lib/frameworks";
import { llmsFull } from "@/lib/llms";
import { sitePages } from "@/lib/pages";
import { textResponse } from "@/lib/responses";

export const getStaticPaths = (() =>
  AVAILABLE_FRAMEWORKS.map((framework) => ({ params: { framework } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  textResponse(llmsFull(await sitePages(), params.framework as Framework));
