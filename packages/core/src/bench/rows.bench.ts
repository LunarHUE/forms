import { test } from "vitest";
import { keystroke, rowsForm } from "./rows.js";

// Run with `bun run bench`. `vitest run` leaves bench files out.
for (const count of [200, 1000]) {
  test(`${count} rows`, async ({ bench }) => {
    const form = rowsForm(count);
    let flip = false;
    // Async with one awaited microtask, like the solid-form benchmark, so both measure the same shape.
    await bench(`keystroke, schema run and listeners (${count} rows)`, async () => {
      flip = !flip;
      keystroke(form, flip ? "" : "x");
      await Promise.resolve();
    }).run();
    form.dispose();
  });
}
