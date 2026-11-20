import { createForm, createForms } from "@lunarhue/forms-solid";
import { dirty, rebase } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [dirty(), rebase(), docsDevtools], fields: { TextField } });

const profile = forms.define({
  defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
  onSubmit: (value) => value,
});

// Stands in for `fetch("/api/profile")`. Someone changed both fields
// on the server since this form loaded.
const fetchProfile = () =>
  Promise.resolve({ name: "Ada King", email: "ada@lovelace.dev" });

export default function ProfileForm() {
  const form = createForm(profile, { id: "profile" });

  // Fields the user edited keep their text. The rest take the server's.
  const refresh = async () => {
    const fresh = await fetchProfile();
    form.plugins.rebase(form.root, fresh, (leaf) => (leaf.edited ? "keep" : "take"));
  };

  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </form>
      )}
    </form.Form>
  );
}
