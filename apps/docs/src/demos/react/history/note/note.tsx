import { createForms, useForm } from "@lunarhue/forms-react";
import { history } from "@lunarhue/forms-react/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [history(), docsDevtools], fields: { TextField } });

const note = forms.define({
  defaultValues: { title: "", body: "" },
  onSubmit: (value) => value,
});

export default function NoteForm() {
  const form = useForm(note, { id: "note" });
  return (
    <form {...form.formProps}>
      <form.TextField name="title" label="Title" />
      <form.TextField name="body" label="Body" />
      <form.State select={(state) => history.formMeta(state)}>
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
  );
}
