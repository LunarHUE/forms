import { describe, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, defineField, type FieldType, type FormError, type HandleOf, type NamedObjectHandle, type Part } from "./index.js";
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

describe("field types", () => {
  it("take parts that fit the component's value only", () => {
    expectTypeOf(PhoneField).toEqualTypeOf<FieldType<typeof PhoneInput, "limit">>();
    // @ts-expect-error: limited fits strings, and NumberInput's field holds a number
    defineField(NumberInput, limited(10));
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
    const bare = createForms({ fields: { PhoneField } });
    const scope = bare.scope(bare.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(scope.PhoneField).toEqualTypeOf<{ readonly "Add limit() to this form's plugins: PhoneField uses it": never }>();
    const withLimit = createForms({ plugins: [limit()], fields: { PhoneField } });
    const bound = withLimit.scope(withLimit.define({ defaultValues: { phone: "" } }).createStore().root);
    expectTypeOf(bound.PhoneField).toBeFunction();
  });

  it("pin their parts at a name of a definition that fits them", () => {
    expectTypeOf(PhoneField.at("phone")).toEqualTypeOf<readonly Part<typeof limit, { readonly phone: string }>[]>();
    createForms({ plugins: [limit()] }).define({ defaultValues: { phone: "" } }, PhoneField.at("phone"));
    // @ts-expect-error: the form has no limit()
    createForms().define({ defaultValues: { phone: "" } }, PhoneField.at("phone"));
  });
});

describe("fieldsets with parts", () => {
  const forms = createForms({ plugins: [dirty(), rules()] });
  const Shape = forms.fieldset<Address, typeof rules>(ruled({ street: (address) => ({ hidden: address.same }) }));

  it("scope with the shared plugins and the parts', and take handles of forms that have the parts' plugins", () => {
    expectTypeOf<HandleOf<typeof Shape>>().toEqualTypeOf<NamedObjectHandle<Address, FormError, "rules">>();
    const store = forms.define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    expectTypeOf(Shape.scope(store.root.at("billing")).root.peek().dirty).toEqualTypeOf<boolean>();
    const other = createForms().define({ defaultValues: { billing: { same: true, street: "" } } }).createStore();
    // @ts-expect-error: the other form has no rules()
    Shape.scope(other.root.at("billing"));
  });
});
