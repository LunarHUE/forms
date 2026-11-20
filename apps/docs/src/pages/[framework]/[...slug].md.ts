import type { APIRoute, GetStaticPaths } from "astro";

import { markdownResponse } from "@/lib/responses";
import { sitePages, type SitePage } from "@/lib/pages";

// The Markdown copy of each docs page, at its URL plus `.md`.
export const getStaticPaths = (async () =>
  (await sitePages()).flatMap((page) =>
    page.framework ? [{ params: { framework: page.framework, slug: page.slug }, props: { page } }] : [],
  )) satisfies GetStaticPaths;

export const GET: APIRoute<{ page: SitePage }> = ({ props }) => markdownResponse(props.page.markdown());
