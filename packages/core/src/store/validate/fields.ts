import type { FormError } from "../../errors.js";
import type { Path } from "../../path.js";
import type { FieldValidators, FieldValidatorSet, ValidatorKind } from "../../validator.js";
import type { StoreCore } from "../core.js";
import type { Registration, Run } from "../validation.js";
import { readFields, type Spec } from "./inputs.js";
import { isConcrete, item, matches, type Pattern } from "./paths.js";

/** Adds a registration. With `items` it gets no run yet. */
type Add = (pattern: Pattern, spec: Spec, kind?: ValidatorKind, items?: boolean) => Registration;

/** The run of a registration at one field, made on first use. */
type RunOf = (reg: Registration, path: Path) => Run;

/**
 * What the runner calls for the validators on array items, whose fields
 * come and go. `why` is 0 for running now, 1 for a write, 2 for a blur, 3
 * for a change that was no user edit and 4 for a reset. All but a reset add
 * the item runs the event at `path` touches to `out`. Running now at the
 * root arms every item validator and a reset of the root disarms it: runs
 * made while armed start armed.
 */
export type ItemValidators = (path: Path, why: 0 | 1 | 2 | 3 | 4, out?: Set<Run>) => void;

/**
 * Wraps a definition's field validators: `validate: { fields:
 * fieldValidators({ email: required }) }`. The object is shaped like the
 * value. At any node it is a validator, a Standard Schema or either with
 * options. At an object it can be a record of child entries, and at an
 * array a one-element tuple whose entry applies to every item.
 *
 * A form that validates with a schema, `validate.form`, a field's
 * `validate` prop or `registerValidator` doesn't import this, so it doesn't
 * ship the code that reads the object and follows array items.
 */
export function fieldValidators<V, E = FormError>(fields: FieldValidators<V, E>): FieldValidatorSet<V, E> {
  const install = (core: Pick<StoreCore<unknown, unknown>, "getSnapshot">, add: Add, runOf: RunOf): ItemValidators => {
    // Registrations with `item` segments. A definition has few, so events loop over them.
    const patterns = new Set<Registration>();
    for (const { pattern, spec } of readFields(fields)) {
      const items = !isConcrete(pattern);
      const reg = add(pattern, spec, undefined, items);
      if (items) {
        reg.armedAll = false;
        patterns.add(reg);
      }
    }

    // Adds the runs of a registration whose fields are `path` or lie under it.
    const expand = (reg: Registration, path: Path, out: Set<Run>) => {
      const { pattern } = reg;
      if (path.length === pattern.length) {
        out.add(runOf(reg, path));
        return;
      }
      const seg = pattern[path.length];
      if (seg !== item) {
        if (seg !== undefined) expand(reg, [...path, seg], out);
        return;
      }
      const snapshot = core.getSnapshot(path);
      if (!Array.isArray(snapshot.value)) return;
      for (const key of snapshot.keys ?? []) expand(reg, [...path, key], out);
    };

    return (path, why, out) => {
      for (const reg of patterns) {
        if (!path.length && (why === 0 || why === 4)) reg.armedAll = !why;
        if (!out) continue;
        {
          const { pattern, timing, armedAll } = reg;
          const { length } = pattern;
          // A write makes runs only for a pattern that arms on one, and a blur for one that arms on a blur
          // at this field or reaches below itself. A change makes them for an armed pattern.
          if (why === 1 ? !armedAll && timing !== "input" : why === 2 ? timing !== "blur" || (length !== path.length && !(reg.reaches && length < path.length)) : why === 3 && !armedAll)
            continue;
          // The runs at or under `path`, and, unless running now, the one at or above it.
          if (length <= path.length) {
            if (why !== 0 && matches(pattern, path, length)) out.add(runOf(reg, path.slice(0, length)));
          } else if (matches(pattern, path, path.length)) expand(reg, path, out);
        }
      }
    };
  };
  // Validation calls it with its runner. The value and error types are in the type alone.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return install as unknown as FieldValidatorSet<V, E>;
}
