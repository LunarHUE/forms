import { type ArrayHandle, type HandleOf, Items } from "@lunarhue/forms-react";
import type { arrays } from "@lunarhue/forms-react/plugins";
import { type Named, NamedFieldset } from "./forms";

interface NameFieldProps<T extends Named> {
  readonly field: HandleOf<typeof NamedFieldset, T>;
}

function NameField<T extends Named>({ field }: NameFieldProps<T>) {
  const scope = NamedFieldset.scope(field);
  return <scope.TextField name="name" label="Name" />;
}

interface NamedListProps<T extends Named> {
  readonly items: ArrayHandle<T[], typeof arrays>;
  readonly create: (base: Named) => T;
}

// Generic in the item, so it takes lists whose items have more keys. It can't
// build those keys itself, so the caller passes `create`.
export function NamedList<T extends Named>({ items, create }: NamedListProps<T>) {
  return (
    <div>
      <Items handle={items}>
        {(item, index) => (
          <div>
            <NameField field={item} />
            <button type="button" onClick={() => items.remove(index)}>
              Remove
            </button>
          </div>
        )}
      </Items>
      <button type="button" onClick={() => items.push(create({ id: Date.now(), name: "" }))}>
        Add
      </button>
    </div>
  );
}
