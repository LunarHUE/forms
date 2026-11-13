import type { ReactElement, ReactNode } from "react";
import type { ArrayHandleLike, HandleLike, IsEqual, SnapshotOf } from "./field.js";
import type { AnyFormInstance } from "./forms.js";
import { notImplemented } from "./not-implemented.js";

/** Props for `FormProvider`. */
export interface FormProviderProps {
  /** The form `useForm` returned. */
  readonly form: AnyFormInstance;
  readonly children?: ReactNode;
}

/**
 * Provides a form to the components below it, for `useFormContext` and a
 * definition's `useFormContext`. Hooks that take a handle never need it.
 */
export type FormProviderComponent = (props: FormProviderProps) => ReactElement;

/** See `FormProviderComponent`. Not implemented yet: it throws. */
export const FormProvider: FormProviderComponent = notImplemented("FormProvider");

/**
 * Returns the form from the nearest `FormProvider`, untyped. Throws when
 * there is none. A definition's own `useFormContext` returns it typed.
 */
export type UseFormContext = () => AnyFormInstance;

/** See `UseFormContext`. Not implemented yet: it throws. */
export const useFormContext: UseFormContext = notImplemented("useFormContext");

/**
 * Props for `Field`. Without `select`, `children` gets the snapshot. With
 * `select`, it gets what `select` returns.
 */
export interface FieldProps<H extends HandleLike, T = SnapshotOf<H>> {
  /** The field to read. */
  readonly handle: H;
  /** Narrows the snapshot, as `useField`'s `select` does. */
  readonly select?: (snapshot: SnapshotOf<H>) => T;
  /** Compares selected values, as `useField`'s `isEqual` does. */
  readonly isEqual?: IsEqual<T>;
  /** Renders the field from its snapshot, or from the selected value. */
  readonly children: (selected: T, handle: H) => ReactNode;
}

/**
 * Calls `useField` and renders `children` with the result. Only this
 * component re-renders when the field changes, not the one that renders it.
 */
export type FieldComponent = <H extends HandleLike, T = SnapshotOf<H>>(props: FieldProps<H, T>) => ReactElement;

/** See `FieldComponent`. Not implemented yet: it throws. */
export const Field: FieldComponent = notImplemented("Field");

/** Props for `Items`. */
export interface ItemsProps<H extends ArrayHandleLike> {
  /** The array field. */
  readonly handle: H;
  /** Renders one item. Each result is keyed by the item's stable key, so it needs no `key` of its own. */
  readonly children: (item: ReturnType<H["item"]>, index: number) => ReactNode;
}

/**
 * Calls `useItems` and renders `children` once per item, keyed by the
 * item's stable key. It re-renders when items are added, removed or moved,
 * not when a value inside an item changes.
 */
export type ItemsComponent = <H extends ArrayHandleLike>(props: ItemsProps<H>) => ReactElement;

/** See `ItemsComponent`. Not implemented yet: it throws. */
export const Items: ItemsComponent = notImplemented("Items");
