import type { ErrorOf, ValidatorInput, ValueOf } from "@lunarhue/forms-core";
import type { Accessor, Element as SolidElement } from "solid-js";
import type { ArrayHandleLike, FieldState, HandleLike } from "./field.js";
import { notImplemented } from "./not-implemented.js";

/** The props of `Field`. */
export interface FieldProps<H extends HandleLike> {
  /** The field to render. Read once: a `Field` serves one handle for as long as it is mounted. */
  readonly handle: H;
  /**
   * A validator to add while the `Field` is mounted, as `createValidator`
   * adds it. Read once, at mount.
   */
  readonly validate?: ValidatorInput<ValueOf<H>, ErrorOf<H>> | undefined;
  /** Renders the field. Gets its reactive state and the handle. Runs once. */
  readonly children: (field: FieldState<ValueOf<H>, ErrorOf<H>>, handle: H) => SolidElement;
}

/** Renders one field from its handle, with its state from `createField`. */
export type FieldComponent = <H extends HandleLike>(props: FieldProps<H>) => SolidElement;

/** See `FieldComponent`. Not implemented yet: it throws. */
export const Field: FieldComponent = notImplemented("Field");

/** The props of `Items`. */
export interface ItemsProps<H extends ArrayHandleLike> {
  /** The array field whose items to render. Read once. */
  readonly handle: H;
  /** Shown while the array has no items. */
  readonly fallback?: SolidElement;
  /**
   * Renders one item. Runs once per item key: the row keeps its DOM when
   * items are added, removed or moved. `index` follows the item's position.
   */
  readonly children: (item: ReturnType<H["item"]>, index: Accessor<number>) => SolidElement;
}

/** Renders an array field's items with `For`, keyed by core's stable item keys. */
export type ItemsComponent = <H extends ArrayHandleLike>(props: ItemsProps<H>) => SolidElement;

/** See `ItemsComponent`. Not implemented yet: it throws. */
export const Items: ItemsComponent = notImplemented("Items");
