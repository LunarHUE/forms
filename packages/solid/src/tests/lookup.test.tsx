import { createSignal, Show } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createForm, createForms, createInputProps, elementsOf, fieldOf, fieldRef, type FormOf } from "../index.js";
import { get, getAs, mount, settle } from "./dom.js";

const forms = createForms();
const Profile = forms.define({ defaultValues: { name: "", plan: "free", bio: "" } });

/**
 * A text input, a radio group whose "team" option shows on demand ahead of
 * the others, and a custom input that registers its outer element with
 * `fieldRef`.
 */
function mountProfile() {
  const [early, setEarly] = createSignal(false);
  let form: FormOf<typeof Profile> | undefined;
  const { host } = mount(() => {
    const f = createForm(Profile, { id: "profile" });
    form = f;
    const plan = f.root.at("plan");
    return (
      <form data-form {...f.formProps}>
        <Show when={early()}>
          <input data-plan="team" {...createInputProps(plan, { kind: "radio", value: "team" })} />
        </Show>
        <input data-name {...createInputProps(f.root.at("name"))} />
        <input data-plan="free" {...createInputProps(plan, { kind: "radio", value: "free" })} />
        <input data-plan="pro" {...createInputProps(plan, { kind: "radio", value: "pro" })} />
        <div data-bio ref={fieldRef(f.root.at("bio"))}>
          <span data-bio-inner>bio</span>
        </div>
      </form>
    );
  });
  if (!form) throw new Error("The form was not created.");
  return { form, host, setEarly };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fieldOf", () => {
  it("returns the handle of each element a field's ref got", () => {
    const { form, host } = mountProfile();
    expect(fieldOf(get(host, "[data-name]"))).toBe(form.root.at("name"));
    expect(fieldOf(get(host, '[data-plan="free"]'))).toBe(form.root.at("plan"));
    expect(fieldOf(get(host, '[data-plan="pro"]'))).toBe(form.store.fieldAt(["plan"]));
  });

  it("finds a custom input registered with fieldRef, but not from inside it", () => {
    const { form, host } = mountProfile();
    expect(fieldOf(getAs(host, "[data-bio]", HTMLDivElement))).toBe(form.root.at("bio"));
    expect(fieldOf(getAs(host, "[data-bio-inner]", HTMLSpanElement))).toBeUndefined();
  });

  it("returns undefined for the form element", () => {
    const { host } = mountProfile();
    expect(fieldOf(getAs(host, "[data-form]", HTMLFormElement))).toBeUndefined();
  });

  it("forgets an element once its owner is disposed", async () => {
    const { host, setEarly } = mountProfile();
    setEarly(true);
    await settle();
    const team = get(host, '[data-plan="team"]');
    expect(fieldOf(team)).toBeDefined();
    setEarly(false);
    await settle();
    expect(fieldOf(team)).toBeUndefined();
  });

  it("returns undefined in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { host } = mountProfile();
    expect(fieldOf(get(host, "[data-name]"))).toBeUndefined();
  });
});

describe("elementsOf", () => {
  it("lists a field's connected elements in document order", async () => {
    const { form, host, setEarly } = mountProfile();
    const plan = form.root.at("plan");
    const option = (value: string) => get(host, `[data-plan="${value}"]`);
    expect(elementsOf(plan)).toEqual([option("free"), option("pro")]);
    // Registered last, but first in the document.
    setEarly(true);
    await settle();
    expect(elementsOf(plan)).toEqual([option("team"), option("free"), option("pro")]);
    setEarly(false);
    await settle();
    expect(elementsOf(plan)).toEqual([option("free"), option("pro")]);
  });

  it("works in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { form, host } = mountProfile();
    expect(elementsOf(form.root.at("name"))).toEqual([get(host, "[data-name]")]);
  });
});
