import { valibot } from "@lunarhue/forms-schema/valibot";
import { renderToString } from "@solidjs/web";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { arrays } from "../plugins.js";
import { createDisabledErrors, createField, createForm, createForms, createItems } from "../index.js";
import { App, DeliveryApp, deliveryHtml, PhoneApp, phoneHtml, serverHtml, ShippingApp, shippingHtml } from "./ssr-app.js";

describe("server rendering", () => {
  it("renders the form from its initial snapshot with ids from createUniqueId", () => {
    expect(renderToString(() => <App />)).toBe(serverHtml);
  });

  it("renders what field types and fieldsets attached: a mask's display text and a hidden field", () => {
    expect(renderToString(() => <PhoneApp />)).toBe(phoneHtml);
    expect(phoneHtml).toContain('value="(555) 123-4"');
  });

  it("renders the flags rules set when the store is made", () => {
    expect(renderToString(() => <ShippingApp />)).toBe(shippingHtml);
  });

  it("renders a field disabled through a parent rules disabled, when the store changed before the field was read", () => {
    expect(renderToString(() => <DeliveryApp />)).toBe(deliveryHtml);
  });

  it("reads the server snapshot, not a value written during the render", () => {
    const Profile = createForms({ plugins: [valibot(), arrays()] }).define({
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
