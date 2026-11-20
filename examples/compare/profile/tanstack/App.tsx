import { formOptions, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";
import { editProfileElsewhere, getProfile, type Profile, saveProfile, timezones } from "../../shared/server.ts";
import { Loaded, Page, ServerControls } from "../../shared/ui.tsx";
import { useAppForm, withForm } from "./form.tsx";
import { differsAt, rebaseline } from "./rebaseline.ts";

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

// Every field the form renders. The rebaseline helper walks these, since
// TanStack has no list of a form's leaves to hand.
const fieldNames = [
  "name",
  "email",
  "bio",
  "timezone",
  "notifications.product",
  "notifications.security",
  "notifications.digest",
] as const;

const digests = ["daily", "weekly", "never"] as const;

// Shared by the form and by SaveBar, which withForm types from it. The real
// defaults are the loaded profile, passed to useAppForm.
const blankProfile: Profile = {
  name: "",
  email: "",
  bio: "",
  timezone: "Europe/London",
  notifications: { product: false, security: false, digest: "never" },
};

const profileOptions = formOptions({
  defaultValues: blankProfile,
  validators: { onChange: ProfileSchema },
});

const SaveBar = withForm({
  ...profileOptions,
  props: { refresh: async (): Promise<void> => {} },
  render: function Render({ form, refresh }) {
    const count = useStore(form.store, (state) => Object.values(state.fieldMeta).filter((meta) => !meta.isDefaultValue).length);
    const clean = useStore(form.store, (state) => state.isDefaultValue);
    const submitting = useStore(form.store, (state) => state.isSubmitting);

    return (
      <div className="save-bar">
        <span className="count">{count === 0 ? "No unsaved changes" : `${count} unsaved ${count === 1 ? "change" : "changes"}`}</span>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
        <button type="button" disabled={clean} onClick={() => form.reset()}>
          Discard
        </button>
        <button type="submit" disabled={clean || submitting}>
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    );
  },
});

function ProfileForm({ saved }: { readonly saved: Profile }) {
  // `useForm` applies its options again on every render, and an untouched
  // form takes new `defaultValues` as its values. Defaults moved with
  // `form.reset(values)` would snap back to the loaded profile on the next
  // render, so they live in React state and move with each rebaseline.
  const [defaults, setDefaults] = useState(saved);
  const form = useAppForm({
    ...profileOptions,
    defaultValues: defaults,
    onSubmit: async ({ value, formApi }) => {
      await saveProfile(value);
      // What was sent becomes the defaults. A field edited while the save
      // ran keeps the newer text and stays changed.
      rebaseline(formApi, fieldNames, value, (name, current) => differsAt(value, name, current));
      setDefaults(value);
    },
  });

  // Fields the user hasn't changed take the server's copy. Changed ones
  // keep their text and stay changed against the new defaults.
  const refresh = async () => {
    const fresh = await getProfile();
    rebaseline(form, fieldNames, fresh, (name) => form.getFieldMeta(name)?.isDefaultValue === false);
    setDefaults(fresh);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
      <form.AppField name="bio">{(field) => <field.TextArea label="Bio" />}</form.AppField>
      <form.AppField name="timezone">{(field) => <field.Select label="Time zone" options={timezones} />}</form.AppField>
      <fieldset>
        <legend>Notifications</legend>
        <form.AppField name="notifications.product">{(field) => <field.Checkbox label="Product news" />}</form.AppField>
        <form.AppField name="notifications.security">{(field) => <field.Checkbox label="Security alerts" />}</form.AppField>
        <form.AppField name="notifications.digest">{(field) => <field.Select label="Digest" options={digests} />}</form.AppField>
      </fieldset>
      <SaveBar form={form} refresh={refresh} />
      <form.Subscribe selector={(state) => state.isSubmitSuccessful}>
        {(succeeded) => <p role="status">{succeeded ? "Saved." : null}</p>}
      </form.Subscribe>
    </form>
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
