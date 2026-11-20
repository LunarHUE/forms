import { describe, expect, it } from "vitest";
import { trackElements, trackedField } from "./elements.js";
import { createFormsCore } from "./forms-core.js";
import { tracking } from "./store/elements.js";

const store = createFormsCore().define({ defaultValues: { name: "", age: 0 } }).createStore();
const name = store.root.at("name");
const age = store.root.at("age");

type Event = [element: object, key: object, added: boolean, adapter: string];

/** Reports an element the way an adapter's ref does. */
const record = (...event: Event): void => tracking.record?.(...event);

describe("trackElements", () => {
  // First, since the slot stays set once a test calls `trackElements`.
  it("leaves the slot empty until it runs", () => {
    expect("record" in tracking).toBe(false);
    expect(trackedField({})).toBeUndefined();
  });

  it("maps an element to the handle its ref recorded, and forgets it", () => {
    trackElements();
    const element = {};
    record(element, name, true, "react");
    expect(trackedField(element)).toBe(name);
    record(element, name, false, "react");
    expect(trackedField(element)).toBeUndefined();
  });

  it("keeps a newer handle when an older one forgets the element", () => {
    trackElements();
    const element = {};
    record(element, name, true, "react");
    record(element, age, true, "react");
    record(element, name, false, "react");
    expect(trackedField(element)).toBe(age);
  });

  it("passes store keys to listeners without mapping them", () => {
    const events: Event[] = [];
    trackElements((...event) => events.push(event));
    const form = {};
    record(form, store, true, "solid");
    expect(trackedField(form)).toBeUndefined();
    expect(events).toEqual([[form, store, true, "solid"]]);
  });

  it("gives every listener every event", () => {
    const first: Event[] = [];
    const second: Event[] = [];
    trackElements((...event) => first.push(event));
    trackElements((...event) => second.push(event));
    const element = {};
    record(element, name, true, "react");
    record(element, name, false, "react");
    expect(first).toEqual([
      [element, name, true, "react"],
      [element, name, false, "react"],
    ]);
    expect(second).toEqual(first);
  });
});
