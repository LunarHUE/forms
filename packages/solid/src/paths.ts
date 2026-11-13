import type { ChildValue, KeysOf, ShapeOf } from "@lunarhue/forms-core";

/** How many segments a field name can have. Deeper fields are reached with `handle` or a scope. */
export type MaxPathDepth = 6;

/**
 * The dotted names of the fields in a value of type `V`, such as
 * `"address.city"`. A name goes through plain objects only: it has no array
 * indexes, and it stops at an array, so the array field itself has a name
 * but its items don't. Reach items with `Items` and the item handle. A name
 * has at most `MaxPathDepth` segments.
 */
export type FieldPath<V> = PathsOf<V, []>;

/** The names of `FieldPath<V>` at depth `D["length"]` and below. */
type PathsOf<V, D extends readonly unknown[]> = D["length"] extends MaxPathDepth
  ? never
  : {
      [K in KeysOf<V>]: `${K}` | (ShapeOf<ChildValue<V, K>> extends "object" ? `${K}.${PathsOf<ChildValue<V, K>, [...D, 0]>}` : never);
    }[KeysOf<V>];

/**
 * The value type of the field named `P` in a value of type `V`. Along the
 * way it follows core's `ChildValue`, so a key missing from some members of
 * a union, or a parent that may be undefined, adds `undefined`.
 */
export type ValueAt<V, P extends string> = P extends `${infer K}.${infer Rest}` ? ValueAt<ChildValue<V, K>, Rest> : ChildValue<V, P>;

/** The names of the array fields in `V`, for `Items`. */
export type ArrayPath<V> = {
  [P in FieldPath<V>]: ShapeOf<ValueAt<V, P>> extends "array" ? P : never;
}[FieldPath<V>];
