import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore, debounced, fieldValidators, formValidator, recheckOnSubmit, validateOn } from "./index.js";
import type {
  ErrorMap,
  FieldValidatorSet,
  FieldValidators,
  FormError,
  FormValidatorInput,
  FormValidatorSet,
  Path,
  StandardSchemaV1,
  Validator,
  ValidatorContext,
  ValidatorInput,
  ValidatorResult,
  WrappedSchema,
} from "./index.js";

interface Order {
  email: string;
  note?: string;
  address: { city: string; zip: string };
  lines: { sku: string; qty: number }[];
  tags: string[];
}

declare const stringSchema: StandardSchemaV1<string>;
declare const numberSchema: StandardSchemaV1<number>;
declare const addressSchema: StandardSchemaV1<{ city: string; zip: string }>;
declare const orderSchema: StandardSchemaV1<Order, { email: string }>;

const sync: Validator<string> = (value) => (value ? undefined : { message: "required" });
const async: Validator<string> = async (value, ctx) => {
  expectTypeOf(ctx.path).toEqualTypeOf<Path>();
  expectTypeOf(ctx.signal.aborted).toEqualTypeOf<boolean>();
  return value ? null : [{ message: "a" }, { message: "b" }];
};
const tooSmall: Validator<number, "too-small"> = (value) => (value > 0 ? undefined : "too-small");
// @ts-expect-error: the error type is the literal "too-small"
const wrongError: Validator<number, "too-small"> = () => "other";
const formCheck: FormValidatorInput<Order> = (value) =>
  value.email ? undefined : { fields: { email: { message: "required" }, "lines.0.qty": [] } };

describe("Validator", () => {
  it("covers sync and async with one function type", () => {
    expectTypeOf(sync).toExtend<ValidatorInput<string>>();
    expectTypeOf(async).toExtend<ValidatorInput<string>>();
  });

  it("returns the form's error type, not through mapError", () => {
    expectTypeOf(tooSmall).parameter(1).toEqualTypeOf<ValidatorContext<"too-small">>();
    expectTypeOf(wrongError).returns.toEqualTypeOf<ValidatorResult<"too-small"> | Promise<ValidatorResult<"too-small">>>();
  });
});

describe("ValidatorInput", () => {
  it("accepts a function, a schema and either one wrapped", () => {
    expectTypeOf(stringSchema).toExtend<ValidatorInput<string>>();
    expectTypeOf(debounced(validateOn(stringSchema, "blur"), 300)).toExtend<ValidatorInput<string>>();
    expectTypeOf(recheckOnSubmit((value: string) => (value ? undefined : { message: "x" }))).toExtend<ValidatorInput<string>>();
  });

  it("takes a schema with a narrower input as a check on a wider field", () => {
    expectTypeOf(stringSchema).toExtend<ValidatorInput<string | undefined>>();
  });

  it("rejects a validator or schema for another value type", () => {
    expectTypeOf(numberSchema).not.toExtend<ValidatorInput<string>>();
    expectTypeOf<Validator<number>>().not.toExtend<ValidatorInput<string>>();
    expectTypeOf(debounced(numberSchema, 300)).not.toExtend<ValidatorInput<string>>();
    expectTypeOf(validateOn((value: number) => (value ? undefined : { message: "x" }), "input")).not.toExtend<
      ValidatorInput<string>
    >();
  });
});

describe("FieldValidators", () => {
  it("takes every form at a leaf", () => {
    const fields: FieldValidators<Order> = {
      email: (value) => (value.includes("@") ? undefined : { message: "email" }),
      note: stringSchema,
      tags: validateOn((value) => (value.length > 3 ? { message: "too many" } : undefined), "submit"),
    };
    expectTypeOf(fields).toExtend<FieldValidators<Order>>();
  });

  it("takes nested records and the array tuple", () => {
    const fields: FieldValidators<Order> = {
      address: { city: stringSchema, zip: (value) => (value.length === 5 ? undefined : { message: "zip" }) },
      lines: [{ qty: (value) => (value > 0 ? undefined : { message: "qty" }) }],
      tags: [stringSchema],
    };
    expectTypeOf(fields).toExtend<FieldValidators<Order>>();
  });

  it("takes a validator for an object or array node itself", () => {
    const fields: FieldValidators<Order> = {
      address: addressSchema,
      lines: (value) => (value.length === 0 ? { message: "empty" } : undefined),
    };
    expectTypeOf(fields).toExtend<FieldValidators<Order>>();
    expectTypeOf(orderSchema).toExtend<FieldValidators<Order>>();
  });

  it("rejects a validator for the wrong value type", () => {
    const fields: FieldValidators<Order> = {
      // @ts-expect-error: qty is a number, not a string
      lines: [{ qty: (value: string) => (value ? undefined : { message: "x" }) }],
    };
    const schemas: FieldValidators<Order> = {
      // @ts-expect-error: email holds a string, the schema checks numbers
      email: numberSchema,
    };
    const keys: FieldValidators<Order> = {
      // @ts-expect-error: Order has no key "nope"
      nope: stringSchema,
    };
    expectTypeOf([fields, schemas, keys]).items.toExtend<FieldValidators<Order>>();
  });

  it("does not read a schema as a nested record", () => {
    expectTypeOf(numberSchema).not.toExtend<FieldValidators<Order["address"]>>();
  });

  it("takes the item validator for an optional array", () => {
    expectTypeOf<readonly [Validator<string>]>().toExtend<FieldValidators<string[] | undefined>>();
  });
});

describe("FormValidatorInput", () => {
  it("returns an ErrorMap", () => {
    expectTypeOf(formCheck).toExtend<FormValidatorInput<Order>>();
    expectTypeOf(orderSchema).toExtend<FormValidatorInput<Order>>();
    expectTypeOf<ErrorMap<FormError>["fields"]>().toEqualTypeOf<
      Readonly<Record<string, FormError | readonly FormError[] | undefined>> | undefined
    >();
  });
});

describe("timing wrappers", () => {
  it("types an inline check from where it goes, through nested wrappers in any order", () => {
    const fields: FieldValidators<Order> = {
      email: debounced(
        validateOn(
          recheckOnSubmit(async (value, ctx) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            expectTypeOf(ctx).toEqualTypeOf<ValidatorContext<FormError>>();
            return value ? undefined : { message: "required" };
          }),
          "input",
        ),
        300,
      ),
      address: {
        zip: recheckOnSubmit(
          debounced((value) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            return undefined;
          }, 300),
        ),
      },
      lines: [{ qty: validateOn(debounced((value) => (value > 0 ? undefined : { message: "qty" }), 100), "blur") }],
    };
    expectTypeOf(fields).toExtend<FieldValidators<Order>>();
  });

  it("types a form validator the same way", () => {
    const form: FormValidatorInput<Order> = debounced(
      validateOn((value) => {
        expectTypeOf(value).toEqualTypeOf<Order>();
        return value.email ? undefined : { fields: { email: { message: "required" } } };
      }, "input"),
      300,
    );
    expectTypeOf(form).toExtend<FormValidatorInput<Order>>();
  });

  it("keeps a wrapped schema's input type, however deep", () => {
    expectTypeOf(debounced(stringSchema, 300)).toEqualTypeOf<WrappedSchema<string>>();
    expectTypeOf(recheckOnSubmit(validateOn(debounced(stringSchema, 300), "input"))).toEqualTypeOf<WrappedSchema<string>>();
  });

  it("rejects a wrapped check for another value type", () => {
    const fields: FieldValidators<Order> = {
      // @ts-expect-error: email holds a string, the schema checks numbers
      email: debounced(validateOn(numberSchema, "input"), 300),
    };
    expectTypeOf(fields).toExtend<FieldValidators<Order>>();
  });
});

describe("fieldValidators and formValidator", () => {
  const core = createFormsCore();
  const order: Order = { email: "", address: { city: "", zip: "" }, lines: [], tags: [] };

  it("take the value type from the definition when written inline", () => {
    core.define({
      defaultValues: order,
      validate: {
        fields: fieldValidators({
          email: debounced((value) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            return undefined;
          }, 300),
          lines: [{ qty: (value) => (value > 0 ? undefined : { message: "qty" }) }],
        }),
        form: formValidator((value) => {
          expectTypeOf(value).toEqualTypeOf<Order>();
          return undefined;
        }),
      },
    });
  });

  it("take the value type as a type argument when defined on their own", () => {
    const fields = fieldValidators<Order>({ email: (value) => (value ? undefined : { message: "required" }) });
    expectTypeOf(fields).toEqualTypeOf<FieldValidatorSet<Order>>();
    expectTypeOf(formValidator(orderSchema)).toEqualTypeOf<FormValidatorSet<Order>>();
    core.define({ defaultValues: order, validate: { fields, form: formValidator(orderSchema) } });
  });

  it("reject a bare record, a bare function and a set in the wrong slot", () => {
    // @ts-expect-error: fields takes fieldValidators({...})
    core.define({ defaultValues: order, validate: { fields: { email: sync } } });
    // @ts-expect-error: form takes formValidator(check)
    core.define({ defaultValues: order, validate: { form: () => undefined } });
    // @ts-expect-error: a form validator set doesn't go in fields
    core.define({ defaultValues: order, validate: { fields: formValidator(() => undefined) } });
    expectTypeOf<FieldValidatorSet<Order>>().not.toEqualTypeOf<FormValidatorSet<Order>>();
  });

  it("reject a set for another value type", () => {
    const other = fieldValidators<{ name: string }>({ name: sync });
    // @ts-expect-error: the set checks another value
    core.define({ defaultValues: order, validate: { fields: other } });
    expectTypeOf(other).not.toExtend<FieldValidatorSet<Order>>();
  });
});
