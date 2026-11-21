// A search box: one required field and a submit.
import { createForms, fieldValidators, inputProps, useForm } from "@lunarhue/forms-react";

const forms = createForms();
const search = forms.define({
  defaultValues: { q: "" },
  validate: { fields: fieldValidators({ q: (value) => (value.trim() ? undefined : { message: "Type something." }) }) },
  onSubmit: (value) => location.assign(`/results?q=${encodeURIComponent(value.q)}`),
});

export function App() {
  const form = useForm(search);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="q">{(field) => <input {...inputProps(field, { type: "search" })} />}</form.Field>
          <button type="submit">Search</button>
        </form>
      )}
    </form.Form>
  );
}
