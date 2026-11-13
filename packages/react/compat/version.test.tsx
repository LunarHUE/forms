import { useState, version as reactVersion } from "react";
import { version as domVersion } from "react-dom";
import { expect, inject, it } from "vitest";
import { createForms, useField } from "../src/index.js";
import { render } from "./render.js";

declare module "vitest" {
  interface ProvidedContext {
    reactMajor: number;
  }
}

const profile = createForms().define({ defaultValues: { name: "Ada" } });

function Name() {
  const form = profile.useForm();
  const [count] = useState(1);
  return <p>{`${useField(form.root.at("name")).value} ${count}`}</p>;
}

it("runs on the React this project names, with one copy of it", async () => {
  expect(reactVersion.split(".")[0]).toBe(String(inject("reactMajor")));
  // react-dom 16 has no `version` export.
  expect(domVersion).toBe(inject("reactMajor") > 16 ? reactVersion : undefined);
  // If react-dom had loaded a second copy of React, these hooks would throw an invalid hook call.
  const { container } = await render(<Name />);
  expect(container.textContent).toBe("Ada 1");
});
