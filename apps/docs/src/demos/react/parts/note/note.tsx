import { createForms, defineField, useForm } from "@lunarhue/forms-react";
import { limit, limited } from "./limit";
import { NoteInput } from "./NoteInput";

// The part rides on the field type. Plain NoteInput fields have no limit.
const ShortNote = defineField(NoteInput, limited(20));

const forms = createForms({ plugins: [limit()], fields: { NoteInput, ShortNote } });

const note = forms.define({
  defaultValues: { headline: "", body: "" },
  onSubmit: (value) => value,
});

export default function NoteForm() {
  const form = useForm(note);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.ShortNote name="headline" label="Headline (20 at most)" />
          <form.NoteInput name="body" label="Body" />
        </form>
      )}
    </form.Form>
  );
}
