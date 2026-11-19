import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { createForms, useForm } from "@lunarhue/forms-react";
import { buttonClass, errorClass, Frame, inputClass, labelClass, required, Submitted } from "./shared";

const forms = createForms();
const order = forms.define({
  defaultValues: { quantity: undefined as number | undefined, price: undefined as number | undefined },
  validate: { fields: { quantity: required("Enter a quantity."), price: required("Enter a price.") } },
  onSubmit: (value) => value,
});

export default function BaseNumber() {
  const form = useForm(order);
  return (
    <Frame title="Base UI NumberField, and Field + Input as a number">
      <form.Form>
        {(formProps) => (
          <form {...formProps} className="flex flex-col gap-4">
            {/* NumberField keeps its own text while typing, so this binds the value only. */}
            <form.Field name="quantity">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled} className="flex flex-col gap-1">
                  <Field.Label className={labelClass}>Quantity (NumberField)</Field.Label>
                  <NumberField.Root
                    value={field.value ?? null}
                    onValueChange={(value) => field.setValue(value ?? undefined)}
                    readOnly={field.readOnly}
                  >
                    <NumberField.Group className="flex gap-1">
                      <NumberField.Decrement className="w-9 rounded border">-</NumberField.Decrement>
                      <NumberField.Input ref={field.ref} onBlur={field.handleBlur} className={inputClass} />
                      <NumberField.Increment className="w-9 rounded border">+</NumberField.Increment>
                    </NumberField.Group>
                  </NumberField.Root>
                  <Field.Error match className={errorClass}>
                    {field.shownErrors[0]?.message}
                  </Field.Error>
                  <span className="font-mono text-xs" data-testid="quantity-stored">
                    stored: {JSON.stringify(field.value) ?? "undefined"}
                  </span>
                </Field.Root>
              )}
            </form.Field>
            {/* A plain text input: the library keeps `12.` and `-` as typed. */}
            <form.Field name="price">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled} className="flex flex-col gap-1">
                  <Field.Label className={labelClass}>Price (Field + Input)</Field.Label>
                  <Input
                    inputMode="decimal"
                    ref={field.ref}
                    value={field.text}
                    onValueChange={(text) => field.setNumberText(text)}
                    onBlur={field.handleBlur}
                    className={inputClass}
                  />
                  <Field.Error match className={errorClass}>
                    {field.shownErrors[0]?.message}
                  </Field.Error>
                  <span className="font-mono text-xs" data-testid="price-stored">
                    stored: {JSON.stringify(field.value) ?? "undefined"}
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
