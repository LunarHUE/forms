import { valibot } from "@lunarhue/forms-schema/valibot";
import { For } from "solid-js";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { createDisabledErrors, createForm, createForms, type FocusTarget, type FieldApi, type FormOf } from "../index.js";
import { get, getAs, mount, settle, typeText } from "./dom.js";

function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}

const forms = createForms({ plugins: [valibot()], fields: { TextField } });
const schema = v.object({
  title: v.pipe(v.string(), v.minLength(1, "Required")),
  body: v.pipe(v.string(), v.minLength(1, "Required")),
});
type Intent = "draft" | "publish" | undefined;

/** A post form whose `onSubmit` records what it got. */
function definePost() {
  const saved: { title: string; intent: Intent }[] = [];
  const Post = forms.define({
    schema,
    onSubmit: (value, ctx: { intent: Intent }) => {
      saved.push({ title: value.title, intent: ctx.intent });
      return value.title.length;
    },
  });
  return { Post, saved };
}

/** Mounts a post form inside its `form.Form`. */
function mountPost(focusOnInvalid?: (target: FocusTarget) => void) {
  const { Post, saved } = definePost();
  let form: FormOf<typeof Post> | undefined;
  const { host } = mount(() => {
    form = focusOnInvalid ? createForm(Post, { focusOnInvalid }) : createForm(Post);
    const f = form;
    const disabled = createDisabledErrors(f);
    return (
      <f.Form>
        {(props, owner) => (
          <form {...props}>
            <f.TextField name="title" label="Title" />
            <f.TextField name="body" label="Body" />
            <For each={disabled()}>{(entry) => <p class="disabled-error">{entry.name}</p>}</For>
            <button type="button" onClick={() => void owner.submit("publish")}>
              Publish
            </button>
          </form>
        )}
      </f.Form>
    );
  });
  if (!form) throw new Error("The form was not created.");
  return { form, host, saved };
}

describe("submit", () => {
  it("submits through the form element's submit event", async () => {
    const { form, host, saved } = mountPost();
    const formElement = getAs(host, "form", HTMLFormElement);
    expect(formElement.id).toBe(form.id);
    expect(formElement.noValidate).toBe(true);
    expect(formElement.getAttribute("tabindex")).toBe("-1");
    typeText(get(host, `[id="${form.root.at("title").id}"]`), "Hello");
    typeText(get(host, `[id="${form.root.at("body").id}"]`), "World");
    const event = new Event("submit", { bubbles: true, cancelable: true });
    formElement.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(form.store.peek().submission.status).toBe("succeeded"));
    expect(saved).toEqual([{ title: "Hello", intent: undefined }]);
  });

  it("passes the intent from submit, and reads state reactively", async () => {
    const { form, host, saved } = mountPost();
    form.root.at("title").setValue("Hi");
    form.root.at("body").setValue("There");
    getAs(host, "button", HTMLButtonElement).click();
    await vi.waitFor(() => expect(saved).toEqual([{ title: "Hi", intent: "publish" }]));
    const submission = await form.submit("draft");
    expect(submission).toEqual({ status: "succeeded", result: 2 });
    expect(form.state.submitCount).toBe(2);
  });

  it("focuses the first invalid field after an invalid submit", async () => {
    const { form, host } = mountPost();
    form.root.at("title").setValue("Set");
    await form.handleSubmit();
    expect(form.store.peek().submission.status).toBe("invalid");
    expect(document.activeElement).toBe(get(host, `[id="${form.root.at("body").id}"]`));
  });

  it("focuses the form element when only disabled fields are invalid, and lists them", async () => {
    const { form, host } = mountPost();
    form.root.at("title").setValue("Set");
    form.root.at("body").setDisabled(true);
    await settle();
    expect(host.querySelectorAll(".disabled-error")).toHaveLength(0);

    const submission = await form.submit(undefined);
    await settle();
    expect(submission.status).toBe("invalid");
    expect(document.activeElement).toBe(getAs(host, "form", HTMLFormElement));
    expect([...host.querySelectorAll(".disabled-error")].map((p) => p.textContent)).toEqual(["body"]);

    // Enabling the field takes it off the list.
    form.root.at("body").setDisabled(false);
    await settle();
    expect(host.querySelectorAll(".disabled-error")).toHaveLength(0);
  });

  it("calls a focusOnInvalid function instead of focusing", async () => {
    const targets: FocusTarget[] = [];
    const { form, host } = mountPost((target) => targets.push(target));
    const before = document.activeElement;
    await form.handleSubmit();
    expect(document.activeElement).toBe(before);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.field).toBe(form.root.at("title"));
    expect(targets[0]?.element).toBe(get(host, `[id="${form.root.at("title").id}"]`));
    expect(targets[0]?.disabled).toEqual([]);
  });

  it("doesn't focus with focusOnInvalid false", async () => {
    const { Post } = definePost();
    let form: FormOf<typeof Post> | undefined;
    mount(() => {
      form = createForm(Post, { focusOnInvalid: false });
      const f = form;
      return (
        <form {...f.formProps}>
          <f.TextField name="title" label="Title" />
        </form>
      );
    });
    const before = document.activeElement;
    await form?.handleSubmit();
    expect(document.activeElement).toBe(before);
  });
});

describe("the form object with no form.Form", () => {
  it("renders fields, submits and focuses with formProps alone", async () => {
    const { Post, saved } = definePost();
    let form: FormOf<typeof Post> | undefined;
    const { host } = mount(() => {
      form = createForm(Post, { id: "standalone" });
      const f = form;
      return (
        <form {...f.formProps}>
          <f.TextField name="title" label="Title" />
          <f.Field name="body">{(field) => <textarea {...field.inputProps({ kind: "textarea" })} />}</f.Field>
          <output>{f.state.submission.status}</output>
        </form>
      );
    });
    if (!form) throw new Error("The form was not created.");
    expect(form.id).toBe("standalone");
    expect(get(host, "input").id).toBe(form.root.at("title").id);
    expect(form.root.at("title").id.startsWith("standalone")).toBe(true);
    await form.handleSubmit();
    await settle();
    expect(document.activeElement).toBe(get(host, "input"));
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("invalid");
    typeText(get(host, "input"), "T");
    typeText(getAs(host, "textarea", HTMLTextAreaElement), "B");
    await form.handleSubmit();
    await settle();
    expect(saved).toEqual([{ title: "T", intent: undefined }]);
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("succeeded");
  });

  it("keeps every member's identity", () => {
    const { Post } = definePost();
    let first: unknown[] = [];
    let second: unknown[] = [];
    mount(() => {
      const form = createForm(Post);
      const members = () => [form.Field, form.Items, form.TextField, form.Form, form.submit, form.formProps, form.state, form.root];
      first = members();
      second = members();
      expect(forms.scope(form.root).TextField).toBe(form.TextField);
      return null;
    });
    expect(second).toEqual(first);
    second.forEach((member, index) => expect(member).toBe(first[index]));
  });

  it("defaults the id to a unique one per form", () => {
    const { Post } = definePost();
    const ids: string[] = [];
    mount(() => {
      ids.push(createForm(Post).id, createForm(Post).id);
      return null;
    });
    expect(new Set(ids).size).toBe(2);
  });
});
