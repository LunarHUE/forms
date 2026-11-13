import { describe, expect, it } from "vitest";
import { createKeyList, hadKey, indexOfKey, initialIndex, insertKey, keysView, moveKey, removeKey, resizeKeys } from "./keys.js";

describe("key lists", () => {
  it("keys items positionally at creation, then by counter", () => {
    const list = createKeyList(2);
    expect(list.keys).toEqual(["k0", "k1"]);
    insertKey(list, 2);
    expect(list.keys).toEqual(["k0", "k1", "k2"]);
    removeKey(list, 2);
    insertKey(list, 2);
    expect(list.keys).toEqual(["k0", "k1", "k3"]);
  });

  it("keeps keys with their items through remove, insert and move", () => {
    const list = createKeyList(3);
    removeKey(list, 0);
    insertKey(list, 0);
    moveKey(list, 2, 0);
    expect(list.keys).toEqual(["k2", "k3", "k1"]);
    expect(indexOfKey(list, "k1")).toBe(2);
    expect(indexOfKey(list, "k0")).toBe(-1);
  });

  it("re-keys by position when the whole array is replaced", () => {
    const list = createKeyList(2);
    expect(resizeKeys(list, 1)).toEqual(["k1"]);
    expect(list.keys).toEqual(["k0"]);
    expect(resizeKeys(list, 2)).toEqual([]);
    expect(list.keys).toEqual(["k0", "k2"]);
  });

  it("gives two lists made from the same length the same keys", () => {
    expect(createKeyList(3).keys).toEqual(createKeyList(3).keys);
  });

  it("hands out the same view until the list changes", () => {
    const list = createKeyList(2);
    const view = keysView(list);
    expect(keysView(list)).toBe(view);
    resizeKeys(list, 2);
    expect(keysView(list)).toBe(view);
    insertKey(list, 0);
    expect(keysView(list)).not.toBe(view);
    expect(view).toEqual(["k0", "k1"]);
  });

  it("knows every key a list has handed out, including removed ones", () => {
    const list = createKeyList(2);
    removeKey(list, 1);
    insertKey(list, 1);
    expect(list.keys).toEqual(["k0", "k2"]);
    expect(["k0", "k1", "k2"].map((key) => hadKey(list, key, 0))).toEqual([true, true, true]);
    expect(hadKey(list, "k3", 9)).toBe(false);
    expect(hadKey(list, "k01", 9)).toBe(false);
    expect(hadKey(undefined, "k1", 2)).toBe(true);
    expect(hadKey(undefined, "k2", 2)).toBe(false);
    expect(hadKey(undefined, "x", 2)).toBe(false);
  });

  it("maps a creation key back to its index", () => {
    expect(initialIndex("k1", 2)).toBe(1);
    expect(initialIndex("k2", 2)).toBe(-1);
    expect(initialIndex("k01", 5)).toBe(-1);
    expect(initialIndex("x", 5)).toBe(-1);
  });
});
