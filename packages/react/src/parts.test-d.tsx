import { describe, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, defineField, type FieldType, type FormError, type Part, type HandleOf, type NamedObjectHandle, type StandardSchemaV1 } from "./index.js";
import { definePlugin, dirty, part, ruled, rules } from "./plugins.js";
import { digits, masked } from "./text.js";

declare function PhoneInput(props: { readonly field: FieldApi<string>; readonly label: string }): null;
declare function NumberInput(props: { readonly field: FieldApi<number> }): null;

/** A plugin whose parts cut a string field's value to a length. */
const limit = definePlugin({
  name: "limit",
  part: (_ctx, max: number) => ({ beforeWrite: (write) => (typeof write.value === "string" ? write.value.slice(0, max) : write.value) }),
});
const limited = (max: number): Part<typeof limit, string> => part(limit, max);

const PhoneField = defineField(PhoneInput, limited(10));

interface Address {
  same: boolean;
  street: string;
}

declare const AddressSchema: StandardSchemaV1<Address>;
const NoParts = createForms().fieldset(AddressSchema);

describe("field types", () => {
  it("take parts that fit the component's value only", () => {
    expectTypeOf(PhoneField.component).toEqualTypeOf<typeof PhoneInput>();
    // @ts-expect-error: limited fits strings, and NumberInput's field holds a number
    defineField(NumberInput, limited(10));
    defineField(NumberInput);
    const tags = definePlugin({ name: "tag", part: (_ctx, _config: void) => ({}) });
    const tagged: Part<typeof tags, string> = part(tags);
    expectTypeOf(defineField(PhoneInput, limited(10), tagged)).toEqualTypeOf<FieldType<typeof PhoneInput, "limit" | "tag">>();
  });

  it("take parts that need no plugin, and lists of parts", () => {
    const MaskedField = defineField(PhoneInput, [masked({ clean: digits }), limited(10)]);
    expectTypeOf(MaskedField).toEqualTypeOf<FieldType<typeof PhoneInput, "limit">>();
    const Masked = defineField(PhoneInput, masked({ clean: digits }));
    const bare = createForms({ fields: { Masked } });
    const scope = bare.scope(bare.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(scope.Masked).toBeFunction();
    // @ts-expect-error: masked fits strings
    defineField(NumberInput, [masked({ clean: digits })]);
  });

  it("bind on a form with the parts' plugins, and name the missing plugin on one without", () => {
    const withLimit = createForms({ plugins: [limit()], fields: { PhoneField } }).define({ defaultValues: { phone: "" } });
    const form = withLimit.createStore();
    expectTypeOf(form.root).toEqualTypeOf<NamedObjectHandle<{ phone: string }, FormError, "limit">>();
    const bare = createForms({ fields: { PhoneField } });
    const scope = bare.scope(bare.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(scope.PhoneField).toEqualTypeOf<{ readonly "Add limit() to this form's plugins: PhoneField uses it": never }>();
  });

  it("pin their parts at a name of a definition that fits them", () => {
    const forms = createForms({ plugins: [limit()] });
    expectTypeOf(PhoneField.at("phone")).toEqualTypeOf<readonly Part<typeof limit, { readonly phone: string }>[]>();
    forms.define({ defaultValues: { phone: "", age: 1 } }, PhoneField.at("phone"));
    // @ts-expect-error: age holds a number
    forms.define({ defaultValues: { phone: "", age: 1 } }, PhoneField.at("age"));
    // @ts-expect-error: the form has no limit()
    createForms().define({ defaultValues: { phone: "" } }, PhoneField.at("phone"));
  });
});

describe("fieldsets with parts", () => {
  const forms = createForms({ plugins: [dirty(), rules()] });
  const Shape = forms.fieldset<Address, typeof rules>(ruled({ street: (address) => ({ hidden: address.same }) }));

  it("type each part's value from the shape", () => {
    forms.fieldset<Address, typeof rules>(
      ruled({
        street: (address) => {
          expectTypeOf(address).toEqualTypeOf<Address>();
          return {};
        },
      }),
    );
    // @ts-expect-error: no field is named "stret"
    forms.fieldset<Address, typeof rules>(ruled({ stret: () => ({}) }));
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
    expectTypeOf<HandleOf<typeof FromSchema>>().toEqualTypeOf<NamedObjectHandle<Address, FormError, "rules">>();
    expectTypeOf<HandleOf<typeof NoParts>>().toEqualTypeOf<NamedObjectHandle<Address>>();
  });

  it("scope with the shared plugins and the parts', and take handles of forms that have the parts' plugins", () => {
    const store = forms.define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    const scope = Shape.scope(store.root.at("billing"));
    expectTypeOf(scope.root.peek().dirty).toEqualTypeOf<boolean>();
    expectTypeOf<HandleOf<typeof Shape>>().toEqualTypeOf<NamedObjectHandle<Address, FormError, "rules">>();
    const other = createForms().define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    // @ts-expect-error: the other form has no rules()
    Shape.scope(other.root.at("billing"));
    forms.define({ defaultValues: { billing: { same: true, street: "" } } }, Shape.at("billing"));
  });
});
