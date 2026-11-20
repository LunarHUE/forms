import { createForm } from "@lunarhue/forms-solid";
import { forms } from "./forms";
import { SaveBar } from "./SaveBar";

const post = forms.define({
  defaultValues: { title: "Hello", body: "First post." },
  onSubmit: (value) => value,
});

export default function PostEditor() {
  const form = createForm(post, { id: "editor" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="title" label="Title" />
          <form.TextField name="body" label="Body" />
          <SaveBar />
        </form>
      )}
    </form.Form>
  );
}
