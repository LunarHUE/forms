import type { Part } from "@lunarhue/forms-core";
import type { AnyComponent, FieldType, PartValueOf } from "./forms.js";

/** `parts` pinned at the dotted name `name`, below any name they had. */
export const pin = (parts: readonly Part[], name: string): readonly Part[] =>
  parts.map((part) => ({ ...part, path: part.path === undefined ? name : `${name}.${part.path}` }));

/**
 * Makes a field type: `component` with `parts` that attach at each field it
 * renders, the first time it renders that field. Register the result in
 * `createForms`'s `fields`. Each part must fit the component's value, so
 * `masked(...)` takes a `FieldApi<string>` component only. Its plugins must
 * be in the form's plugins, which the types check where the component is
 * used.
 *
 * ```tsx
 * export const PhoneField = field(PhoneInput, masked({ clean: digits, display: formatPhone }));
 * ```
 */
export const field = <C extends AnyComponent, N extends string = never>(
  component: C,
  ...parts: readonly Part<N, PartValueOf<C>>[]
): FieldType<C, N> => ({
  component,
  parts,
  // The pinned parts are these parts, so they need the same plugins.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  at: (name) => pin(parts, name) as never,
});
