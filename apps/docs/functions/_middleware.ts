/*
 * Runs in front of every route public/_routes.json sends to Functions.
 * Successful GETs of the Markdown copies and llms files are recorded as
 * `agent_fetch` (see _analytics.ts); everything else passes straight through.
 * The file is served whatever happens to the analytics.
 */
import {
  agentClient,
  countryOf,
  frameworkFromPath,
  isAgentPath,
  normalizePath,
  recordingChannel,
  referrerHost,
  writeAnalyticsPoint,
  type PagesContext,
} from "./_analytics";

function record(context: PagesContext, url: URL, status: number): void {
  const { request, env } = context;
  const channel = recordingChannel(request);
  const path = normalizePath(url.pathname);
  if (channel === undefined || path === undefined) return;
  writeAnalyticsPoint(env, {
    channel,
    event: "agent_fetch",
    path,
    framework: frameworkFromPath(path),
    referrerHost: referrerHost(request.headers.get("referer"), url.hostname),
    country: countryOf(request),
    client: agentClient(request.headers.get("user-agent"), request.headers.get("sec-fetch-site")),
    host: url.hostname,
    status,
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  if (context.request.method !== "GET" || !isAgentPath(url.pathname)) return context.next();
  const response = await context.next();
  if (response.status === 200) {
    try {
      record(context, url, response.status);
    } catch {
      // Analytics never break serving the file.
    }
  }
  return response;
}
