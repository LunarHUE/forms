import { Field } from "@base-ui/react/field";
import { Select } from "@base-ui/react/select";
import { createForms, useForm } from "@lunarhue/forms-react";
import { buttonClass, errorClass, Frame, inputClass, labelClass, required, Submitted } from "./shared";

const forms = createForms();
const order = forms.define({
  defaultValues: { size: "" },
  validate: { fields: { size: required("Pick a size.") } },
  onSubmit: (value) => value,
});

const sizes = [
  { label: "Small", value: "s" },
  { label: "Medium", value: "m" },
  { label: "Large", value: "l" },
];

export default function BaseSelect() {
  const form = useForm(order);
  return (
    <Frame title="Base UI Select">
      <form.Form>
        {(formProps) => (
          <form {...formProps} className="flex flex-col gap-4">
            <form.Field name="size">
              {(field) => (
                <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled} className="flex flex-col gap-1">
                  <Select.Root
                    items={sizes}
                    value={field.value === "" ? null : field.value}
                    onValueChange={(value) => field.setValue(value ?? "")}
                    // The trigger loses focus to the popup, so the field is touched when the popup closes.
                    onOpenChange={(open) => {
                      if (!open) field.handleBlur();
                    }}
                    readOnly={field.readOnly}
                  >
                    <Select.Label className={labelClass}>Size</Select.Label>
                    <Select.Trigger ref={field.ref} className={`${inputClass} flex items-center justify-between`}>
                      <Select.Value placeholder="Pick a size" />
                      <Select.Icon>▾</Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner sideOffset={4} className="z-10">
                        <Select.Popup className="rounded border border-neutral-400 bg-white p-1 dark:bg-neutral-900">
                          <Select.List>
                            {sizes.map(({ label, value }) => (
                              <Select.Item key={value} value={value} className="cursor-default px-2 py-1 data-highlighted:bg-neutral-200 dark:data-highlighted:bg-neutral-700">
                                <Select.ItemText>{label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
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
