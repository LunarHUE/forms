import { type ArrayHandle, type FormError, type HandleOf, Items } from "@lunarhue/forms-solid";
import { type Named, NamedFieldset } from "./forms";

interface NameFieldProps<T extends Named> {
  readonly field: HandleOf<typeof NamedFieldset, T>;
}

function NameField<T extends Named>(props: NameFieldProps<T>) {
  const scope = NamedFieldset.scope(props.field);
  return <scope.TextField name="name" label="Name" />;
}

interface NamedListProps<T extends Named> {
  readonly items: ArrayHandle<T[], FormError, "arrays">;
  readonly create: (base: Named) => T;
}

// Generic in the item, so it takes lists whose items have more keys. It can't
// build those keys itself, so the caller passes `create`.
export function NamedList<T extends Named>(props: NamedListProps<T>) {
  return (
    <div>
      <Items handle={props.items}>
        {(item, index) => (
          <div>
            <NameField field={item} />
            <button type="button" onClick={() => props.items.remove(index())}>
              Remove
            </button>
          </div>
        )}
      </Items>
      <button type="button" onClick={() => props.items.push(props.create({ id: Date.now(), name: "" }))}>
        Add
      </button>
    </div>
  );
}
