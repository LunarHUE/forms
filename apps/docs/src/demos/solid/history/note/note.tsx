import { createForm, createForms } from "@lunarhue/forms-solid";
import { history } from "@lunarhue/forms-solid/plugins/history";
import { TextField } from "./TextField";

// Keep the object `history()` returns. Its `formMeta` reader says
// whether there is a step to undo or redo.
const undoHistory = history();

const forms = createForms({ plugins: [undoHistory], fields: { TextField } });

const note = forms.define({
  defaultValues: { title: "", body: "" },
  onSubmit: (value) => value,
});

export default function NoteForm() {
  const form = createForm(note);
  const meta = () => undoHistory.formMeta(form.state);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="title" label="Title" />
          <form.TextField name="body" label="Body" />
          <div>
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
          </div>
        </form>
      )}
    </form.Form>
  );
}
