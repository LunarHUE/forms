import { createForms, inputProps, useForm } from "@lunarhue/forms-react";
import { collapseSpaces } from "./collapseSpaces";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [collapseSpaces(), docsDevtools] });

const note = forms.define({
  defaultValues: { title: "", body: "" },
  onSubmit: (value) => value,
});

export default function NoteForm() {
  const form = useForm(note, { id: "note" });
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
