import type { ChildValue, KeysOf, ShapeOf } from "@lunarhue/forms-core";

/**
 * Countdown for the path types' recursion. `Prev[D]` is one less than `D`.
 * At 1 it is `never`, so a path has at most `D` segments.
 */
type Prev = [never, never, 1, 2, 3, 4, 5, 6, 7];

/**
 * The most segments a `FieldPath` has. A field deeper than this has no name,
 * but its handle still works: `form.root.at("a").at("b")` and so on.
 */
export type PathMaxDepth = 8;

/**
 * Every dotted name that `name` props accept for a value of type `V`: object
 * keys joined with `.`, up to `PathMaxDepth` segments. A path goes through
 * objects only. It stops at an array, so the array field itself has a name
 * and its items don't. Leaves and objects have names too.
 */
export type FieldPath<V, D extends number = PathMaxDepth> = [D] extends [never]
  ? never
  : ShapeOf<V> extends "object"
    ? {
        [K in KeysOf<V>]:
          | `${K}`
          | (ShapeOf<ChildValue<V, K>> extends "object" ? `${K}.${FieldPath<ChildValue<V, K>, Prev[D]>}` : never);
      }[KeysOf<V>]
    : never;

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
