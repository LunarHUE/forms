import { describe, expect, it } from "vitest";
import { keystroke, rowsForm } from "./rows.js";

describe("keystroke cost", () => {
  it("wakes only the edited row's listener at 3000 rows", () => {
    const form = rowsForm(3000);
    keystroke(form, "");
    expect(form.store.getSnapshot(form.first.path).errors).toEqual([{ message: "Required" }]);
    expect(form.runs.errors).toBe(1);
    keystroke(form, "x");
    expect(form.store.getSnapshot(form.first.path).errors).toEqual([]);
    expect(form.runs.errors).toBe(2);
    form.dispose();
  });
});
