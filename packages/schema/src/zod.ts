import type { Path, SchemaAdapter } from "@lunarhue/forms-core";
import type { $ZodType, $ZodTypes } from "zod/v4/core";

/** A Zod 4 schema, from `zod` or `zod/mini`. */
export type ZodSchema = $ZodType;

type Def = $ZodTypes["_zod"]["def"];

// Every Zod 4 schema is one of the classes in `$ZodTypes`, and `def.type` tells them apart.
// A Zod 3 schema reports the same vendor but has no `_zod`, so its def is undefined.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion, no-underscore-dangle
const defOf = (schema: ZodSchema): Def | undefined => (schema as Partial<$ZodTypes>)._zod?.def;

const isDefault = (schema: ZodSchema) => {
  const type = defOf(schema)?.type;
  return type === "default" || type === "prefault";
};

/**
 * The value a form with `schema` starts from. Strings start empty, booleans
 * false, arrays empty, and objects with each entry's value. A declared
 * default or prefault wins. A discriminated union starts on its first option.
 * A number, an enum, a plain union and anything else with no empty value of
 * its type start undefined. A pipe reads as its input side.
 */
function defaultValue(schema: ZodSchema): unknown {
  const d = defOf(schema);
  switch (d?.type) {
    case "string":
      return "";
    case "boolean":
      return false;
    case "array":
      return [];
    case "literal":
      return d.values[0];
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(d.shape)) out[key] = defaultValue(entry);
      return out;
    }
    // The def reads the default through a getter, so each call gets a fresh value.
    case "default":
    case "prefault":
      return d.defaultValue;
    // Zod puts a default inside the wrapper when `.default()` comes before `.optional()`.
    case "optional":
    case "nullable":
      if (isDefault(d.innerType)) return defaultValue(d.innerType);
      return d.type === "nullable" ? null : undefined;
    case "nonoptional":
    case "readonly":
    case "catch":
      return defaultValue(d.innerType);
    case "pipe":
      return defaultValue(d.in);
    case "union": {
      const first = d.options[0];
      return "discriminator" in d && first ? defaultValue(first) : undefined;
    }
    // A lazy schema has no value of its own, which also stops a recursive schema from expanding forever.
    default:
      return undefined;
  }
}

/** Strips wrappers, pipes and lazy schemas. Undefined for a schema that isn't Zod 4. */
function resolve(schema: ZodSchema): ZodSchema | undefined {
  let s = schema;
  for (;;) {
    const d = defOf(s);
    switch (d?.type) {
      case "optional":
      case "nullable":
      case "nonoptional":
      case "default":
      case "prefault":
      case "readonly":
      case "catch":
        s = d.innerType;
        break;
      case "pipe":
        s = d.in;
        break;
      case "lazy":
        s = d.getter();
        break;
      default:
        return d && s;
    }
  }
}

/** The schema of the entry `key` of an object, or of the first discriminated union option that has one. */
function entryOf(schema: ZodSchema, key: string): ZodSchema | undefined {
  const d = defOf(schema);
  if (d?.type === "object") return d.shape[key];
  if (d?.type !== "union" || !("discriminator" in d)) return undefined;
  for (const option of d.options) {
    const resolved = resolve(option);
    const found = resolved && entryOf(resolved, key);
    if (found) return found;
  }
  return undefined;
}

const itemOf = (schema: ZodSchema) => {
  const d = defOf(schema);
  return d?.type === "array" ? d.element : undefined;
};

/**
 * The value a new item of the array at stable path `path` starts from. Under
 * an array every segment is an item key, so it steps to the item schema.
 * Undefined when the path doesn't lead to an array schema.
 */
function itemValue(schema: ZodSchema, path: Path): unknown {
  let s = resolve(schema);
  for (const segment of path) {
    if (!s) return undefined;
    const next = itemOf(s) ?? entryOf(s, String(segment));
    s = next && resolve(next);
  }
  const item = s && itemOf(s);
  return item && defaultValue(item);
}

const adapter: SchemaAdapter<ZodSchema> = { vendor: "zod", defaultValue, itemValue };

/** The Zod 4 schema adapter for `createFormsCore({ schemas: [zod()] })`. Takes `zod` and `zod/mini` schemas. */
export function zod(): SchemaAdapter<ZodSchema> {
  return adapter;
}
