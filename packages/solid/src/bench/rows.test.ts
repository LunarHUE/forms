import { describe, expect, it } from "vitest";
import { keystroke, rowsForm } from "./rows.js";

describe("keystroke cost", () => {
  it("re-runs only the edited row's error effect at 3000 rows", async () => {
    const form = rowsForm(3000);
    await keystroke(form, "");
    expect(form.store.getSnapshot(form.first.path).errors).toEqual([{ message: "Required" }]);
    expect(form.runs.errors).toBe(1);
    form.dispose();
  });
});
