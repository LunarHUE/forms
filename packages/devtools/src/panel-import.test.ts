import { createFormsCore } from "@lunarhue/forms-core";
import { expect, it, vi } from "vitest";
import { devtools, syncDevtools } from "./index.js";

// In a file of its own, since the panel module is imported once per page.

const mounts = vi.hoisted(() => ({ imports: 0, mounted: 0, unmounted: 0 }));

vi.mock("./panel.js", () => {
  mounts.imports++;
  return {
    mount: () => {
      mounts.mounted++;
      return () => {
        mounts.unmounted++;
      };
    },
  };
});

/** Lets the panel's dynamic import settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("imports the panel the first time a form reads true, once per page", async () => {
  let on = false;
  const store = createFormsCore({ plugins: [devtools({ enabled: () => on })] }).define({ defaultValues: { name: "" } }).createStore();
  const off = store.subscribeForm(() => {});
  await settle();
  expect(mounts.imports).toBe(0);
  on = true;
  syncDevtools();
  await settle();
  expect(mounts).toEqual({ imports: 1, mounted: 1, unmounted: 0 });
  on = false;
  syncDevtools();
  expect(mounts.unmounted).toBe(1);
  on = true;
  syncDevtools();
  await settle();
  expect(mounts).toEqual({ imports: 1, mounted: 2, unmounted: 1 });
  off();
});
