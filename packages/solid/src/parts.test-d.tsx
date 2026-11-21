import { describe, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, defineField, type FieldType, type FormError, type HandleOf, type ObjectHandle, type Part } from "./index.js";
import { digits, dirty, mask, masked, ruled, rules } from "./plugins.js";

declare function PhoneInput(props: { readonly field: FieldApi<string>; readonly label: string }): null;
declare function NumberInput(props: { readonly field: FieldApi<number> }): null;

const PhoneField = defineField(PhoneInput, masked({ clean: digits }));

interface Address {
  same: boolean;
  street: string;
}

describe("field types", () => {
  it("take parts that fit the component's value only", () => {
    expectTypeOf(PhoneField).toEqualTypeOf<FieldType<typeof PhoneInput, "mask">>();
    // @ts-expect-error: a mask cleans strings, and NumberInput's field holds a number
    defineField(NumberInput, masked({ clean: digits }));
  });

  it("bind on a form with the parts' plugins, and name the missing plugin on one without", () => {
    const bare = createForms({ fields: { PhoneField } });
    const scope = bare.scope(bare.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(scope.PhoneField).toEqualTypeOf<{ readonly "Add mask() to this form's plugins: PhoneField uses it": never }>();
    const withMask = createForms({ plugins: [mask()], fields: { PhoneField } });
    const bound = withMask.scope(withMask.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(bound.PhoneField).toBeFunction();
  });

  it("pin their parts at a name of a definition that fits them", () => {
    expectTypeOf(PhoneField.at("phone")).toEqualTypeOf<readonly Part<"mask", { readonly phone: string }>[]>();
    createForms({ plugins: [mask()] }).define({ defaultValues: { phone: "" } }, PhoneField.at("phone"));
    // @ts-expect-error: the form has no mask()
    createForms().define({ defaultValues: { phone: "" } }, PhoneField.at("phone"));
  });
});

describe("fieldsets with parts", () => {
  const forms = createForms({ plugins: [dirty(), rules()] });
  const Shape = forms.fieldset<Address, typeof rules>(ruled({ street: (address) => ({ hidden: address.same }) }));

  it("scope with the shared plugins and the parts', and take handles of forms that have the parts' plugins", () => {
    expectTypeOf<HandleOf<typeof Shape>>().toEqualTypeOf<ObjectHandle<Address, FormError, "rules">>();
    const store = forms.define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    expectTypeOf(Shape.scope(store.root.at("billing")).root.peek().dirty).toEqualTypeOf<boolean>();
    const other = createForms().define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    // @ts-expect-error: the other form has no rules()
    Shape.scope(other.root.at("billing"));
  });
});
