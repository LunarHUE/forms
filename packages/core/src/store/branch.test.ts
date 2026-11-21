import { describe, expect, it } from "vitest";
import type { NamedObjectHandle } from "../handle.js";
import { branch } from "./branch.js";
import { createFormStore } from "./form-store.js";

type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

const make = (initial: Shape) => createFormStore<{ shape: Shape }>({ id: "f", initial: { shape: initial } });

describe("branch", () => {
  it("returns the same handle when the snapshot holds the value at the key", () => {
    const store = make({ kind: "circle", radius: 1 });
    const shape: NamedObjectHandle<Shape> = store.root.at("shape");
    expect(branch(shape, shape.peek(), "kind", "circle")).toBe(shape);
  });

  it("returns undefined when it doesn't", () => {
    const store = make({ kind: "square", side: 1 });
    const shape = store.root.at("shape");
    expect(branch(shape, shape.peek(), "kind", "circle")).toBeUndefined();
  });

  it("reads only the snapshot it is given", () => {
    const store = make({ kind: "circle", radius: 1 });
    const shape = store.root.at("shape");
    const snapshot = shape.peek();
    shape.setValue({ kind: "square", side: 2 }, { replace: true });
    expect(branch(shape, snapshot, "kind", "circle")).toBe(shape);
  });
});
