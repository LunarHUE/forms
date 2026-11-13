import {
  createForms,
  type FieldApi,
  useForm,
  useFormContext,
  useFormState,
} from "@lunarhue/forms-react";
import { history } from "@lunarhue/forms-react/plugins/history";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label}
      <input {...field.inputProps()} />
    </label>
  );
}

// Keep the object `history()` returns. Its `formMeta` reader tells
// the buttons whether there is a step to undo or redo.
const undoHistory = history();

const forms = createForms({
  plugins: [undoHistory],
  fields: { TextField },
});

const note = forms.define({
  defaultValues: { title: "", body: "" },
  onSubmit: (value) => value,
});

// Works under any form of `forms`, since they all have `history`.
function UndoButtons() {
  const form = useFormContext(forms);
  // The meta is undefined until the first step. Read that as false.
  const meta = useFormState(form, (state) =>
    undoHistory.formMeta(state),
  );
  return (
    <>
      <button
        type="button"
        disabled={!(meta?.canUndo ?? false)}
        onClick={() => form.plugins.history.undo()}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!(meta?.canRedo ?? false)}
        onClick={() => form.plugins.history.redo()}
      >
        Redo
      </button>
    </>
  );
}

export default function NoteForm() {
  const form = useForm(note);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="title" label="Title" />
          <form.TextField name="body" label="Body" />
          <UndoButtons />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
