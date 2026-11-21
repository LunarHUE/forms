import { createForm, createForms } from "@lunarhue/forms-solid";
import { history } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [history(), docsDevtools], fields: { TextField } });

const note = forms.define({
  defaultValues: { title: "", body: "" },
  onSubmit: (value) => value,
});

export default function NoteForm() {
  const form = createForm(note, { id: "note" });
  const meta = () => history.formMeta(form.state);
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
