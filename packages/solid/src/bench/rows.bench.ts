import { test } from "vitest";
import { keystroke, rowsForm } from "./rows.js";

for (const count of [200, 1000]) {
  for (const bridge of ["signal", "adapter"] as const) {
    test(`${count} rows, ${bridge} bridge`, async ({ bench }) => {
      const form = rowsForm(count, bridge);
      let flip = false;
      await bench(`keystroke, schema run and effects (${count} rows, ${bridge} bridge)`, async () => {
        flip = !flip;
        await keystroke(form, flip ? "" : "x");
      }).run();
      form.dispose();
    });
  }
}
