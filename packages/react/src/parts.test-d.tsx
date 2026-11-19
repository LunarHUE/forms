import { describe, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, field, type FieldType, type FormError, type Part, type HandleOf, type ObjectHandle, type StandardSchemaV1 } from "./index.js";
import { digits, dirty, mask, masked, ruled, rules } from "./plugins.js";

declare function PhoneInput(props: { readonly field: FieldApi<string>; readonly label: string }): null;
declare function NumberInput(props: { readonly field: FieldApi<number> }): null;

const PhoneField = field(PhoneInput, masked({ clean: digits }));

interface Address {
  same: boolean;
  street: string;
}

declare const AddressSchema: StandardSchemaV1<Address>;
const NoParts = createForms().fieldset(AddressSchema);

describe("field types", () => {
  it("take parts that fit the component's value only", () => {
    expectTypeOf(PhoneField.component).toEqualTypeOf<typeof PhoneInput>();
    // @ts-expect-error: a mask cleans strings, and NumberInput's field holds a number
    field(NumberInput, masked({ clean: digits }));
    field(NumberInput);
    const tagged: Part<"tag", string> = { plugin: "tag" };
    expectTypeOf(field(PhoneInput, masked({ clean: digits }), tagged)).toEqualTypeOf<FieldType<typeof PhoneInput, "mask" | "tag">>();
  });

  it("bind on a form with the parts' plugins, and name the missing plugin on one without", () => {
    const withMask = createForms({ plugins: [mask()], fields: { PhoneField } }).define({ defaultValues: { phone: "" } });
    const form = withMask.createStore();
    expectTypeOf(form.root).toEqualTypeOf<ObjectHandle<{ phone: string }, FormError, "mask">>();
    const bare = createForms({ fields: { PhoneField } });
    const scope = bare.scope(bare.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(scope.PhoneField).toEqualTypeOf<{ readonly "Add mask() to this form's plugins: PhoneField uses it": never }>();
  });

  it("pin their parts at a name of a definition that fits them", () => {
    const forms = createForms({ plugins: [mask()] });
    expectTypeOf(PhoneField.at("phone")).toEqualTypeOf<readonly Part<"mask", { readonly phone: string }>[]>();
    forms.define({ defaultValues: { phone: "", age: 1 } }, PhoneField.at("phone"));
    // @ts-expect-error: age holds a number
    forms.define({ defaultValues: { phone: "", age: 1 } }, PhoneField.at("age"));
    // @ts-expect-error: the form has no mask()
    createForms().define({ defaultValues: { phone: "" } }, PhoneField.at("phone"));
  });
});

describe("fieldsets with parts", () => {
  const forms = createForms({ plugins: [dirty(), rules()] });
  const Shape = forms.fieldset<Address, "rules">(ruled({ street: (address) => ({ hidden: address.same }) }));

  it("type each part's value from the shape", () => {
    forms.fieldset<Address, "rules">(
      ruled({
        street: (address) => {
          expectTypeOf(address).toEqualTypeOf<Address>();
          return {};
        },
      }),
    );
    // @ts-expect-error: no field is named "stret"
    forms.fieldset<Address, "rules">(ruled({ stret: () => ({}) }));
  });

  it("take parts after a schema, typed from it", () => {
    const FromSchema = forms.fieldset(
      AddressSchema,
      ruled({
        street: (address) => {
          expectTypeOf(address).toEqualTypeOf<Address>();
          return {};
        },
      }),
    );
    expectTypeOf<HandleOf<typeof FromSchema>>().toEqualTypeOf<ObjectHandle<Address, FormError, "rules">>();
    expectTypeOf<HandleOf<typeof NoParts>>().toEqualTypeOf<ObjectHandle<Address>>();
  });

  it("scope with the shared plugins and the parts', and take handles of forms that have the parts' plugins", () => {
    const store = forms.define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    const scope = Shape.scope(store.root.at("billing"));
    expectTypeOf(scope.root.peek().dirty).toEqualTypeOf<boolean>();
    expectTypeOf<HandleOf<typeof Shape>>().toEqualTypeOf<ObjectHandle<Address, FormError, "rules">>();
    const other = createForms().define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    // @ts-expect-error: the other form has no rules()
    Shape.scope(other.root.at("billing"));
    forms.define({ defaultValues: { billing: { same: true, street: "" } } }, Shape.at("billing"));
  });
});
