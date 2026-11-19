import { createForm, createForms } from "@lunarhue/forms-solid";
import { arrays } from "@lunarhue/forms-solid/plugins";
import { Show } from "solid-js";
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
                <form.TextField handle={task.at("title")} label={`Task ${index() + 1}`} />
                <div>
                  <button type="button" disabled={index() === 0} onClick={() => tasks.move(index(), index() - 1)}>
                    Up
                  </button>
                  <button type="button" onClick={() => tasks.remove(index())}>
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
          <p role="status">
            <Show when={form.state.submission.status === "succeeded" && form.state.submission}>
              {(submission) => submission().result.map((task) => task.title).join(", ")}
            </Show>
          </p>
        </form>
      )}
    </form.Form>
  );
}
