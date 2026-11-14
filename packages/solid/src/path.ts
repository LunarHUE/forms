import type { ChildValue, FieldPath, ShapeOf } from "@lunarhue/forms-core";

export type { FieldPath, PathMaxDepth } from "@lunarhue/forms-core";

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
