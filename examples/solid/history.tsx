import {
  createForm,
  createForms,
  type FieldApi,
  useFormContext,
} from "@lunarhue/forms-solid";
import { history } from "@lunarhue/forms-solid/plugins/history";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField(props: TextFieldProps) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
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
  const meta = () => undoHistory.formMeta(form.state);
  return (
    <>
      <button
        type="button"
        disabled={!meta().canUndo}
        onClick={() => form.plugins.history.undo()}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!meta().canRedo}
        onClick={() => form.plugins.history.redo()}
      >
        Redo
      </button>
    </>
  );
}

export default function NoteForm() {
  const form = createForm(note);
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
