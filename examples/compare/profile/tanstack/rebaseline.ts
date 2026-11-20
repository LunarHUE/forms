import { type AnyFormApi, getBy } from "@tanstack/react-form";

/**
 * Makes `baseline` the form's default values, so fields equal to it read as
 * unchanged. The fields `keep` picks keep their current value and stay
 * changed. TanStack has no call for this: `form.reset(values)` moves the
 * defaults but also writes every value, so the kept ones are written back
 * after it.
 */
export function rebaseline<N extends string>(
  form: AnyFormApi,
  names: readonly N[],
  baseline: unknown,
  keep: (name: N, value: unknown) => boolean,
): void {
  const kept = names.flatMap((name) => {
    const value: unknown = form.getFieldValue(name);
    return keep(name, value) ? [{ name, value }] : [];
  });
  form.reset(baseline);
  for (const { name, value } of kept) form.setFieldValue(name, value);
}

/** True when the value at `name` differs between the two objects. */
export function differsAt(a: unknown, name: string, value: unknown): boolean {
  return !Object.is(getBy(a, name), value);
}
