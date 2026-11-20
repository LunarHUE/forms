import type { APIRoute, GetStaticPaths } from "astro";

import { AVAILABLE_FRAMEWORKS, type Framework } from "@/lib/frameworks";
import { llmsFull } from "@/lib/llms";
import { sitePages } from "@/lib/pages";
import { textResponse } from "@/lib/responses";

export const getStaticPaths = (() =>
  AVAILABLE_FRAMEWORKS.map((framework) => ({ params: { framework }, props: { framework } }))) satisfies GetStaticPaths;

interface Props {
  readonly framework: Framework;
}

export const GET: APIRoute<Props> = async ({ props }) => textResponse(llmsFull(await sitePages(), props.framework));
