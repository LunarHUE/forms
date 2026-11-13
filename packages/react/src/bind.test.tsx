import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createForms, type FieldApi, useForm } from "./index.js";
import { bind, type BindOptions } from "./plugins/bind.js";
import { type Rebase, rebase } from "./plugins/rebase.js";

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

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return <input aria-label={label} {...field.inputProps()} />;
}

const forms = createForms({ fields: { TextField } });
const profile = forms.define({ defaultValues: { name: "default" } });

interface BoundProps {
  readonly store: Outside;
  readonly label: string;
}

function Bound({ store, label }: BoundProps) {
  const form = useForm(profile, { id: label, plugins: [bind(store)] });
  return <form.TextField name="name" label={label} />;
}

function Rebased() {
  const form = useForm(profile, { plugins: [rebase()] });
  expectTypeOf(form.plugins.rebase).toEqualTypeOf<Rebase>();
  return <p>{typeof form.plugins.rebase}</p>;
}

function Wrong() {
  const numbers = { get: () => ({ name: 1 }), set: () => {}, subscribe: () => () => {} };
  // @ts-expect-error The store holds `{ name: number }`, the form `{ name: string }`.
  useForm(profile, { plugins: [bind(numbers)] });
  return null;
}

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

describe("instance plugins", () => {
  it("bind two forms of one definition to two stores", () => {
    const one = outside({ name: "one" });
    const two = outside({ name: "two" });
    render(
      <StrictMode>
        <Bound store={one} label="first" />
        <Bound store={two} label="second" />
      </StrictMode>,
    );
    expect(input("first").value).toBe("one");
    expect(input("second").value).toBe("two");

    fireEvent.change(input("first"), { target: { value: "typed" } });
    expect(one.state).toEqual({ name: "typed" });
    expect(two.state).toEqual({ name: "two" });

    act(() => two.change({ name: "from outside" }));
    expect(input("second").value).toBe("from outside");
    expect(input("first").value).toBe("typed");
  });

  it("read the list once and leave no outside listener after unmount", () => {
    const one = outside({ name: "one" });
    const other = outside({ name: "other" });
    const { rerender, unmount } = render(
      <StrictMode>
        <Bound store={one} label="name" />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <Bound store={other} label="name" />
      </StrictMode>,
    );
    expect(input("name").value).toBe("one");
    expect(other.listeners.size).toBe(0);
    // StrictMode made a second store that nothing listens to. Only the mounted one listens.
    expect(one.listeners.size).toBe(1);
    unmount();
    expect(one.listeners.size).toBe(0);
  });

  it("put their APIs on form.plugins", () => {
    render(<Rebased />);
    expect(screen.getByText("function")).toBeTruthy();
  });

  it("must name the form's value type", () => {
    expectTypeOf(Wrong).toBeFunction();
  });
});

describe("server rendering with bind", () => {
  it('renders the defaults with initial "outside", hydrates without a mismatch, then shows the outside value', async () => {
    // Writes made in plugin setup don't reach the server snapshot, so the
    // server HTML and the hydrating render show the definition's defaults.
    const server = outside({ name: "outside" });
    const html = renderToString(<Bound store={server} label="name" />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    expect(container.querySelector("input")?.value).toBe("default");
    expect(server.listeners.size).toBe(0);

    const client = outside({ name: "outside" });
    const errors = vi.spyOn(console, "error");
    const recoverable = vi.fn<(error: unknown) => void>();
    await act(async () => {
      hydrateRoot(container, <Bound store={client} label="name" />, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect(container.querySelector("input")?.value).toBe("outside");
    expect(client.listeners.size).toBe(1);
    container.remove();
  });
});
