import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createForms,
  elementsOf,
  fieldOf,
  type FormOf,
  type HandleLike,
  inputProps,
  isFocused,
  radioProps,
  trackElements,
  useField,
  useFieldRef,
  useForm,
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
      <input aria-label="bio text" />
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
  const name = inputProps(useField(root.at("name")));
  const free = radioProps(useField(root.at("plan")), "free");
  const pro = radioProps(useField(root.at("plan")), "pro");
  const team = radioProps(useField(root.at("plan")), "team");
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
  vi.unstubAllGlobals();
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

describe("isFocused", () => {
  it("is true for the field whose input has focus", () => {
    render(<Profile />);
    const root = current().root;
    screen.getByLabelText("pro").focus();
    expect(isFocused(root.at("plan"))).toBe(true);
    expect(isFocused(root.at("name"))).toBe(false);
    expect(isFocused(root.at("bio"))).toBe(false);
  });

  it("is true while focus is inside a custom input's element", () => {
    render(<Profile />);
    screen.getByLabelText("bio text").focus();
    expect(isFocused(current().root.at("bio"))).toBe(true);
    expect(isFocused(current().root.at("name"))).toBe(false);
  });

  it("is false once focus leaves", () => {
    render(<Profile />);
    const name = screen.getByLabelText("name");
    name.focus();
    name.blur();
    expect(isFocused(current().root.at("name"))).toBe(false);
    expect(isFocused(current().root)).toBe(false);
  });

  it("is false after the focused element unmounts", () => {
    const { rerender } = render(<Profile early />);
    const plan = current().root.at("plan");
    screen.getByLabelText("team").focus();
    expect(isFocused(plan)).toBe(true);
    rerender(<Profile />);
    expect(isFocused(plan)).toBe(false);
  });

  it("works in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<Profile />);
    screen.getByLabelText("bio text").focus();
    expect(isFocused(current().root.at("bio"))).toBe(true);
  });

  it("is false with no document", () => {
    render(<Profile />);
    const name = current().root.at("name");
    screen.getByLabelText("name").focus();
    vi.stubGlobal("document", undefined);
    expect(isFocused(name)).toBe(false);
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
