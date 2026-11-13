import type { SchemaPlugin, ValidationPlugin } from "../plugin.js";
import type { SchemaAdapter } from "../schema-adapter.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { createValidation } from "../store/validation.js";

const plugin: ValidationPlugin = { name: "validation", validation: createValidation };

/**
 * The validation runner as a plugin: field and form validators, their
 * timing, debounce and async runs, and placing their errors on fields.
 * Install it for function validators, or for a Standard Schema of a library
 * with no schema plugin, such as arktype, whose form then gives complete
 * `defaultValues`: `createForms({ plugins: [validation()] })`. Every schema
 * plugin brings the runner too, so a form with `valibot()` or `zod()`
 * doesn't need it.
 *
 * Without the runner a form still holds errors: `setErrors` and server
 * errors work, and `validate()` resolves valid. The compiler rejects a
 * definition's `schema` and `validate` and a component's `validate` prop.
 */
export function validation(): ValidationPlugin {
  return plugin;
}

/**
 * Makes a schema plugin from a schema adapter. It brings the validation
 * runner with it, so installing the plugin is all a schema form needs. Its
 * name is the adapter's vendor.
 */
export function defineSchemaPlugin<S extends StandardSchemaV1>(adapter: SchemaAdapter<S>): SchemaPlugin<S> {
  return { name: adapter.vendor, schema: adapter, validation: createValidation };
}
