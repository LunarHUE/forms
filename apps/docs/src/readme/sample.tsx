import { z } from "zod";
import { create } from "zustand";
import {
  createForms,
  inputProps,
  useForm,
  useFormContext,
  useFormState,
  type FieldApi,
  type HandleOf,
} from "@lunarhue/forms-react";
import { rebase } from "@lunarhue/forms-react/plugins";
import { zod } from "@lunarhue/forms-schema/zod";
import { zustand } from "@lunarhue/forms-bind/zustand";

// Your own input, registered once.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field)} />
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}

// One plugin list. Zod brings validation.
// Rebase merges fresh server data.
const forms = createForms({
  plugins: [zod(), rebase()],
  fields: { TextField },
});

const Address = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
});

const Profile = z.object({
  name: z.string().min(1),
  email: z.email(),
  address: Address,
});

// A store your app already has. The form does not
// live in it. The binding below copies values both ways.
const useProfileStore = create(() => ({
  name: "",
  email: "",
  address: { street: "", city: "" },
}));

const saveProfile = (value: z.infer<typeof Profile>) =>
  fetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(value),
  });

const profile = forms.define({
  schema: Profile,
  // Keep this form's value and the store in step.
  plugins: [zustand(useProfileStore)],
  onSubmit: saveProfile,
});

// A reusable group of fields,
// usable under any form with an address.
const AddressFieldset = forms.fieldset(Address);

interface AddressFieldsProps {
  readonly field: HandleOf<typeof AddressFieldset>;
}

function AddressFields({ field }: AddressFieldsProps) {
  const scope = AddressFieldset.scope(field);
  return (
    <fieldset>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

// Works under any form.
function SubmitButton() {
  const form = useFormContext();
  const submitting = useFormState(
    form,
    (state) => state.submitting,
  );
  return (
    <button type="submit" disabled={submitting}>
      Save
    </button>
  );
}

export default function ProfileForm() {
  const form = useForm(profile);

  // Take the server's copy,
  // but keep whatever the user has typed.
  const refresh = async () => {
    const response = await fetch("/api/profile");
    const fresh = await response.json();
    form.plugins.rebase(form.root, fresh, (leaf) =>
      leaf.edited ? "keep" : "take",
    );
  };

  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <AddressFields field={form.root.at("address")} />
          <SubmitButton />
          <button type="button" onClick={refresh}>
            Refresh
          </button>
        </form>
      )}
    </form.Form>
  );
}
