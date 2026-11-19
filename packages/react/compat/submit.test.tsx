import { fireEvent } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { createForms, useForm, useFormContext, useFormState, useInputProps } from "../src/index.js";
import { settle } from "../src/test/helpers.js";
import { act, render } from "./render.js";

const required = (value: string) => (value === "" ? { message: "required" } : undefined);
const saved: unknown[] = [];
const account = createForms().define({
  defaultValues: { name: "", email: "" },
  validate: { fields: { name: required, email: required } },
  onSubmit: (value) => {
    saved.push(value);
    return "ok";
  },
});

function Text(props: { readonly name: "name" | "email" }) {
  const form = useFormContext(account);
  return <input aria-label={props.name} {...useInputProps(form.root.at(props.name))} />;
}

function Status() {
  const form = useFormContext();
  const status = useFormState(form, (snapshot) => snapshot.submission.status);
  const count = useFormState(form, (snapshot) => snapshot.submitCount);
  return <p data-testid="status">{`${status} ${count}`}</p>;
}

function Account() {
  const form = useForm(account, { id: "account" });
  return (
    <form.Form>
      {(props) => (
        <form {...props}>
          <Text name="name" />
          <Text name="email" />
          <Status />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}

// The same form with its status read inline by form.State and no form.Form.
function InlineAccount() {
  const form = useForm(account, { id: "inline" });
  return (
    <form {...form.formProps}>
      <input aria-label="name" {...useInputProps(form.root.at("name"))} />
      <input aria-label="email" {...useInputProps(form.root.at("email"))} />
      <form.State select={(snapshot) => `${snapshot.submission.status} ${snapshot.submitCount}`}>
        {(status, owner) => <p data-testid="status">{`${status} ${owner.id}`}</p>}
      </form.State>
    </form>
  );
}

const field = (container: HTMLElement, name: string): HTMLInputElement => {
  const found = container.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);
  if (found === null) throw new Error(`no input ${name}`);
  return found;
};

const submit = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.submit(container.querySelector("form") ?? container);
    await settle();
  });
};

describe("submit", () => {
  it("focuses the first invalid field when invalid and calls onSubmit when valid", async () => {
    saved.length = 0;
    const { container } = await render(<Account />);
    const status = () => container.querySelector("[data-testid=status]")?.textContent;
    expect(status()).toBe("idle 0");

    await act(() => fireEvent.change(field(container, "email"), { target: { value: "ada@example.com" } }));
    await submit(container);
    expect(status()).toBe("invalid 1");
    expect(document.activeElement).toBe(field(container, "name"));
    expect(field(container, "name").getAttribute("aria-invalid")).toBe("true");
    expect(saved).toEqual([]);

    await act(() => fireEvent.change(field(container, "name"), { target: { value: "Ada" } }));
    await submit(container);
    expect(status()).toBe("succeeded 2");
    expect(saved).toEqual([{ name: "Ada", email: "ada@example.com" }]);
    expect(field(container, "name").hasAttribute("aria-invalid")).toBe(false);
  });

  it("reads the form state inline with form.State", async () => {
    saved.length = 0;
    const { container } = await render(<InlineAccount />);
    const status = () => container.querySelector("[data-testid=status]")?.textContent;
    expect(status()).toBe("idle 0 inline");

    await submit(container);
    expect(status()).toBe("invalid 1 inline");

    await act(() => fireEvent.change(field(container, "name"), { target: { value: "Ada" } }));
    await act(() => fireEvent.change(field(container, "email"), { target: { value: "ada@example.com" } }));
    await submit(container);
    expect(status()).toBe("succeeded 2 inline");
    expect(saved).toEqual([{ name: "Ada", email: "ada@example.com" }]);
  });
});
