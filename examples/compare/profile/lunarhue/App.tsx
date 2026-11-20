import { createForms, useField, useForm, useFormContext, useFormState } from "@lunarhue/forms-react";
import { baselineOnSubmit, dirty, rebase } from "@lunarhue/forms-react/plugins";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { editProfileElsewhere, getProfile, type Profile, saveProfile, timezones } from "../../shared/server.ts";
import { Loaded, Page, ServerControls } from "../../shared/ui.tsx";
import { Checkbox, Select, TextArea, TextField } from "./fields.tsx";

const forms = createForms({
  plugins: [zod(), dirty(), rebase()],
  fields: { TextField, TextArea, Select, Checkbox },
});

const ProfileSchema = z.object({
  name: z.string().min(1, "Enter your name."),
  email: z.email("Enter a valid email."),
  bio: z.string().max(160, "Keep it under 160 characters."),
  timezone: z.enum(timezones, "Pick a time zone."),
  notifications: z.object({
    product: z.boolean(),
    security: z.boolean(),
    digest: z.enum(["daily", "weekly", "never"]),
  }),
});

// The form starts from the profile the server sent. After a successful
// save, what was sent becomes the new baseline, so the form is clean again
// except for edits made while the save ran.
const profileForm = forms.define((saved: Profile) => ({
  schema: ProfileSchema,
  defaultValues: saved,
  plugins: [baselineOnSubmit()],
  onSubmit: async (value) => {
    await saveProfile(value);
    return "Saved.";
  },
}));

function SaveBar() {
  const form = useFormContext(forms);
  const { dirty: changed, submitting } = useFormState(form, (state) => ({ dirty: state.dirty, submitting: state.submitting }), shallowEqual);
  // `changes()` lists the leaves that differ from the baseline. It is a
  // read, not a subscription, so it runs whenever the root field changes.
  const count = useField(form.root, () => form.store.changes().length);

  // Fields the user hasn't changed take the server's copy. Changed ones keep
  // their text and stay dirty against the new baseline.
  const refresh = async () => {
    const fresh = await getProfile();
    form.plugins.rebase(form.root, fresh, (leaf) => (Object.is(leaf.value, leaf.baseline) ? "take" : "keep"));
  };

  return (
    <div className="save-bar">
      <span className="count">{count === 0 ? "No unsaved changes" : `${count} unsaved ${count === 1 ? "change" : "changes"}`}</span>
      <button type="button" onClick={() => void refresh()}>
        Refresh
      </button>
      <button type="button" disabled={!changed} onClick={() => form.root.reset()}>
        Discard
      </button>
      <button type="submit" disabled={!changed || submitting}>
        {submitting ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

function shallowEqual(a: { dirty: boolean; submitting: boolean }, b: { dirty: boolean; submitting: boolean }) {
  return a.dirty === b.dirty && a.submitting === b.submitting;
}

function ProfileForm({ saved }: { readonly saved: Profile }) {
  const form = useForm(profileForm, saved);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <form.TextArea name="bio" label="Bio" />
          <form.Select name="timezone" label="Time zone" options={timezones} />
          <fieldset>
            <legend>Notifications</legend>
            <form.Checkbox name="notifications.product" label="Product news" />
            <form.Checkbox name="notifications.security" label="Security alerts" />
            <form.Select name="notifications.digest" label="Digest" options={["daily", "weekly", "never"]} />
          </fieldset>
          <SaveBar />
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}

export function App() {
  return (
    <Page title="Profile settings" lede="Dirty tracking, a clean form after save, a refresh that keeps edits, and a Zod schema.">
      <ServerControls>
        <button type="button" onClick={editProfileElsewhere}>
          Edit on the server
        </button>
      </ServerControls>
      <Loaded load={getProfile}>{(saved) => <ProfileForm saved={saved} />}</Loaded>
    </Page>
  );
}
