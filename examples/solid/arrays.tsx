import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";

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

const forms = createForms({ fields: { TextField } });

// With no schema, `defaultValues` types the form.
const checklist = forms.define({
  defaultValues: {
    tasks: [{ title: "Write the docs" }, { title: "Ship it" }],
  },
  onSubmit: (value) => value.tasks.length,
});

export default function ChecklistForm() {
  const form = createForm(checklist);
  // A handle to the array. Its commands change the list.
  const tasks = form.root.at("tasks");
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          {/* Each row renders once per key. A move or a remove keeps
              the row's DOM, and `index` is a signal that follows it. */}
          <form.Items name="tasks">
            {(task, index) => (
              <div>
                <form.TextField
                  handle={task.at("title")}
                  label={`Task ${index() + 1}`}
                />
                <button
                  type="button"
                  disabled={index() === 0}
                  onClick={() => tasks.move(index(), index() - 1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => tasks.remove(index())}
                >
                  Remove
                </button>
              </div>
            )}
          </form.Items>
          <button
            type="button"
            onClick={() => tasks.push({ title: "" })}
          >
            Add task
          </button>
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
