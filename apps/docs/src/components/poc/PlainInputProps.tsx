import { createForms, type FormError, inputProps, useForm } from "@lunarhue/forms-react";
import { digits, mask } from "@lunarhue/forms-react/plugins/mask";
import type { ReactNode } from "react";
import { buttonClass, errorClass, formatPhone, Frame, inputClass, labelClass, required, Submitted } from "./shared";

const forms = createForms();
const order = forms.define({
  defaultValues: { phone: "", price: undefined as number | undefined, terms: false, toppings: [] as string[], size: "" },
  plugins: [mask({ phone: { clean: digits, display: formatPhone } })],
  validate: {
    fields: {
      phone: required("Enter a phone number."),
      price: required("Enter a price."),
      terms: (value) => (value ? undefined : { message: "Accept the terms." }),
      toppings: required("Pick at least one topping."),
      size: required("Pick a size."),
    },
  },
  onSubmit: (value) => value,
});

function Errors({ field }: { readonly field: { readonly errorId: string; readonly shownErrors: readonly FormError[] } }) {
  return (
    <p id={field.errorId} className={errorClass}>
      {field.shownErrors[0]?.message}
    </p>
  );
}

function Row({ label, htmlFor, children }: { readonly label: string; readonly htmlFor?: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function PlainInputProps() {
  const form = useForm(order);
  return (
    <Frame title="Plain HTML with inputProps(field)">
      <form.Form>
        {(formProps) => (
          <form {...formProps} className="flex flex-col gap-4">
            <form.Field name="phone">
              {(field) => (
                <Row label="Phone" htmlFor={field.id}>
                  <input {...inputProps(field, { type: "tel" })} className={inputClass} />
                  <Errors field={field} />
                </Row>
              )}
            </form.Field>
            <form.Field name="price">
              {(field) => (
                <Row label="Price" htmlFor={field.id}>
                  <input {...inputProps(field, { kind: "number" })} className={inputClass} />
                  <Errors field={field} />
                </Row>
              )}
            </form.Field>
            <form.Field name="toppings">
              {(field) => (
                <fieldset className="flex flex-col gap-1">
                  <legend className={labelClass}>Toppings</legend>
                  {["cheese", "olives", "basil"].map((topping) => (
                    <label key={topping} className="flex items-center gap-2">
                      <input {...inputProps(field, { kind: "checkbox", value: topping })} />
                      {topping}
                    </label>
                  ))}
                  <Errors field={field} />
                </fieldset>
              )}
            </form.Field>
            <form.Field name="size">
              {(field) => (
                <Row label="Size" htmlFor={field.id}>
                  <select {...inputProps(field, { kind: "select", empty: "" })} className={inputClass}>
                    <option value="">Pick a size</option>
                    <option value="s">Small</option>
                    <option value="m">Medium</option>
                    <option value="l">Large</option>
                  </select>
                  <Errors field={field} />
                </Row>
              )}
            </form.Field>
            <form.Field name="terms">
              {(field) => (
                <label className="flex items-center gap-2">
                  <input {...inputProps(field, { kind: "checkbox" })} />
                  Accept the terms
                  <Errors field={field} />
                </label>
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
