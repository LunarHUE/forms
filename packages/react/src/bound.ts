import { type NamedAnyFieldHandle, attach, type FieldSnapshot, type ValidatorInput } from "@lunarhue/forms-core";
import { type ComponentType, createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { type FieldView, fieldViewSource, pickApi } from "./field-api.js";
import { type IsEqual, useValidator } from "./field.js";
import type { FieldComponentMap } from "./scope.js";
import { useSelected } from "./select.js";

/** A handle as the bound components use it at runtime. */
type AnyHandle = NamedAnyFieldHandle<unknown>;

/** A scope as the runtime builds it. The contract types it as `Scope`. */
export type AnyScope = Readonly<Record<string, unknown>> & { readonly root: AnyHandle };

/** The props every bound component takes to find its field. */
interface Target {
  readonly name?: string;
  readonly handle?: AnyHandle;
}

/** The props of a bound component that renders one field: its target and its `validate`. */
interface OneField extends Target {
  readonly validate?: ValidatorInput<unknown, unknown> | undefined | null | false;
}

interface FieldProps extends OneField {
  readonly select?: (snapshot: FieldSnapshot<unknown, unknown>) => unknown;
  readonly isEqual?: IsEqual<unknown>;
  readonly children: (field: unknown, handle: AnyHandle) => ReactNode;
}

/** The field a bound component names: its `handle`, or its dotted `name` below `root`. */
function targetOf(root: AnyHandle, props: Target): AnyHandle {
  if (props.handle !== undefined) return props.handle;
  let handle = root;
  for (const segment of (props.name ?? "").split(".")) handle = handle.at(segment);
  return handle;
}

/**
 * Makes the bound components rooted at `root`. Callers cache the result per
 * handle, so each component keeps its identity for the life of the handle.
 */
export function makeScope(root: AnyHandle, fields: FieldComponentMap): AnyScope {
  /** The bound `Field`: the field object, or what `select` picks from the snapshot, passed to the children. */
  function Field(props: FieldProps): ReactElement {
    const handle = targetOf(root, props);
    useValidator(handle, props.validate);
    const { select } = props;
    const value = useSelected(
      fieldViewSource(handle),
      select === undefined ? pickApi : (view: FieldView) => select(view.snapshot),
      props.isEqual,
    );
    return createElement(Fragment, null, props.children(value, handle));
  }
  const registered: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(fields)) {
    const { component, parts } = "parts" in entry ? entry : { component: entry, parts: [] };
    /** Renders the registered component with its `field` filled in. */
    function BoundComponent(props: OneField): ReactElement {
      const { name: _name, handle: _handle, validate, ...own } = props;
      const handle = targetOf(root, props);
      // The parts attach before the field is read, so a store with no listeners yet renders what they did.
      attach(handle, parts);
      useValidator(handle, validate);
      const field = useSelected(fieldViewSource(handle), pickApi);
      // The component's own props pass through as they came, and `field` is its field object.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return createElement(component as unknown as ComponentType<Record<string, unknown>>, { ...own, field });
    }
    BoundComponent.displayName = `Bound(${key})`;
    registered[key] = BoundComponent;
  }
  return { ...registered, root, Field };
}
