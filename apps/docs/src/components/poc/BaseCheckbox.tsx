import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Field } from "@base-ui/react/field";
import { Fieldset } from "@base-ui/react/fieldset";
import { createForms, useForm } from "@lunarhue/forms-react";
import { buttonClass, errorClass, Frame, labelClass, required, Submitted } from "./shared";

const forms = createForms();
const signup = forms.define({
  defaultValues: { terms: false, toppings: [] as string[] },
  validate: {
    fields: {
      terms: (value) => (value ? undefined : { message: "Accept the terms." }),
      toppings: required("Pick at least one topping."),
    },
  },
  onSubmit: (value) => value,
});

const boxClass =
  "flex size-5 items-center justify-center rounded border border-neutral-500 data-checked:bg-neutral-900 data-checked:text-white";
const toppings = ["cheese", "olives", "basil"];

export default function BaseCheckbox() {
  const form = useForm(signup);
  return (
    <Frame title="Base UI Checkbox and CheckboxGroup">
      <form.Form>
        {(formProps) => (
          <form {...formProps} className="flex flex-col gap-4">
            <form.Field name="toppings">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
                  <Fieldset.Root
                    render={<CheckboxGroup value={[...field.value]} onValueChange={(value) => field.setValue(value)} />}
                    className="flex flex-col gap-1"
                  >
                    <Fieldset.Legend className={labelClass}>Toppings</Fieldset.Legend>
                    {toppings.map((topping) => (
                      <Field.Item key={topping}>
                        <Field.Label className="flex items-center gap-2">
                          <Checkbox.Root value={topping} ref={field.ref} onBlur={field.handleBlur} className={boxClass}>
                            <Checkbox.Indicator>✓</Checkbox.Indicator>
                          </Checkbox.Root>
                          {topping}
                        </Field.Label>
                      </Field.Item>
                    ))}
                  </Fieldset.Root>
                  <Field.Error match className={errorClass}>
                    {field.shownErrors[0]?.message}
                  </Field.Error>
                </Field.Root>
              )}
            </form.Field>
            <form.Field name="terms">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
                  <Field.Label className="flex items-center gap-2">
                    <Checkbox.Root
                      checked={field.value}
                      onCheckedChange={(checked) => field.setValue(checked)}
                      readOnly={field.readOnly}
                      ref={field.ref}
                      onBlur={field.handleBlur}
                      className={boxClass}
                    >
                      <Checkbox.Indicator>✓</Checkbox.Indicator>
                    </Checkbox.Root>
                    Accept the terms
                  </Field.Label>
                  <Field.Error match className={errorClass}>
                    {field.shownErrors[0]?.message}
                  </Field.Error>
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
