/*
 * POST /_/r: Cloudflare Web Analytics' beacon, relayed to Cloudflare. The
 * layout points the beacon here with `send.to`, so its page load and Web
 * Vitals reports leave the browser for the site itself instead of
 * cloudflareinsights.com, which blocklists match.
 *
 * The body must be a JSON object of at most 32 KB (a report is 1 to 6 KB), so
 * this can't relay anything else. A bad body gets 400. Requests the other
 * analytics skip (see _analytics.ts) get 204 and go nowhere. The rest go to
 * Cloudflare with a handful of headers, never cookies, and the visitor gets
 * Cloudflare's status, or 204 if Cloudflare can't be reached.
 */
import { crossSite, recordingChannel, type PagesContext } from "../_analytics";

export const RUM_ENDPOINT = "https://cloudflareinsights.com/cdn-cgi/rum";

const MAX_BODY = 32_768;

/** Request headers passed on to Cloudflare. */
const FORWARDED = ["user-agent", "origin", "referer", "accept-language"] as const;

const respond = (status: number, headers: Record<string, string> = {}): Response =>
  new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });

/** The body as text if it is a JSON object within the limit. */
async function readReport(request: Request): Promise<string | undefined> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return undefined;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return undefined;
    const body: unknown = JSON.parse(text);
    return typeof body === "object" && body !== null && !Array.isArray(body) ? text : undefined;
  } catch {
    return undefined;
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;
  if (request.method !== "POST") return respond(405, { allow: "POST" });
  const report = await readReport(request);
  if (report === undefined) return respond(400);

  const url = new URL(request.url);
  if (recordingChannel(request) === undefined || crossSite(request, url)) return respond(204);

  const headers = new Headers({ "content-type": "application/json" });
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  try {
    const upstream = await fetch(RUM_ENDPOINT, { method: "POST", headers, body: report });
    return respond(upstream.status);
  } catch {
    return respond(204);
  }
}
