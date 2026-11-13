import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { createForm, createForms, useFormContext, type FieldApi } from "../index.js";

function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}

const forms = createForms({ schemas: [valibot()], fields: { TextField } });
const Order = forms.define({
  schema: v.object({ customer: v.string(), rows: v.array(v.object({ title: v.string() })) }),
  defaultValues: { customer: "Ada", rows: [{ title: "first" }, { title: "second" }] },
});

function Status() {
  const form = useFormContext();
  return <output>{form.state.submission.status}</output>;
}

export function App() {
  const form = createForm(Order);
  return (
    <form.Form>
      {(props, owner) => (
        <form {...props} data-submits={typeof owner.submit}>
          <form.TextField name="customer" label="Customer" />
          <form.Items name="rows">{(row) => <form.TextField handle={row.at("title")} label="Title" />}</form.Items>
          <Status />
        </form>
      )}
    </form.Form>
  );
}

// What the server renders for `App`. The server test checks that
// `renderToString` gives exactly this, and the hydration test hydrates it.

/** The app's markup, as `renderToString` returns it without the hydration script. */
export const serverHtml =
  '<form _hk=100 id="0" novalidate tabindex="-1" data-submits="function">' +
  '<!--$--><label _hk=101><!--$-->Customer<!--/--><input value="Ada" type="text" id="0--customer" name="customer" /></label><!--/-->' +
  '<!--$--><label _hk=10500><!--$-->Title<!--/--><input value="first" type="text" id="0--rows--k0--title" name="rows.0.title" /></label>' +
  '<label _hk=10510><!--$-->Title<!--/--><input value="second" type="text" id="0--rows--k1--title" name="rows.1.title" /></label><!--/-->' +
  "<!--$--><output _hk=107>idle</output><!--/--></form>";
