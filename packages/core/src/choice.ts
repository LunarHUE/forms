import type { FieldHandle } from "./handle.js";
import type { Draft, ItemOf } from "./value.js";

/** One member of `Choice`. `B` is the type the option values must have. */
interface ChoiceMember<K, B> {
  /** Type information only. No value of a `Choice` type exists at runtime. */
  readonly "~choice": readonly [K, B];
}

/** Any member of any `Choice`. */
type AnyChoice = ChoiceMember<"a" | "b", string | number>;

/**
 * A stand-in for the option values of the field a component is used on, for
 * select, radio group and checkbox group components. The component is
 * written once, with `Choice` where the option type goes:
 *
 * ```tsx
 * function SelectField(props: { field: FieldApi<Choice>; options: readonly Option<Choice>[] }) { ... }
 * function CheckboxGroupField(props: { field: FieldApi<Choice[]>; options: readonly Option<Choice>[] }) { ... }
 * ```
 *
 * When the component is registered with `createForms`, each use puts the
 * named field's option type in place of every `Choice` in the component's
 * own props. So on a `"GB" | "IE"` field, `options` takes `"GB"` and `"IE"`
 * only. Inside the component `Choice` is an ordinary string (or number, with
 * `Choice<number>`), and the only values of it are the ones the props bring
 * in, so the component can write to the field only what it was given.
 *
 * A field fits when its value is a string type, or an array of one, as the
 * `FieldApi` rules put it: `FieldApi<Choice>` fits a picklist, which holds
 * `"GB" | "IE" | undefined` in a schema form, and a plain `string` field.
 * `Choice` is a union of two members so that `Draft<Choice>`, like the
 * `Draft` of a union of literals, includes `undefined`. `Choice` is looked
 * for in a component's props at most four levels deep.
 */
export type Choice<B extends string | number = string> = (B & ChoiceMember<"a", B>) | (B & ChoiceMember<"b", B>);

/** True when `T`, or the item type of an array `T`, is a `Choice`. */
export type HasChoice<T> = 0 extends 1 & T ? false : true extends ChoiceIn<T> ? true : false;

type ChoiceIn<T> = T extends AnyChoice ? true : T extends readonly (infer I)[] ? ChoiceIn<I> : false;

/** The type the option values of `T` must have: `B` of the `Choice<B>` in it. */
type ChoiceBase<T> = T extends ChoiceMember<unknown, infer B> ? B : T extends readonly (infer I)[] ? ChoiceBase<I> : never;

/** `W` without `null` and `undefined`. A conditional, so errors show the members, not `NonNullable`. */
type Present<W> = W extends null | undefined ? never : W;

/** The options a field of value `W` gives `T`: `W` matched against `T`, read where `Choice` stands. */
type OptionsAt<T, W> = T extends AnyChoice ? Present<W> : T extends readonly (infer I)[] ? OptionsAt<I, ItemOf<W>> : never;

/**
 * The option type a field of value `W` puts in place of `Choice` in `T`. A
 * `"GB" | "IE" | undefined` field gives `"GB" | "IE"` to `Choice`, and a
 * `("a" | "b" | undefined)[]` field gives `"a" | "b"` to `Choice[]`. When the
 * options found are not of the `Choice`'s base type, it is the base type, so
 * a `boolean` field gives `string` and then fails `ChoiceHandle`.
 */
export type ChoiceValue<T, W> = [OptionsAt<T, W>] extends [never]
  ? ChoiceBase<T>
  : [OptionsAt<T, W>] extends [ChoiceBase<T>]
    ? OptionsAt<T, W>
    : ChoiceBase<T>;

/** True when `T` contains a `Choice`, looking `D` levels deep at most. */
type Mentions<T, D extends readonly unknown[] = []> = D["length"] extends 4
  ? false
  : 0 extends 1 & T
    ? false
    : true extends MentionsIn<T, [...D, 0]>
      ? true
      : false;

type MentionsIn<T, D extends readonly unknown[]> = T extends AnyChoice
  ? true
  : T extends string | number | boolean | bigint | symbol | null | undefined
    ? false
    : T extends readonly (infer I)[]
      ? Mentions<I, D>
      : T extends (...args: infer A) => infer R
        ? Mentions<A, D> | Mentions<R, D>
        : T extends object
          ? { [K in keyof T]-?: Mentions<T[K], D> }[keyof T]
          : false;

/**
 * `T` with every `Choice` in it replaced by `X`, through arrays, object
 * properties and function parameters and results. Types with no `Choice`
 * in them are kept as they are.
 */
export type WithChoice<T, X> = Mentions<T> extends true ? WithChoiceIn<T, X> : T;

type WithChoiceIn<T, X> = T extends AnyChoice
  ? X
  : T extends (...args: infer A) => infer R
    ? (...args: WithChoice<A, X>) => WithChoice<R, X>
    : T extends object
      ? { [K in keyof T]: WithChoice<T[K], X> }
      : T;

/**
 * The handles a `FieldApi<T>` component, with `T` written with `Choice`,
 * takes for a field of value `W`: those of `Draft` of `T` and of `T` itself,
 * with the field's options in place of `Choice` (see `ChoiceValue`). A field
 * fits when its own handle is assignable to one of them.
 */
export type ChoiceHandle<T, W, E> =
  | FieldHandle<Draft<WithChoice<T, ChoiceValue<T, W>>>, E>
  | FieldHandle<WithChoice<T, ChoiceValue<T, W>>, E>;
