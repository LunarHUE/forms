import { createForm, createForms } from "@lunarhue/forms-solid";
import { persist } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools], fields: { TextField } });

const feedback = forms.define({
  defaultValues: { subject: "", message: "" },
  // Saves the value to localStorage under this key when the page is idle,
  // and restores it when the form mounts.
  plugins: [persist("feedback-draft")],
  onSubmit: (value) => value,
});

export default function FeedbackForm() {
  const form = createForm(feedback, { id: "feedback" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="subject" label="Subject" />
          <form.TextField name="message" label="Message" />
          {/* Reset writes the defaults, and `persist` saves those too. */}
          <button type="button" onClick={() => form.root.reset()}>
            Discard draft
          </button>
        </form>
      )}
    </form.Form>
  );
}
