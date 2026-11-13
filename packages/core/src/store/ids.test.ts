import { describe, expect, it } from "vitest";
import { encodeSegment, fieldId } from "./ids.js";

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
});
