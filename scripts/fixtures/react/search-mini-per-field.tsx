// A search box: one required field and a submit. On the /mini entry, with per-field wakeups.
import { createForms, fieldValidators, inputProps, perField, useForm } from "@lunarhue/forms-react/mini";

const forms = createForms({ subscribe: perField() });
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
