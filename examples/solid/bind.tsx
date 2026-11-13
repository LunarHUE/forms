import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";
import { bind } from "@lunarhue/forms-solid/plugins/bind";
import { createEffect, createRoot, createSignal } from "solid-js";

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
  // `bind` takes get, set and subscribe. A signal has no subscribe, so
  // an effect in its own root calls the listener, and disposing the
  // root unsubscribes. The form starts from the signal's value.
  const form = createForm(settingsForm, {
    plugins: [
      bind({
        get: settings,
        set: (value) => setSettings(value),
        subscribe: (listener) =>
          createRoot((dispose) => {
            createEffect(settings, () => listener());
            return dispose;
          }),
      }),
    ],
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
