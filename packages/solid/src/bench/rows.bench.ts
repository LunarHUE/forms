import { test } from "vitest";
import { keystroke, rowsForm } from "./rows.js";

for (const count of [200, 1000]) {
  test(`${count} rows`, async ({ bench }) => {
    const form = rowsForm(count);
    let flip = false;
    await bench(`keystroke, schema run and effects (${count} rows)`, async () => {
      flip = !flip;
      await keystroke(form, flip ? "" : "x");
    }).run();
    form.dispose();
  });
}
