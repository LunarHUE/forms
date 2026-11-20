import { signal } from "@lunarhue/forms-bind/solid";
import { createForm, createForms } from "@lunarhue/forms-solid";
import { createSignal } from "solid-js";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools], fields: { TextField } });

interface Settings {
  displayName: string;
  timezone: string;
}

// State the app already keeps in a signal.
const [settings, setSettings] = createSignal<Settings>({
  displayName: "Ada",
  timezone: "Europe/London",
});

const settingsForm = forms.define({
  defaultValues: { displayName: "", timezone: "" },
  onSubmit: (value) => value,
});

// Reads the signal as usual. It sees each keystroke, since the
// binding copies every form write out.
function Greeting() {
  return <p>Hello, {settings().displayName}.</p>;
}

// A change made outside the form comes in too.
function loadSaved() {
  setSettings({ displayName: "Grace", timezone: "America/New_York" });
}

export default function SettingsForm() {
  // The form starts from the signal's value. Errors, touched and the
  // rest stay in the form. Only the value is copied.
  const form = createForm(settingsForm, {
    id: "settings",
    plugins: [signal(settings, setSettings)],
  });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <Greeting />
          <form.TextField name="displayName" label="Display name" />
          <form.TextField name="timezone" label="Time zone" />
          <button type="button" onClick={loadSaved}>
            Load saved
          </button>
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
