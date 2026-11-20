import type { Path } from "./path.js";
import type { AnyFormStore, ErrorsByKind } from "./store.js";
import { coreOf } from "./store/cores.js";
import { freeze } from "./store/freeze.js";
import type { ValidatorKind } from "./validator.js";

const none: readonly never[] = freeze([]);

// The registration number at the end of an owner name.
const order = (owner: string) => Number(/\d+$/.exec(owner)?.[0]);

/**
 * Returns the validation errors on `field` grouped by the kind of validator
 * that set them: the definition's schema, its form validator, or field
 * validators. A thrown validator's error counts as its validator's kind.
 * Errors from `setErrors` aren't here: they are the snapshot's `userErrors`.
 * A group with no errors is an empty list.
 *
 * It takes any handle, such as `store.root.at("name")` or an entry's
 * `field` from `invalidFields`. A read, not a subscription: read it again
 * when the field's snapshot `errors` change.
 */
export const errorsByKind = <E>(field: { readonly store: AnyFormStore<E>; readonly path: Path }): ErrorsByKind<E> => {
  // Validation names each owner `<kind><n>`, and joins owners into `errors`
  // in order of `n`. A copy, sorted in place: `toSorted` is past ES2020.
  // oxlint-disable-next-line unicorn/no-array-sort
  const owners = [...(coreOf(field.store).byOwner(field.path) ?? [])].sort(([a], [b]) => order(a) - order(b));
  const join = (kind: ValidatorKind): readonly E[] => {
    const lists = owners.filter(([owner]) => owner.startsWith(kind)).map(([, errors]) => errors);
    return lists.length === 0 ? none : lists.length === 1 ? lists[0]! : freeze(lists.flat());
  };
  return { schema: join("schema"), form: join("form"), field: join("field") };
};
