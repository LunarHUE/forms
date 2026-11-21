import type { Part, Parts } from "@lunarhue/forms-core";
import type { FieldComponentType, FieldType, FieldValueOf } from "./scope.js";

/** `parts` pinned at the dotted name `name`, below any name they had. A copy attaches once with the part it copies. */
export const pin = (parts: readonly Part[], name: string): readonly Part[] =>
  parts.map((part) => ({ ...part, path: part.path === undefined ? name : `${name}.${part.path}`, "~of": part["~of"] ?? part }));

/**
 * Makes a field type: `component` with `parts` that attach at each field it
 * renders, the first time it renders that field. Register the result in
 * `createForms`'s `fields`. A list of parts counts as its parts. Each part
 * must fit the component's value, so `masked(...)` takes a
 * `FieldApi<string>` component only. The plugins a part names must be in
 * the form's plugins, which the types check where the component is used.
 *
 * ```tsx
 * export const PhoneField = defineField(PhoneInput, masked({ clean: digits, display: formatPhone }));
 * ```
 */
export const defineField = <C extends FieldComponentType, N extends string = never>(
  component: C,
  ...given: readonly Parts<N, FieldValueOf<C>>[]
): FieldType<C, N> => {
  const parts: readonly Part[] = given.flat();
  return {
    component,
    parts,
    // The pinned parts are these parts, so they need the same plugins.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    at: (name) => pin(parts, name) as never,
  };
};

