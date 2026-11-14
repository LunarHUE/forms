import { signal } from "@lunarhue/forms-bind/solid";
import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";
import { createSignal } from "solid-js";

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

// Anything else reads the signal as usual. It sees each keystroke,
// since the binding copies every form write out.
function Greeting() {
  return <p>Hello, {settings().displayName}.</p>;
}

export default function SettingsForm() {
  // The form starts from the signal's value, and each copies the other's changes.
  const form = createForm(settingsForm, {
    plugins: [signal(settings, setSettings)],
  });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <Greeting />
          <form.TextField name="displayName" label="Display name" />
          <form.TextField name="timezone" label="Time zone" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
