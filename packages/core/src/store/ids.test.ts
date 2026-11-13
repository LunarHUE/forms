import { describe, expect, it } from "vitest";
import { encodeSegment, errorId, fieldId, optionId } from "./ids.js";

describe("ids", () => {
  it("keeps a dotted key apart from the nested path", () => {
    const dotted = fieldId("f", ["values", "services.k3s.enable"]);
    const nested = fieldId("f", ["values", "services", "k3s", "enable"]);
    expect(dotted).toBe("f--values--services_2e_k3s_2e_enable");
    expect(dotted).not.toBe(nested);
  });

  it("can't forge an escape or a join", () => {
    expect(fieldId("f", ["a_2e_b"])).not.toBe(fieldId("f", ["a.b"]));
    expect(fieldId("f", ["a--b"])).not.toBe(fieldId("f", ["a", "b"]));
    expect(fieldId("f", ["a-"])).not.toBe(fieldId("f", ["a", ""]));
  });

  it("passes plain keys and single hyphens through", () => {
    expect(encodeSegment("k3s-enable")).toBe("k3s-enable");
    expect(encodeSegment("-x")).toBe("_2d_x");
    expect(encodeSegment("é")).toBe("_e9_");
    expect(fieldId("form", [])).toBe("form");
  });

  it("builds option and error ids after a `---`", () => {
    const id = fieldId("f", ["plan"]);
    expect(optionId(id, "pro")).toBe("f--plan---option-pro");
    expect(optionId(id, 0)).toBe("f--plan---option-0");
    expect(optionId(id, "a b--c")).toBe("f--plan---option-a_20_b_2d__2d_c");
    expect(errorId(id)).toBe("f--plan---error");
  });

  it("keeps option ids apart from error ids and field ids", () => {
    const id = fieldId("f", ["tags"]);
    expect(optionId(id, "error")).not.toBe(errorId(id));
    for (const key of ["0", "error", "option-0", "-x"]) {
      expect(optionId(id, key)).not.toBe(fieldId("f", ["tags", key]));
    }
    expect(fieldId("f", ["tags", "-error"])).not.toContain("---");
  });
});
