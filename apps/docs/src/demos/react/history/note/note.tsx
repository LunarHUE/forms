import { createForms, useForm } from "@lunarhue/forms-react";
import { history } from "@lunarhue/forms-react/plugins/history";
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
  const form = useForm(note);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="title" label="Title" />
          <form.TextField name="body" label="Body" />
          <form.State select={(state) => undoHistory.formMeta(state)}>
            {(meta) => (
              <div>
                <button
                  type="button"
                  disabled={!meta.canUndo}
                  onClick={() => form.plugins.history.undo()}
                >
                  Undo
                </button>
                <button
                  type="button"
                  disabled={!meta.canRedo}
                  onClick={() => form.plugins.history.redo()}
                >
                  Redo
                </button>
              </div>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
