import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { createForms, useForm } from "@lunarhue/forms-react";
import { digits, mask } from "@lunarhue/forms-react/plugins/mask";
import { buttonClass, errorClass, formatPhone, Frame, inputClass, labelClass, required, Submitted } from "./shared";

const forms = createForms();
const contact = forms.define({
  defaultValues: { name: "", phone: "" },
  plugins: [mask({ phone: { clean: digits, display: formatPhone } })],
  validate: { fields: { name: required("Enter a name."), phone: required("Enter a phone number.") } },
  onSubmit: (value) => value,
});

export default function BaseTextMask() {
  const form = useForm(contact);
  return (
    <Frame title="Base UI Field + Input, phone mask">
      <form.Form>
        {(formProps) => (
          <form {...formProps} className="flex flex-col gap-4">
            <form.Field name="name">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled} className="flex flex-col gap-1">
                  <Field.Label className={labelClass}>Name</Field.Label>
                  <Input
                    ref={field.ref}
                    value={field.text}
                    onValueChange={(text) => field.setText(text)}
                    onBlur={field.handleBlur}
                    className={inputClass}
                  />
                  <Field.Error match className={errorClass}>
                    {field.shownErrors[0]?.message}
                  </Field.Error>
                </Field.Root>
              )}
            </form.Field>
            <form.Field name="phone">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled} className="flex flex-col gap-1">
                  <Field.Label className={labelClass}>Phone</Field.Label>
                  <Input
                    type="tel"
                    ref={field.ref}
                    value={field.text}
                    onValueChange={(text, details) => field.setText(text, details.event)}
                    onBlur={field.handleBlur}
                    className={inputClass}
                  />
                  <Field.Error match className={errorClass}>
                    {field.shownErrors[0]?.message}
                  </Field.Error>
                  <span className="font-mono text-xs" data-testid="phone-stored">
                    stored: {JSON.stringify(field.value)}
                  </span>
                </Field.Root>
              )}
            </form.Field>
            <button type="submit" className={buttonClass}>
              Submit
            </button>
          </form>
        )}
      </form.Form>
      <Submitted form={form} />
    </Frame>
  );
}
