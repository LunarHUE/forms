import { describe, expectTypeOf, it } from "vitest";
import type { Choice, ChoiceValue, Draft, HasChoice, WithChoice } from "./index.js";

interface Option<T> {
  readonly value: T;
  readonly label: string;
}

interface Props {
  readonly label: string;
  readonly options: readonly Option<Choice>[];
  readonly onPick?: (value: Choice, index: number) => void;
  readonly when: Date;
}

describe("Choice", () => {
  it("drafts like a union of literals", () => {
    expectTypeOf<Draft<Choice>>().toEqualTypeOf<Choice | undefined>();
    expectTypeOf<Draft<Choice[]>>().toEqualTypeOf<Choice[]>();
  });

  it("is found in a field type", () => {
    expectTypeOf<HasChoice<Choice>>().toEqualTypeOf<true>();
    expectTypeOf<HasChoice<Choice<number>[]>>().toEqualTypeOf<true>();
    expectTypeOf<HasChoice<string>>().toEqualTypeOf<false>();
    expectTypeOf<HasChoice<string[]>>().toEqualTypeOf<false>();
    expectTypeOf<HasChoice<"a">>().toEqualTypeOf<false>();
  });

  it("reads the options from the field's value", () => {
    expectTypeOf<ChoiceValue<Choice, "a" | "b" | undefined>>().toEqualTypeOf<"a" | "b">();
    expectTypeOf<ChoiceValue<Choice, string>>().toEqualTypeOf<string>();
    expectTypeOf<ChoiceValue<Choice[], ("a" | "b" | undefined)[]>>().toEqualTypeOf<"a" | "b">();
    expectTypeOf<ChoiceValue<Choice<number>, 1 | 2 | undefined>>().toEqualTypeOf<1 | 2>();
    // Options of another type than the Choice's give the base type, which the field then fails to fit.
    expectTypeOf<ChoiceValue<Choice, 1 | 2>>().toEqualTypeOf<string>();
    expectTypeOf<ChoiceValue<Choice, undefined>>().toEqualTypeOf<string>();
  });

  it("is replaced in props, and the rest is kept", () => {
    type Bound = WithChoice<Props, "a" | "b">;
    expectTypeOf<Bound["options"]>().toEqualTypeOf<readonly { readonly value: "a" | "b"; readonly label: string }[]>();
    expectTypeOf<Bound["onPick"]>().toEqualTypeOf<((value: "a" | "b", index: number) => void) | undefined>();
    expectTypeOf<Bound["when"]>().toEqualTypeOf<Date>();
    expectTypeOf<WithChoice<{ readonly when: Date }, "a">>().toEqualTypeOf<{ readonly when: Date }>();
  });
});
