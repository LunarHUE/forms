import type { ErrorMap, FormError } from "../../errors.js";
import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { FormValidator, FormValidatorInput, FormValidatorSet, SchemaInput, WrappedSchema } from "../../validator.js";
import type { StoreCore } from "../core.js";
import { addErrors, addNamed, type Placed } from "../placed.js";
import type { Registration } from "../validation.js";
import { type Spec, toSpec } from "./inputs.js";
import type { Pattern } from "./paths.js";
import { listOf } from "./place.js";

/**
 * Wraps a definition's form validator: `validate: { form:
 * formValidator(check) }`. The check gets the whole value and returns an
 * `ErrorMap`, whose errors land on the form and on the fields it names. It
 * is a function, a Standard Schema, or either wrapped the way a field
 * validator is.
 *
 * A form without one doesn't ship the code that reads an `ErrorMap`.
 */
export function formValidator<V, E = FormError>(validator: FormValidator<V, E>): FormValidatorSet<V, E>;
// A schema's input type is only the default for `V`, so a schema for `User` also checks a form whose value is `Draft<User>`.
export function formValidator<S extends StandardSchemaV1 | WrappedSchema, V = SchemaInput<S>, E = FormError>(
  schema: S & FormValidatorInput<NoInfer<V>, E>,
): FormValidatorSet<V, E>;
export function formValidator<V, E>(validator: FormValidatorInput<V, E>): FormValidatorSet<V, E> {
  const install = (add: (pattern: Pattern, spec: Spec) => Registration) => {
    const spec = toSpec(validator, "form");
    if (spec)
      // `place` takes the form's error type, which `Spec` leaves open.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      add([], {
        ...spec,
        // A name that resolves to no field lands on the root after the form errors, so it still blocks submit.
        place: spec.schema
          ? undefined
          : (placed: Placed<E>, core: StoreCore<E, unknown>, base, result) => {
              // A form validator returns an `ErrorMap`, and `base` is the root.
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              const map = result as ErrorMap<E>;
              addErrors(placed, base, listOf(map.form));
              for (const [name, errors] of Object.entries(map.fields ?? {})) addNamed(placed, core, name, listOf(errors));
            },
      } as Spec);
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return install as unknown as FormValidatorSet<V, E>;
}
