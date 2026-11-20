import type { Path, Plugin } from "@lunarhue/forms-core";
import { getDefault, type GenericSchema, type GenericSchemaAsync } from "valibot";

// The declarations bundle core's types, so a consumer's emitted declarations
// can name the type valibot() returns only through this entry.
export type { Plugin };

/** A valibot schema, sync or async. */
export type ValibotSchema = GenericSchema | GenericSchemaAsync;

/** The fields of a valibot schema this module reads, without its generics. */
// Each field other than `type` is present only on the schema types that have
// it, so callers check `type` before reading one.
interface Node {
  readonly type: string;
  readonly wrapped: ValibotSchema;
  readonly default: unknown;
  readonly entries: Readonly<Record<string, ValibotSchema | undefined>>;
  readonly item: ValibotSchema;
  readonly options: readonly ValibotSchema[];
  readonly literal: unknown;
  readonly getter: (input: unknown) => unknown;
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const node = (schema: ValibotSchema) => schema as unknown as Node;

const wrappers = /* @__PURE__ */ new Set(["optional", "exact_optional", "undefinedable", "nullable", "nullish"]);
const narrowers = /* @__PURE__ */ new Set(["non_optional", "non_nullable", "non_nullish"]);
const objects = /* @__PURE__ */ new Set(["object", "loose_object", "strict_object", "object_with_rest"]);

const isPromise = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" && value !== null && typeof Reflect.get(value, "then") === "function";

const isSchema = (value: unknown): value is ValibotSchema =>
  typeof value === "object" && value !== null && Reflect.get(value, "kind") === "schema";

/**
 * The value a form with `schema` starts from. Strings start empty, booleans
 * false, arrays empty, and objects with each entry's value. A wrapper's
 * declared default wins. A variant starts on its first option. A number, a
 * picklist and anything else with no empty value of its type start
 * undefined. A pipe has the type of its first schema, so it reads as that
 * schema.
 */
function defaultValue(schema: ValibotSchema): unknown {
  const s = node(schema);
  if (wrappers.has(s.type)) {
    if (s.default !== undefined) {
      const value: unknown = getDefault(schema);
      // An async default can't be used for a value that has to exist now.
      if (!isPromise(value)) return value;
    }
    return s.type === "nullable" ? null : undefined;
  }
  if (narrowers.has(s.type)) return defaultValue(s.wrapped);
  if (objects.has(s.type)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(s.entries)) if (entry) out[key] = defaultValue(entry);
    return out;
  }
  switch (s.type) {
    case "string":
      return "";
    case "boolean":
      return false;
    case "array":
      return [];
    case "literal":
      return s.literal;
    case "variant": {
      const first = s.options[0];
      return first ? defaultValue(first) : undefined;
    }
    // A lazy schema has no value of its own, which also stops a recursive schema from expanding forever.
    default:
      return undefined;
  }
}

/** Strips wrappers and lazy schemas. Undefined when a lazy getter gives no schema, as an async one does. */
function resolve(schema: ValibotSchema): ValibotSchema | undefined {
  let s: ValibotSchema = schema;
  while (true) {
    const n = node(s);
    if (wrappers.has(n.type) || narrowers.has(n.type)) s = n.wrapped;
    else if (n.type === "lazy") {
      // The walk has no value to pass. Getters that build a recursive schema don't read it.
      const next = n.getter(undefined);
      if (!isSchema(next)) return undefined;
      s = next;
    } else return s;
  }
}

/** The schema of the entry `key` of an object, or of the first variant option that has one. */
function entryOf(schema: ValibotSchema, key: string): ValibotSchema | undefined {
  const s = node(schema);
  if (objects.has(s.type)) return s.entries[key];
  if (s.type !== "variant") return undefined;
  for (const option of s.options) {
    const found = entryOf(option, key);
    if (found) return found;
  }
  return undefined;
}

/**
 * The value a new item of the array at stable path `path` starts from. Under
 * an array every segment is an item key, so it steps to the item schema.
 * Undefined when the path doesn't lead to an array schema.
 */
function itemValue(schema: ValibotSchema, path: Path): unknown {
  let s = resolve(schema);
  for (const segment of path) {
    if (!s) return undefined;
    const next = node(s).type === "array" ? node(s).item : entryOf(s, String(segment));
    s = next && resolve(next);
  }
  return s && node(s).type === "array" ? defaultValue(node(s).item) : undefined;
}

const plugin: Plugin<undefined, "valibot", never, never, ValibotSchema> = { name: "valibot", schema: { vendor: "valibot", defaultValue, itemValue } };

/**
 * The valibot schema plugin, for `createForms({ plugins: [valibot()] })`.
 * `define` then takes a valibot schema and starts its form from the
 * schema's defaults.
 */
export function valibot(): Plugin<undefined, "valibot", never, never, ValibotSchema> {
  return plugin;
}
