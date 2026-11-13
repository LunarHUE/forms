import type { AnyFieldHandle, FieldSnapshot, ValidatorInput } from "@lunarhue/forms-core";
import { type ComponentType, createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { type FieldView, fieldViewSource } from "./field-api.js";
import { type IsEqual, useItems, useValidator } from "./field.js";
import type { FieldComponentMap, FieldComponentType } from "./scope.js";
import { useSelected } from "./select.js";

/** A handle as the bound components use it at runtime. */
type AnyHandle = AnyFieldHandle<unknown>;

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

interface ItemsProps extends Target {
  readonly children: (item: AnyHandle & { readonly key: string }, index: number) => ReactNode;
}

/** The field a bound component names: its `handle`, or its dotted `name` below `root`. */
function targetOf(root: AnyHandle, props: Target): AnyHandle {
  if (props.handle !== undefined) return props.handle;
  let handle = root;
  for (const segment of (props.name ?? "").split(".")) handle = handle.at(segment);
  return handle;
}

const pickApi = (view: FieldView): unknown => view.api;

/** Renders a bound `Field`. */
function useFieldElement(root: AnyHandle, props: FieldProps): ReactElement {
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

/** Renders a bound `Items`, one keyed fragment per item. */
function useItemsElement(root: AnyHandle, props: ItemsProps): ReactElement {
  const items = useItems(targetOf(root, props));
  const { children } = props;
  return createElement(
    Fragment,
    null,
    items.map((item, index) => createElement(Fragment, { key: item.key }, children(item, index))),
  );
}

/** Renders a registered component with its `field` filled in. */
function useRegisteredElement(root: AnyHandle, component: FieldComponentType, props: OneField): ReactElement {
  const { name: _name, handle: _handle, validate, ...own } = props;
  const handle = targetOf(root, props);
  useValidator(handle, validate);
  const field = useSelected(fieldViewSource(handle), pickApi);
  // The component's own props pass through as they came, and `field` is its field object.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return createElement(component as unknown as ComponentType<Record<string, unknown>>, { ...own, field });
}

/**
 * Makes the bound components rooted at `root`. Callers cache the result per
 * handle, so each component keeps its identity for the life of the handle.
 */
export function makeScope(root: AnyHandle, fields: FieldComponentMap): AnyScope {
  function Field(props: FieldProps): ReactElement {
    return useFieldElement(root, props);
  }
  function Items(props: ItemsProps): ReactElement {
    return useItemsElement(root, props);
  }
  const registered = Object.entries(fields).map(([key, component]) => {
    function BoundComponent(props: OneField): ReactElement {
      return useRegisteredElement(root, component, props);
    }
    BoundComponent.displayName = `Bound(${key})`;
    return [key, BoundComponent] as const;
  });
  return { ...Object.fromEntries(registered), root, Field, Items };
}
