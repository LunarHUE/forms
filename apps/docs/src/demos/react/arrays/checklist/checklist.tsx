import { createForms, useForm } from "@lunarhue/forms-react";
import { arrays } from "@lunarhue/forms-react/plugins";
import { TextField } from "./TextField";

// arrays() gives the array handle its commands: push, insert, remove, move.
const forms = createForms({ plugins: [arrays()], fields: { TextField } });

// With no schema, `defaultValues` types the form.
const checklist = forms.define({
  defaultValues: {
    tasks: [{ title: "Write the docs" }, { title: "Ship it" }],
  },
  onSubmit: (value) => value.tasks,
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
                <form.TextField handle={task.at("title")} label={`Task ${index + 1}`} />
                <div>
                  <button type="button" disabled={index === 0} onClick={() => tasks.move(index, index - 1)}>
                    Up
                  </button>
                  <button type="button" onClick={() => tasks.remove(index)}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </form.Items>
          <div>
            <button type="button" onClick={() => tasks.push({ title: "" })}>
              Add task
            </button>
            <button type="submit">Save</button>
          </div>
          <form.State select={(state) => state.submission}>
            {(submission) => (
              <p role="status">
                {submission.status === "succeeded" ? submission.result.map((task) => task.title).join(", ") : null}
              </p>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
