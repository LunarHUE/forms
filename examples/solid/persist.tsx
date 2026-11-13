import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";
import { persist } from "@lunarhue/forms-solid/plugins/persist";

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

const feedback = forms.define({
  defaultValues: { subject: "", message: "" },
  // Saves the value to localStorage under this key when the page is
  // idle, and restores it when the form mounts. The server renders the
  // defaults, and the draft shows in the render after hydration.
  plugins: [persist("feedback-draft")],
  onSubmit: async (value) => {
    await fetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify(value),
    });
  },
});

export default function FeedbackForm() {
  const form = createForm(feedback);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="subject" label="Subject" />
          <form.TextField name="message" label="Message" />
          <button type="submit">Send</button>
          {/* Reset writes the defaults, and `persist` saves those too,
              so the draft is gone after a reload. */}
          <button type="button" onClick={() => form.root.reset()}>
            Discard draft
          </button>
        </form>
      )}
    </form.Form>
  );
}
