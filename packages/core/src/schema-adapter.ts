import type { Path } from "./path.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

/**
 * Teaches core the default values of one schema library's schemas.
 * Validation and types go through Standard Schema, so this is all an
 * adapter does. `S` is the schema type the adapter supports. A schema of that
 * type gets automatic defaults, so its form's `defaultValues` is optional.
 */
export interface SchemaAdapter<S extends StandardSchemaV1 = StandardSchemaV1> {
  /** Matched against `schema["~standard"].vendor` to pick the adapter for a schema at runtime. */
  readonly vendor: string;
  /** Returns the value a form with this schema starts from when `defaultValues` leaves it out. */
  defaultValue(schema: S): unknown;
  /**
   * Returns the value a new item of the array at `path` gets from `push` or
   * `insert` with no item. `path` is a stable path into the form's value.
   */
  itemValue(schema: S, path: Path): unknown;
}

/** The schema types a list of adapters supports. */
export type AdapterSchema<A extends readonly SchemaAdapter<never>[]> =
  A[number] extends infer T ? (T extends SchemaAdapter<infer S> ? S : never) : never;

/** True when one of the adapters in `A` supports schema type `S`. */
export type HasAdapter<S, A extends readonly SchemaAdapter<never>[]> = [S] extends [never]
  ? false
  : [S] extends [AdapterSchema<A>]
    ? true
    : false;
