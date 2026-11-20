import { useForm } from "@lunarhue/forms-react";
import { forms } from "./forms";
import { NamedList } from "./NamedList";

const profile = forms.define({
  defaultValues: {
    skills: [{ id: 1, name: "Writing" }],
    languages: [{ id: 2, name: "English", level: "native" }],
  },
  onSubmit: (value) => value,
});

export default function SkillsForm() {
  const form = useForm(profile);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <h3>Skills</h3>
          <NamedList items={form.root.at("skills")} create={(base) => base} />
          <h3>Languages</h3>
          <NamedList items={form.root.at("languages")} create={(base) => ({ ...base, level: "basic" })} />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
