import type { ChildValue, FieldPath, KeysOf, ShapeOf } from "@lunarhue/forms-core";

export type { FieldPath, PathMaxDepth } from "@lunarhue/forms-core";

/** The key of `V` whose text is `S`, so a number key matches its digits. */
type KeyFor<V, S extends string> = { [K in KeysOf<V>]: `${K}` extends S ? K : never }[KeysOf<V>];

/** The value type at dotted name `P` of `V`. */
export type ValueAt<V, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? ValueAt<ChildValue<V, KeyFor<V, Head>>, Rest>
  : ChildValue<V, KeyFor<V, P>>;

/** The names in `FieldPath<V>` whose field is an array, for `Items`. */
export type ArrayPath<V> = FieldPath<V> extends infer P
  ? P extends string
    ? ShapeOf<ValueAt<V, P>> extends "array"
      ? P
      : never
    : never
  : never;
