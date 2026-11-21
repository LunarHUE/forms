// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://forms.lunarhue.dev/" }
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  agentClient,
  ANALYTICS_HOSTS,
  channelFor,
  countryOf,
  isAgentPath,
  normalizePath,
  parsePageview,
  recordingChannel,
  referrerHost,
  writeAnalyticsPoint,
  type AnalyticsEngineDataPoint,
  type AnalyticsPoint,
  type PagesContext,
  type PagesEnv,
  type PagesRequest,
} from "../../functions/_analytics";
import { onRequest as track } from "../../functions/_/t";
import { onRequest as middleware } from "../../functions/_middleware";
import routes from "../../public/_routes.json";
import { resetAnalyticsForTests, startAnalytics, trackPageview } from "./analytics";
import { AVAILABLE_FRAMEWORKS } from "./frameworks";
import { CHANNEL_URLS } from "./site";

declare const jsdom: { reconfigure(options: { url: string }): void };

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

function dataset(): { env: PagesEnv; points: AnalyticsEngineDataPoint[] } {
  const points: AnalyticsEngineDataPoint[] = [];
  return { env: { DOCS_ANALYTICS: { writeDataPoint: (point) => points.push(point ?? {}) } }, points };
}

function request(url: string, init: RequestInit = {}, country?: string): PagesRequest {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", CHROME);
  return Object.assign(new Request(url, { ...init, headers }), { cf: { country } });
}

function context(req: PagesRequest, env: PagesEnv, served = new Response("ok")) {
  return { request: req, env, next: vi.fn<PagesContext["next"]>(async () => served) } satisfies PagesContext;
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  request(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }, "us");

const at = (url: string) => jsdom.reconfigure({ url });
const root = () => document.documentElement;

describe("analytics helpers", () => {
  it("lists the public sites of src/lib/site.ts", () => {
    expect(Object.keys(ANALYTICS_HOSTS).toSorted()).toEqual(
      Object.values(CHANNEL_URLS)
        .map((url) => new URL(url).hostname)
        .toSorted(),
    );
    expect(channelFor("forms.lunarhue.dev")).toBe("release");
    expect(channelFor("NEXT.forms.lunarhue.dev")).toBe("next");
    for (const host of ["localhost", "127.0.0.1", "pr-1.lunarhue-forms-docs.pages.dev", "release-candidate.lunarhue-forms-docs.pages.dev", "constructor"]) {
      expect(channelFor(host)).toBeUndefined();
    }
  });

  it("records only the public sites, never the smoke test", () => {
    expect(recordingChannel(request("https://forms.lunarhue.dev/react/install"))).toBe("release");
    expect(recordingChannel(request("https://next.forms.lunarhue.dev/llms.txt"))).toBe("next");
    expect(recordingChannel(request("http://127.0.0.1:4560/react/install"))).toBeUndefined();
    expect(
      recordingChannel(request("https://forms.lunarhue.dev/react/install", { headers: { "user-agent": "forms-docs-smoke" } })),
    ).toBeUndefined();
  });

  it("normalizes paths", () => {
    expect(normalizePath("/react/install.html")).toBe("/react/install");
    expect(normalizePath("/react/index.html")).toBe("/react");
    expect(normalizePath("/index.html")).toBe("/");
    expect(normalizePath("/react/install/")).toBe("/react/install");
    expect(normalizePath("/react/install?tab=bun#usage")).toBe("/react/install");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/react/introduction.md")).toBe("/react/introduction.md");
    expect(normalizePath(`/${"a".repeat(400)}`)).toHaveLength(256);
    expect(normalizePath("react/install")).toBeUndefined();
    expect(normalizePath("https://evil.example/")).toBeUndefined();
  });

  it("knows the agent files", () => {
    for (const path of ["/llms.txt", "/llms-full.txt", "/agents.txt", "/errors.md", "/react/introduction.md", "/solid/llms-full.txt"]) {
      expect(isAgentPath(path)).toBe(true);
    }
    for (const path of ["/", "/react/introduction", "/errors", "/_/t", "/pagefind/pagefind.js", "/react/llms.txt.html"]) {
      expect(isAgentPath(path)).toBe(false);
    }
  });

  it("names agent clients coarsely", () => {
    expect(agentClient("Claude-User (claude-code/2.1; +https://support.anthropic.com/)", null)).toBe("claude");
    expect(agentClient("Mozilla/5.0 (compatible; ClaudeBot/1.0)", null)).toBe("claude");
    expect(agentClient("anthropic-ai", null)).toBe("anthropic");
    expect(agentClient("Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", null)).toBe("openai");
    expect(agentClient("Mozilla/5.0 (compatible; GPTBot/1.1)", null)).toBe("openai");
    expect(agentClient("Cursor/1.4", null)).toBe("cursor");
    expect(agentClient("Mozilla/5.0 (compatible; PerplexityBot/1.0)", null)).toBe("perplexity");
    expect(agentClient("Google-Extended", null)).toBe("google");
    expect(agentClient("curl/8.9.1", null)).toBe("curl");
    expect(agentClient(CHROME, "same-origin")).toBe("browser-copy");
    expect(agentClient(CHROME, "none")).toBe("browser");
    expect(agentClient("python-httpx/0.28", null)).toBe("other");
    expect(agentClient(null, null)).toBe("other");
  });

  it("keeps only an external referrer's hostname", () => {
    expect(referrerHost("https://GitHub.com/LunarHUE/forms?tab=readme#top", "forms.lunarhue.dev")).toBe("github.com");
    expect(referrerHost("https://forms.lunarhue.dev/react/install", "forms.lunarhue.dev")).toBe("");
    expect(referrerHost("https://next.forms.lunarhue.dev/", "forms.lunarhue.dev")).toBe("next.forms.lunarhue.dev");
    expect(referrerHost("not a url", "forms.lunarhue.dev")).toBe("");
    expect(referrerHost("android-app://com.slack/", "forms.lunarhue.dev")).toBe("");
    expect(referrerHost("", "forms.lunarhue.dev")).toBe("");
    expect(referrerHost(null, "forms.lunarhue.dev")).toBe("");
    expect(referrerHost(`https://${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.com/`, "x")).toHaveLength(128);
  });

  it("reads the country only when it is a real code", () => {
    expect(countryOf(request("https://forms.lunarhue.dev/", {}, "de"))).toBe("DE");
    expect(countryOf(request("https://forms.lunarhue.dev/", {}, "T1"))).toBe("");
    expect(countryOf(request("https://forms.lunarhue.dev/", {}, "XX"))).toBe("");
    expect(countryOf(request("https://forms.lunarhue.dev/"))).toBe("");
  });

  it("validates pageviews", () => {
    expect(parsePageview({ path: "/react/install.html" })).toEqual({
      path: "/react/install",
      framework: "react",
      referrer: "",
      status: 200,
      device: "",
    });
    expect(parsePageview({ path: "/errors", framework: "solid", status: 404, device: "mobile", referrer: "https://x.dev" })).toEqual({
      path: "/errors",
      framework: "solid",
      referrer: "https://x.dev",
      status: 404,
      device: "mobile",
    });
    for (const body of [
      null,
      "string",
      {},
      { path: 3 },
      { path: "relative" },
      { path: "/x", framework: "vue" },
      { path: "/x", status: 500 },
      { path: "/x", status: "200" },
      { path: "/x", device: "tablet" },
      { path: "/x", referrer: 1 },
    ]) {
      expect(parsePageview(body)).toBeUndefined();
    }
  });

  it("writes one data point in the shared shape, and swallows write errors", () => {
    const point: AnalyticsPoint = {
      channel: "release",
      event: "pageview",
      path: "/react/install",
      framework: "react",
      referrerHost: "github.com",
      country: "DE",
      client: "desktop",
      host: "forms.lunarhue.dev",
      status: 200,
    };
    const { env, points } = dataset();
    expect(writeAnalyticsPoint(env, point)).toBe(true);
    expect(points).toEqual([
      {
        indexes: ["release"],
        blobs: ["pageview", "/react/install", "react", "github.com", "DE", "desktop", "forms.lunarhue.dev"],
        doubles: [200],
      },
    ]);
    expect(writeAnalyticsPoint({}, point)).toBe(false);
    const failing: PagesEnv = {
      DOCS_ANALYTICS: {
        writeDataPoint: () => {
          throw new Error("quota");
        },
      },
    };
    expect(writeAnalyticsPoint(failing, point)).toBe(false);
  });

  it("routes Functions for every framework and agent file, and no static assets", () => {
    for (const framework of AVAILABLE_FRAMEWORKS) expect(routes.include).toContain(`/${framework}/*`);
    for (const path of ["/_/t", "/llms.txt", "/llms-full.txt", "/agents.txt", "/errors.md"]) expect(routes.include).toContain(path);
    for (const path of ["/_astro/*", "/pagefind/*"]) expect(routes.exclude).toContain(path);
    // Pages allows a wildcard only at the end and 100 rules in all.
    for (const rule of [...routes.include, ...routes.exclude]) expect(rule.slice(0, -1)).not.toContain("*");
    expect(routes.include.length + routes.exclude.length).toBeLessThanOrEqual(100);
  });
});

describe("POST /_/t", () => {
  it("records a pageview on a public site", async () => {
    const { env, points } = dataset();
    const response = await track(
      context(post("https://next.forms.lunarhue.dev/_/t", { path: "/solid/install", referrer: "https://www.google.com", device: "mobile" }), env),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(points).toEqual([
      {
        indexes: ["next"],
        blobs: ["pageview", "/solid/install", "solid", "www.google.com", "US", "mobile", "next.forms.lunarhue.dev"],
        doubles: [200],
      },
    ]);
  });

  it("records a 404", async () => {
    const { env, points } = dataset();
    await track(context(post("https://forms.lunarhue.dev/_/t", { path: "/react/nope", status: 404 }), env));
    expect(points[0]?.doubles).toEqual([404]);
    expect(points[0]?.blobs?.[1]).toBe("/react/nope");
  });

  it("drops same-site referrers", async () => {
    const { env, points } = dataset();
    await track(context(post("https://forms.lunarhue.dev/_/t", { path: "/react/install", referrer: "https://forms.lunarhue.dev" }), env));
    expect(points[0]?.blobs?.[3]).toBe("");
  });

  it("answers 204 but records nothing elsewhere, for the smoke test or from another site", async () => {
    const { env, points } = dataset();
    const body = { path: "/react/install" };
    for (const req of [
      post("http://127.0.0.1:4560/_/t", body),
      post("https://pr-12.lunarhue-forms-docs.pages.dev/_/t", body),
      post("https://forms.lunarhue.dev/_/t", body, { "user-agent": "forms-docs-smoke" }),
      post("https://forms.lunarhue.dev/_/t", body, { origin: "https://evil.example" }),
    ]) {
      expect((await track(context(req, env))).status).toBe(204);
    }
    expect(points).toEqual([]);
    // Without the binding there is nowhere to write.
    expect((await track(context(post("https://forms.lunarhue.dev/_/t", body), {}))).status).toBe(204);
  });

  it("rejects bad bodies and other methods", async () => {
    const { env, points } = dataset();
    expect((await track(context(post("https://forms.lunarhue.dev/_/t", "{not json"), env))).status).toBe(400);
    expect((await track(context(post("https://forms.lunarhue.dev/_/t", { path: "nope" }), env))).status).toBe(400);
    const big = { path: "/react/install", referrer: `https://x.dev/${"a".repeat(3000)}` };
    expect((await track(context(post("https://forms.lunarhue.dev/_/t", big), env))).status).toBe(400);
    const get = await track(context(request("https://forms.lunarhue.dev/_/t"), env));
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    expect(points).toEqual([]);
  });
});

describe("middleware", () => {
  it("passes pages and other methods straight through", async () => {
    const { env, points } = dataset();
    for (const req of [
      request("https://forms.lunarhue.dev/react/install"),
      request("https://forms.lunarhue.dev/_/t", { method: "POST", body: "{}" }),
      request("https://forms.lunarhue.dev/llms.txt", { method: "HEAD" }),
    ]) {
      const served = new Response("page");
      const ctx = context(req, env, served);
      expect(await middleware(ctx)).toBe(served);
      expect(ctx.next).toHaveBeenCalledOnce();
    }
    expect(points).toEqual([]);
  });

  it("records a served agent file on a public site", async () => {
    const { env, points } = dataset();
    const req = request(
      "https://forms.lunarhue.dev/react/introduction.md?x=1",
      { headers: { "user-agent": "Claude-User/1.0", referer: "https://claude.ai/chat/123" } },
      "jp",
    );
    const served = new Response("# Introduction");
    expect(await middleware(context(req, env, served))).toBe(served);
    expect(points).toEqual([
      {
        indexes: ["release"],
        blobs: ["agent_fetch", "/react/introduction.md", "react", "claude.ai", "JP", "claude", "forms.lunarhue.dev"],
        doubles: [200],
      },
    ]);
  });

  it("names the copy button", async () => {
    const { env, points } = dataset();
    const req = request("https://next.forms.lunarhue.dev/errors.md", { headers: { "sec-fetch-site": "same-origin" } });
    await middleware(context(req, env));
    expect(points[0]?.blobs?.[5]).toBe("browser-copy");
    expect(points[0]?.blobs?.[2]).toBe("");
  });

  it("skips misses, other hosts and the smoke test", async () => {
    const { env, points } = dataset();
    await middleware(context(request("https://forms.lunarhue.dev/react/nope.md"), env, new Response("", { status: 404 })));
    await middleware(context(request("https://release-candidate.lunarhue-forms-docs.pages.dev/llms.txt"), env));
    await middleware(context(request("https://forms.lunarhue.dev/llms.txt", { headers: { "user-agent": "forms-docs-smoke" } }), env));
    expect(points).toEqual([]);
  });

  it("serves the file when the write throws", async () => {
    const env: PagesEnv = {
      DOCS_ANALYTICS: {
        writeDataPoint: () => {
          throw new Error("down");
        },
      },
    };
    const served = new Response("index");
    expect(await middleware(context(request("https://forms.lunarhue.dev/llms.txt"), env, served))).toBe(served);
  });
});

describe("pageview tracker", () => {
  let beacons: { url: string; body: Blob }[];

  const sent = async () => Promise.all(beacons.map(async ({ body }): Promise<unknown> => JSON.parse(await body.text())));

  beforeEach(() => {
    beacons = [];
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: (url: string, body: Blob) => {
        beacons.push({ url, body });
        return true;
      },
    });
    Object.defineProperty(document, "referrer", { configurable: true, value: "https://github.com/LunarHUE/forms" });
    delete root().dataset["status"];
    delete root().dataset["framework"];
    resetAnalyticsForTests();
    at("https://forms.lunarhue.dev/react/introduction");
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "sendBeacon");
    Reflect.deleteProperty(document, "referrer");
    vi.unstubAllGlobals();
  });

  it("reports page loads to /_/t, with the referrer on the first only", async () => {
    startAnalytics();
    startAnalytics();
    document.dispatchEvent(new Event("astro:page-load"));
    at("https://forms.lunarhue.dev/react/install");
    document.dispatchEvent(new Event("astro:page-load"));
    expect(beacons.map(({ url }) => url)).toEqual(["/_/t", "/_/t"]);
    expect(beacons[0]?.body.type).toBe("application/json");
    const [first, second] = await sent();
    expect(first).toEqual({
      path: "/react/introduction",
      framework: "react",
      referrer: "https://github.com",
      status: 200,
      device: expect.stringMatching(/^(desktop|mobile)$/),
    });
    expect(second).toMatchObject({ path: "/react/install", referrer: "" });
  });

  it("skips other hosts, the redirect at / and a repeat of the same page", () => {
    at("http://127.0.0.1:4560/react/introduction");
    trackPageview();
    at("https://pr-3.lunarhue-forms-docs.pages.dev/react/introduction");
    trackPageview();
    at("https://forms.lunarhue.dev/");
    trackPageview();
    expect(beacons).toEqual([]);
    at("https://next.forms.lunarhue.dev/solid/install");
    trackPageview();
    trackPageview();
    expect(beacons).toHaveLength(1);
  });

  it("reports the 404 page and the page's framework", async () => {
    root().dataset["status"] = "404";
    root().dataset["framework"] = "solid";
    at("https://forms.lunarhue.dev/errors/nope");
    trackPageview();
    expect(await sent()).toEqual([
      expect.objectContaining({ path: "/errors/nope", framework: "solid", status: 404 }),
    ]);
  });

  it("falls back to fetch without sendBeacon", () => {
    Reflect.deleteProperty(navigator, "sendBeacon");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    trackPageview();
    expect(fetch).toHaveBeenCalledWith(
      "/_/t",
      expect.objectContaining({ method: "POST", keepalive: true, headers: { "content-type": "application/json" } }),
    );
  });

  it("stays silent when sending fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: () => {
        throw new TypeError("blocked");
      },
    });
    vi.stubGlobal("fetch", async () => Promise.reject(new TypeError("offline")));
    expect(() => trackPageview()).not.toThrow();
    at("https://forms.lunarhue.dev/react/install");
    vi.stubGlobal("fetch", () => {
      throw new TypeError("no fetch");
    });
    expect(() => trackPageview()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
