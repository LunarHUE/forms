import { type ArrayHandle, type FormError, type HandleOf, Items } from "@lunarhue/forms-react";
import { type Named, NamedFieldset } from "./forms";

function NameField<T extends Named>({ field }: { field: HandleOf<typeof NamedFieldset, T> }) {
  const scope = NamedFieldset.scope(field);
  return <scope.TextField name="name" label="Name" />;
}

// Generic in the item, so it takes lists whose items have more keys. It can't
// build those keys itself, so the caller passes `create`.
export function NamedList<T extends Named>({
  items,
  create,
}: {
  items: ArrayHandle<T[], FormError, "arrays">;
  create: (base: Named) => T;
}) {
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
