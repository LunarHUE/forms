import { zustand } from "@lunarhue/forms-bind/zustand";
import { createForms, useForm } from "@lunarhue/forms-react";
import { useAppStore } from "./store";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools], fields: { TextField } });

const settingsForm = forms.define({
  // `useForm` checks this type against the slice the binding picks.
  defaultValues: { displayName: "", timezone: "" },
  onSubmit: (value) => value,
});

// Reads the store the usual zustand way. It sees each keystroke,
// since the binding copies every form write out.
function Greeting() {
  const name = useAppStore((state) => state.settings.displayName);
  return <p>Hello, {name}.</p>;
}

// A change made outside the form comes in too.
function loadSaved() {
  useAppStore.setState({
    settings: { displayName: "Grace", timezone: "America/New_York" },
  });
}

export default function SettingsForm() {
  // The form starts from the store's slice. Errors, touched and the
  // rest stay in the form. Only the value is copied.
  const form = useForm(settingsForm, {
    id: "settings",
    plugins: [
      zustand(useAppStore, {
        select: (state) => state.settings,
        update: (settings) => ({ settings }),
      }),
    ],
  });
  return (
    <form {...form.formProps}>
      <Greeting />
      <form.TextField name="displayName" label="Display name" />
      <form.TextField name="timezone" label="Time zone" />
      <button type="button" onClick={loadSaved}>
        Load saved
      </button>
      <button type="submit">Save</button>
    </form>
  );
}
