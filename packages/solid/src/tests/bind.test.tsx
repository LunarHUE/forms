import { describe, expect, expectTypeOf, it } from "vitest";
import { createForm, createForms, inputProps } from "../index.js";
import { bind, type BindOptions } from "../plugins/bind.js";
import { type Rebase, rebase } from "../plugins/rebase.js";
import { get, mount, settle, typeText } from "./dom.js";

interface Profile {
  name: string;
}

/** A store the app owns. */
interface Outside extends BindOptions<Profile> {
  state: Profile;
  readonly listeners: Set<() => void>;
  change(next: Profile): void;
}

function outside(state: Profile): Outside {
  const listeners = new Set<() => void>();
  const box: Outside = {
    state,
    listeners,
    change(next) {
      box.state = next;
      for (const listener of listeners) listener();
    },
    get: () => box.state,
    set: (value) => box.change(value),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return box;
}

const Profile = createForms().define({ defaultValues: { name: "default" } });

interface BoundProps {
  readonly store: Outside;
  readonly label: string;
}

function Bound(props: BoundProps) {
  const form = createForm(Profile, { plugins: [bind(props.store)] });
  return <form.Field name="name">{(field) => <input aria-label={props.label} {...inputProps(field)} />}</form.Field>;
}

function Wrong() {
  const numbers = { get: () => ({ name: 1 }), set: () => {}, subscribe: () => () => {} };
  // @ts-expect-error The store holds `{ name: number }`, the form `{ name: string }`.
  createForm(Profile, { plugins: [bind(numbers)] });
  return null;
}

describe("instance plugins", () => {
  it("bind two forms of one definition to two stores", async () => {
    const one = outside({ name: "one" });
    const two = outside({ name: "two" });
    const { host, dispose } = mount(() => (
      <>
        <Bound store={one} label="first" />
        <Bound store={two} label="second" />
      </>
    ));
    const first = get(host, "[aria-label=first]");
    const second = get(host, "[aria-label=second]");
    expect(first.value).toBe("one");
    expect(second.value).toBe("two");

    typeText(first, "typed");
    await settle();
    expect(one.state).toEqual({ name: "typed" });
    expect(two.state).toEqual({ name: "two" });

    two.change({ name: "from outside" });
    await settle();
    expect(second.value).toBe("from outside");
    expect(first.value).toBe("typed");

    dispose();
    expect(one.listeners.size).toBe(0);
    expect(two.listeners.size).toBe(0);
  });

  it("put their APIs on form.plugins", () => {
    let api: Rebase | undefined;
    function Rebased() {
      const form = createForm(Profile, { plugins: [rebase()] });
      expectTypeOf(form.plugins.rebase).toEqualTypeOf<Rebase>();
      api = form.plugins.rebase;
      return null;
    }
    mount(() => <Rebased />);
    expect(api).toBeTypeOf("function");
  });

  it("must name the form's value type", () => {
    expectTypeOf(Wrong).toBeFunction();
  });
});
