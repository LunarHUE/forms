import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

export const BEACON_URL = "https://static.cloudflareinsights.com/beacon.min.js";

export interface FetchBeaconOptions {
  /** Defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Tries before giving up, 3 by default. */
  attempts?: number;
  /** Waits between tries, a second times the try number by default. */
  wait?: (ms: number) => Promise<void>;
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function download(fetcher: typeof globalThis.fetch): Promise<string> {
  const response = await fetcher(BEACON_URL);
  if (!response.ok) throw new Error(`${BEACON_URL} answered ${response.status}`);
  const script = await response.text();
  if (script.trim() === "") throw new Error(`${BEACON_URL} was empty`);
  return script;
}

/**
 * Downloads Cloudflare Web Analytics' beacon to `outputPath`, trying again on
 * failure, and returns its size in bytes. Throws once every try has failed.
 */
export async function fetchBeacon(outputPath: string, options: FetchBeaconOptions = {}): Promise<number> {
  const { fetch: fetcher = globalThis.fetch, attempts = 3, wait = sleep } = options;
  let failure: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const script = await download(fetcher);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, script);
      return Buffer.byteLength(script);
    } catch (error) {
      failure = error;
      if (attempt < attempts) await wait(1000 * attempt);
    }
  }
  throw new Error(`Cloudflare beacon: ${String(failure)}`, { cause: failure });
}

/**
 * Copies Cloudflare Web Analytics' beacon into `dist/_/b.js` once Astro has
 * written the site, so it loads from the site itself (Layout.astro). Without
 * a token the layout leaves the beacon out and this fetches nothing, which
 * keeps local, test and preview builds offline.
 *
 * `public/_routes.json` doesn't send `/_/b.js` to Functions, so Pages serves
 * it as a static file.
 */
export function cfBeacon(token: string, options: FetchBeaconOptions = {}): AstroIntegration {
  if (token === "") return { name: "forms:cf-beacon", hooks: {} };
  return {
    name: "forms:cf-beacon",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outputPath = join(fileURLToPath(dir), "_", "b.js");
        const bytes = await fetchBeacon(outputPath, options);
        logger.info(`Wrote ${bytes} bytes to ${outputPath}`);
      },
    },
  };
}
