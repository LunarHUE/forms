import {
  createForms,
  type FieldApi,
  useForm,
} from "@lunarhue/forms-react";

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

const forms = createForms({ fields: { TextField } });

// With no schema, `defaultValues` types the form.
const checklist = forms.define({
  defaultValues: {
    tasks: [{ title: "Write the docs" }, { title: "Ship it" }],
  },
  onSubmit: (value) => value.tasks.length,
});

export default function ChecklistForm() {
  const form = useForm(checklist);
  // A handle to the array. Its commands change the list.
  const tasks = form.root.at("tasks");
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          {/* Each row has a key that stays with it through moves and
              removes, so its input keeps its state. */}
          <form.Items name="tasks">
            {(task, index) => (
              <div>
                <form.TextField
                  handle={task.at("title")}
                  label={`Task ${index + 1}`}
                />
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => tasks.move(index, index - 1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => tasks.remove(index)}
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
