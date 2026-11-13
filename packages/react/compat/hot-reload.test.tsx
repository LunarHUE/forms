import { fireEvent } from "@testing-library/dom";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";
import { createForms, useForm, useFormContext, useInputProps } from "../src/index.js";
import { act, render } from "./render.js";

// Fast Refresh runs an edited module again and keeps its components' state.
// Here `load` stands for the module body and assigning `signUp` for the reload.
const load = (name: string) => createForms().define({ defaultValues: { name } });
let signUp = load("first");

function Name() {
  const form = useFormContext(signUp);
  return <input aria-label="name" {...useInputProps(form.root.at("name"))} />;
}

function Page() {
  const form = useForm(signUp);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  return (
    <form.Form>
      <Name />
      <p data-testid="id">{form.id}</p>
      <button type="button" onClick={rerender}>
        Rerender
      </button>
    </form.Form>
  );
}

describe("hot reload", () => {
  it("makes a form from a new definition without remounting the page", async () => {
    const { container } = await render(<Page />);
    const input = () => container.querySelector("input");
    const id = container.querySelector('[data-testid="id"]')?.textContent;
    expect(input()?.value).toBe("first");

    signUp = load("second");
    await act(() => fireEvent.click(container.querySelector("button") ?? container));
    expect(input()?.value).toBe("second");
    expect(container.querySelector('[data-testid="id"]')?.textContent).toBe(id);
  });
});
