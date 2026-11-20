import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createForms,
  elementsOf,
  fieldOf,
  type FormOf,
  type HandleLike,
  trackElements,
  useFieldRef,
  useForm,
  useInputProps,
} from "./index.js";

const forms = createForms();
const profile = forms.define({ defaultValues: { name: "", plan: "free", bio: "" } });

const holder: { form?: FormOf<typeof profile> } = {};
const current = (): FormOf<typeof profile> => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

/** A custom input that registers its outer element through `useFieldRef`. */
function Bio({ handle }: { readonly handle: HandleLike }) {
  const ref = useFieldRef(handle);
  return (
    <div data-testid="bio" ref={ref}>
      <span data-testid="bio-inner">bio</span>
    </div>
  );
}

/** `early` shows a "team" option ahead of the others. */
function Profile({ early }: { readonly early?: boolean }) {
  const form = useForm(profile, { id: "profile" });
  useEffect(() => {
    holder.form = form;
  });
  const root = form.root;
  const name = useInputProps(root.at("name"));
  const free = useInputProps(root.at("plan"), { kind: "radio", value: "free" });
  const pro = useInputProps(root.at("plan"), { kind: "radio", value: "pro" });
  const team = useInputProps(root.at("plan"), { kind: "radio", value: "team" });
  return (
    <form.Form>
      {(formProps) => (
        <form data-testid="form" {...formProps}>
          {early ? <input aria-label="team" {...team} /> : null}
          <input aria-label="name" {...name} />
          <input aria-label="free" {...free} />
          <input aria-label="pro" {...pro} />
          <Bio handle={root.at("bio")} />
        </form>
      )}
    </form.Form>
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fieldOf", () => {
  it("returns the handle of each element a field's ref got", () => {
    render(<Profile />);
    const root = current().root;
    expect(fieldOf(screen.getByLabelText("name"))).toBe(root.at("name"));
    expect(fieldOf(screen.getByLabelText("free"))).toBe(root.at("plan"));
    expect(fieldOf(screen.getByLabelText("pro"))).toBe(current().store.fieldAt(["plan"]));
  });

  it("finds a custom input registered with useFieldRef, but not from inside it", () => {
    render(<Profile />);
    expect(fieldOf(screen.getByTestId("bio"))).toBe(current().root.at("bio"));
    expect(fieldOf(screen.getByTestId("bio-inner"))).toBeUndefined();
  });

  it("returns undefined for the form element", () => {
    render(<Profile />);
    expect(fieldOf(screen.getByTestId("form"))).toBeUndefined();
  });

  it("returns undefined in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<Profile />);
    expect(fieldOf(screen.getByLabelText("name"))).toBeUndefined();
  });
});

describe("elementsOf", () => {
  it("lists a field's connected elements in document order", () => {
    const { rerender } = render(<Profile />);
    const plan = current().root.at("plan");
    expect(elementsOf(plan)).toEqual([screen.getByLabelText("free"), screen.getByLabelText("pro")]);
    // Mounted last, but first in the document.
    rerender(<Profile early />);
    expect(elementsOf(plan)).toEqual([screen.getByLabelText("team"), screen.getByLabelText("free"), screen.getByLabelText("pro")]);
    rerender(<Profile />);
    expect(elementsOf(plan)).toEqual([screen.getByLabelText("free"), screen.getByLabelText("pro")]);
  });

  it("works in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<Profile />);
    expect(elementsOf(current().root.at("name"))).toEqual([screen.getByLabelText("name")]);
  });
});

// Last, since tracking stays on once `trackElements` runs.
describe("trackElements", () => {
  type Event = [element: object, key: object, added: boolean, adapter: string];
  const events: Event[] = [];

  it("lets fieldOf find fields in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    trackElements((...event) => events.push(event));
    render(<Profile />);
    expect(fieldOf(screen.getByLabelText("name"))).toBe(current().root.at("name"));
    expect(fieldOf(screen.getByLabelText("pro"))).toBe(current().root.at("plan"));
    expect(fieldOf(screen.getByTestId("bio"))).toBe(current().root.at("bio"));
    expect(fieldOf(screen.getByTestId("form"))).toBeUndefined();
  });

  it("reports the form element with its store as the key", () => {
    events.length = 0;
    render(<Profile />);
    expect(events).toContainEqual([screen.getByTestId("form"), current().store, true, "react"]);
    expect(events).toContainEqual([screen.getByLabelText("name"), current().root.at("name"), true, "react"]);
  });

  it("reports an element that unmounts, and fieldOf forgets it", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { rerender } = render(<Profile early />);
    const team = screen.getByLabelText("team");
    const plan = current().root.at("plan");
    expect(fieldOf(team)).toBe(plan);
    events.length = 0;
    rerender(<Profile />);
    expect(events).toEqual([[team, plan, false, "react"]]);
    expect(fieldOf(team)).toBeUndefined();
  });
});
