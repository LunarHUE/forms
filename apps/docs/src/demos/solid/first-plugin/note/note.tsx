import { createForm, createForms, inputProps } from "@lunarhue/forms-solid";
import { collapseSpaces } from "./collapseSpaces";

const forms = createForms({ plugins: [collapseSpaces()] });

const note = forms.define({
  defaultValues: { title: "", body: "" },
  onSubmit: (value) => value,
});

export default function NoteForm() {
  const form = createForm(note);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="title">
            {(field) => (
              <label>
                Title
                <input {...inputProps(field)} />
                <output>Stored: {JSON.stringify(field.value)}</output>
              </label>
            )}
          </form.Field>
          <form.Field name="body">
            {(field) => (
              <label>
                Body
                <input {...inputProps(field)} />
                <output>Stored: {JSON.stringify(field.value)}</output>
              </label>
            )}
          </form.Field>
        </form>
      )}
    </form.Form>
  );
}
