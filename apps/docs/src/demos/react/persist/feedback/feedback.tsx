import { createForms, useForm } from "@lunarhue/forms-react";
import { persist } from "@lunarhue/forms-react/plugins";
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
  const form = useForm(feedback, { id: "feedback" });
  return (
    <form {...form.formProps}>
      <form.TextField name="subject" label="Subject" />
      <form.TextField name="message" label="Message" />
      {/* Reset writes the defaults, and `persist` saves those too. */}
      <button type="button" onClick={() => form.root.reset()}>
        Discard draft
      </button>
    </form>
  );
}
