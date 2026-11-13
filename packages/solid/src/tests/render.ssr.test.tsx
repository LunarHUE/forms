import { valibot } from "@lunarhue/forms-schema/valibot";
import { renderToString } from "@solidjs/web";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createDisabledErrors, createField, createForm, createForms, createItems } from "../index.js";
import { App, serverHtml } from "./ssr-app.js";

describe("server rendering", () => {
  it("renders the form from its initial snapshot with ids from createUniqueId", () => {
    expect(renderToString(() => <App />)).toBe(serverHtml);
  });

  it("reads the server snapshot, not a value written during the render", () => {
    const Profile = createForms({ schemas: [valibot()] }).define({
      schema: v.object({ name: v.string(), tags: v.array(v.string()) }),
      defaultValues: { name: "initial", tags: ["a"] },
    });
    function Page() {
      const form = createForm(Profile, { id: "profile" });
      const name = createField(form.root.at("name"));
      const tags = createItems(form.root.at("tags"));
      const disabled = createDisabledErrors(form);
      form.root.at("name").setValue("written");
      form.root.at("tags").push("b");
      return (
        <p>
          {name.value} {tags().length} {disabled().length} {form.state.submission.status}
        </p>
      );
    }
    const html = renderToString(() => <Page />);
    expect(html.replace(/<!--[^>]*-->/g, "")).toMatch(/^<p _hk=\w+>initial 1 0 idle<\/p>$/);
  });
});
