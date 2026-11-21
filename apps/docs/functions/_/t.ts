/*
 * POST /_/t: a pageview from the tracker in src/lib/analytics.ts. The body is
 * JSON, `{ path, framework, referrer, status, device }`, at most 2 KB. A bad
 * body gets 400; anything else gets 204, recorded or not (see _analytics.ts
 * for which requests are). The path is deliberately bland: blocklists match
 * `/analytics` and `/collect`.
 */
import {
  countryOf,
  crossSite,
  parsePageview,
  recordingChannel,
  referrerHost,
  writeAnalyticsPoint,
  type PagesContext,
} from "../_analytics";

const MAX_BODY = 2048;

const respond = (status: number, headers: Record<string, string> = {}): Response =>
  new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });

async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return undefined;
  try {
    const text = await request.text();
    return text.length > MAX_BODY ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== "POST") return respond(405, { allow: "POST" });
  const pageview = parsePageview(await readJson(request));
  if (pageview === undefined) return respond(400);

  const url = new URL(request.url);
  const channel = recordingChannel(request);
  if (channel !== undefined && !crossSite(request, url)) {
    writeAnalyticsPoint(env, {
      channel,
      event: "pageview",
      path: pageview.path,
      framework: pageview.framework,
      referrerHost: referrerHost(pageview.referrer, url.hostname),
      country: countryOf(request),
      client: pageview.device,
      host: url.hostname,
      status: pageview.status,
    });
  }
  return respond(204);
}
