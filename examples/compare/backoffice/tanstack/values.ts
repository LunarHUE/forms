// Dirty tracking over plain values. TanStack keeps `isDefaultValue` per
// mounted field, but has no list of a form's leaves, no count of changed
// ones, and no way to move the defaults while keeping some values. These
// helpers walk the values instead.
import { type AnyFormApi, getBy } from "@tanstack/react-form";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deep equality for JSON-like values. */
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => same(item, b[index]));
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => same(a[key], b[key]));
  }
  return false;
}

/**
 * The field names of every leaf in `a` and `b`, in TanStack's syntax:
 * `billing.city`, `lines[0].price`. Objects are walked key by key, and
 * arrays item by item while both have the same length. An array whose
 * length changed is one leaf.
 */
export function leafNames(a: unknown, b: unknown, prefix = ""): string[] {
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((key) => leafNames(a[key], b[key], prefix === "" ? key : `${prefix}.${key}`));
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.flatMap((item: unknown, index) => leafNames(item, b[index], `${prefix}[${index}]`));
  }
  return [prefix];
}

/** The leaves whose value differs from the defaults. */
export function changedNames(values: unknown, defaults: unknown): string[] {
  return leafNames(values, defaults).filter((name) => !same(getBy(values, name), getBy(defaults, name)));
}

/**
 * Makes `baseline` the form's default values. Leaves `keep` picks keep their
 * current value and stay changed. `form.reset(values)` moves the defaults
 * but also writes every value, so the kept ones are written back after it.
 */
export function rebaseline(form: AnyFormApi, baseline: unknown, keep: (name: string, value: unknown) => boolean): void {
  const values: unknown = form.state.values;
  const kept = leafNames(values, baseline).flatMap((name) => {
    const value: unknown = getBy(values, name);
    return keep(name, value) ? [{ name, value }] : [];
  });
  form.reset(baseline);
  for (const { name, value } of kept) form.setFieldValue(name, value);
}
