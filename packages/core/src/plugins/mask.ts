import type { Path } from "../path.js";
import type { FieldDisplay, HookPlugin, PluginContext } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import { replaceText } from "./caret.js";

export { replaceText } from "./caret.js";

/** A cleaner for one field. It gets the value so far and the caller's original input. */
export type Mask = (value: unknown, input: unknown) => unknown;

/** Keeps the digits of a string. */
export const digits: Mask = (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value);

/** Upper-cases a string. */
export const upper: Mask = (value) => (typeof value === "string" ? value.toUpperCase() : value);

/** A field's cleaner and the text its inputs show. */
export interface MaskField {
  /** Cleans the value before the store takes it. */
  readonly clean: Mask;
  /**
   * The text a text input shows for the clean stored value, as
   * `(555) 123-4567` for `5551234567`. It must be a pure function of the
   * value. A value that isn't a string comes in as `""`.
   */
  readonly display: (value: string) => string;
}

/** Options for `mask`. */
export interface MaskOptions {
  /** The plugin name, so two masks can run side by side. Defaults to `"mask"`. */
  readonly name?: string;
  /** The plugins this one runs after. */
  readonly after?: readonly string[];
}

type Holder = Record<string, unknown>;

const isHolder = (value: unknown): value is Holder => typeof value === "object" && value !== null;

/**
 * Cleans the field at `rest` below `value`, with `input` the caller's value
 * at the same place. `*` matches every item or key. Copies only what changed.
 */
function cleanBelow(value: unknown, input: unknown, rest: readonly string[], clean: Mask): unknown {
  const [seg, ...tail] = rest;
  if (seg === undefined) return clean(value, input);
  if (!isHolder(value)) return value;
  let out = value;
  // A key segment never names an array item here: the items of a written array have no keys yet.
  for (const at of seg === "*" ? Object.keys(value) : [seg]) {
    if (!(at in value)) continue;
    const next = cleanBelow(value[at], isHolder(input) ? input[at] : undefined, tail, clean);
    if (Object.is(next, value[at])) continue;
    if (out === value) out = Object.assign(Array.isArray(value) ? [] : {}, value);
    out[at] = next;
  }
  return out;
}

/**
 * Cleans the value written at each named field before the store takes it,
 * so the store only ever holds the clean value. `fields` maps a dotted
 * stable path, such as `"address.zip"`, to its `Mask`, or to a `MaskField`
 * that also gives the text the field's inputs show. A `*` segment matches
 * every array item or object key, as in `"lines.*.sku"`.
 *
 * A write above a field, such as a root replace, a parent object or a row
 * that `push` adds, is cleaned at each field below it. The form's starting
 * value is cleaned too, so its baseline is clean and a reset leaves it
 * clean. User edits, resets and other plugins' writes are cleaned.
 * Rebases are not: the incoming value is the server's copy, and the
 * baseline moves to it as it came.
 *
 * A field with a `display` gets it as its meta, a `FieldDisplay`, so the
 * adapters' text inputs show the display text and keep the caret in place.
 * When two masks give one field a display, the one that runs first wins.
 */
export function mask(fields: Readonly<Record<string, Mask | MaskField>>, options: MaskOptions = {}): HookPlugin<undefined, string, FieldDisplay> {
  const list = Object.entries(fields).map(([name, field]) => {
    const names = name.split(".");
    if (typeof field === "function") return [names, field] as const;
    const { clean, display } = field;
    const text = (value: unknown) => display(typeof value === "string" ? value : "");
    // Made once, so the meta keeps its identity.
    const shown: FieldDisplay = {
      display: text,
      edit: (input, value, event) => replaceText(input, text(value), (typed) => clean(typed, typed), event),
    };
    return [names, clean, shown] as const;
  });
  // Cleans every field at or below `path` in `value`.
  const run = (path: Path, value: unknown, input: unknown) => {
    for (const [names, clean] of list) {
      if (path.length <= names.length && path.every((seg, i) => names[i] === "*" || names[i] === String(seg)))
        value = cleanBelow(value, input, names.slice(path.length), clean);
    }
    return value;
  };
  return defineHooks({
    name: options.name ?? "mask",
    ...(options.after && { after: options.after }),
    initial: (value) => run([], value, value),
    setup(ctx: PluginContext<FieldDisplay>) {
      // Sets the display meta on each field `names` matches below `path`.
      const show = (names: readonly string[], shown: FieldDisplay, path: Path): void => {
        const seg = names[path.length];
        if (seg === undefined) return ctx.setMeta(path, shown);
        const { value, keys } = ctx.store.getSnapshot(path);
        for (const at of seg !== "*" ? [seg] : (keys ?? (isHolder(value) ? Object.keys(value) : []))) show(names, shown, [...path, at]);
      };
      const showAll = () => {
        for (const [names, , shown] of list) if (shown) show(names, shown, []);
      };
      showAll();
      return {
        beforeWrite: (write) => (write.cause === "rebase" ? write.value : run(write.path, write.value, write.input)),
        // Items a `*` matches come and go, so each batch gives the new ones their display.
        ...(list.some(([names, , shown]) => shown && names.includes("*")) && { onWrite: showAll }),
      };
    },
  });
}
