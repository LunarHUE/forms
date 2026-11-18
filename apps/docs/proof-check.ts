// Throwaway check for item 0.2. Run against `astro preview` or `astro dev`.
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4411";
const browser = await chromium.launch();
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed = true;
};

for (const framework of ["react", "solid"]) {
  console.log(`--- ${framework}`);
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const scripts: { url: string; body: string }[] = [];
  page.on("response", async (r) => {
    if (r.request().resourceType() === "script") scripts.push({ url: r.url(), body: await r.text() });
  });

  await page.goto(`${base}/proof/${framework}`);
  const stage = page.locator("[data-stage]");
  await stage.locator("astro-island:not([ssr])").waitFor();
  const input = stage.locator("input[type=tel]");
  check((await input.inputValue()) === "", "starts empty");
  await input.pressSequentially("5551234567");
  check((await input.inputValue()) === "(555) 123-4567", `typed: ${await input.inputValue()}`);

  // Mark the live island so we can see it unmount and empty after reset.
  await page.evaluate(() => {
    const island = document.querySelector("[data-stage] astro-island")!;
    (window as any).oldIsland = island;
    island.addEventListener("astro:unmount", () => ((window as any).unmounted = true));
  });
  await page.click("[data-reset]");
  check(await page.evaluate(() => (window as any).unmounted === true), "old island got astro:unmount");
  check(
    await page.evaluate(() => (window as any).oldIsland.childElementCount === 0),
    "old island emptied by its renderer",
  );
  await stage.locator("astro-island:not([ssr])").waitFor();
  check(await page.evaluate(() => document.querySelector("[data-stage] astro-island") !== (window as any).oldIsland), "new island element");
  check((await input.inputValue()) === "", `after reset: "${await input.inputValue()}"`);
  await input.pressSequentially("5559876543");
  check((await input.inputValue()) === "(555) 987-6543", `typed after reset: ${await input.inputValue()}`);

  // Second reset, to rule out a one-shot fluke (Solid reuses the render id).
  await page.click("[data-reset]");
  await stage.locator("astro-island:not([ssr])").waitFor();
  await input.pressSequentially("555123");
  check((await input.inputValue()) === "(555) 123", `typed after 2nd reset: ${await input.inputValue()}`);

  await page.waitForTimeout(200);
  const hasReactDom = scripts.filter((s) => s.body.includes("hydrateRoot")).map((s) => s.url);
  const hasSolid = scripts.filter((s) => s.body.includes("_$HY") || s.body.includes("_hk")).map((s) => s.url);
  console.log("scripts:", scripts.map((s) => s.url.replace(base, "")).join(" "));
  if (framework === "react") check(hasSolid.length === 0, `no Solid chunk (${hasSolid.join(" ")})`);
  else check(hasReactDom.length === 0, `no React-DOM chunk (${hasReactDom.join(" ")})`);
  check(errors.length === 0, `no console errors/warnings ${errors.join(" | ")}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
