import { zustand } from "@lunarhue/forms-bind/zustand";
import {
  createForms,
  type FieldApi,
  useForm,
} from "@lunarhue/forms-react";
import { create } from "zustand";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label}
      <input {...field.inputProps()} />
    </label>
  );
}

const forms = createForms({ fields: { TextField } });

interface Settings {
  displayName: string;
  timezone: string;
}

// The app's store, with more in it than the form edits.
interface AppState {
  settings: Settings;
  theme: "light" | "dark";
}

const useAppStore = create<AppState>()(() => ({
  settings: { displayName: "Ada", timezone: "Europe/London" },
  theme: "light",
}));

const settingsForm = forms.define({
  // `useForm` below checks these types against the store's slice.
  defaultValues: { displayName: "", timezone: "" },
  onSubmit: (value) => value,
});

// Anything else in the app reads the store the usual zustand way. It
// sees each keystroke, since the binding copies every form write out.
function Greeting() {
  const name = useAppStore((state) => state.settings.displayName);
  return <p>Hello, {name}.</p>;
}

export default function SettingsForm() {
  // Bind this one form to one slice of the store. The form starts
  // from the store's value, and a change on either side is copied to
  // the other. Errors, touched and the rest stay in the form.
  const form = useForm(settingsForm, {
    plugins: [
      zustand(useAppStore, {
        select: (state) => state.settings,
        update: (settings) => ({ settings }),
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
