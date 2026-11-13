import { encodeSegment, type FieldSnapshot } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import { type BaseInputProps, errorId, type FieldRef } from "./input.js";
import { type NumberText, setNumberText } from "./number-text.js";
import { fieldRef } from "./refs.js";
import { cached } from "./select.js";

/** A handle as the input props use it at runtime. Every core handle fits. */
export interface InputHandle {
  readonly id: string;
}

/** What the runtime calls on a core handle. */
interface Commands {
  setValue(value: unknown): void;
  peek(): FieldSnapshot<unknown, unknown>;
  handleBlur(): void;
}

/** The input options as the runtime reads them. */
export interface AnyInputOptions {
  readonly kind?: string;
  readonly value?: unknown;
  readonly empty?: unknown;
}

/** Props for any input kind, as the runtime builds them. */
export type AnyInputProps = BaseInputProps & Record<string, unknown>;

type Kind = "text" | "number" | "range" | "checkbox" | "group" | "radio" | "select";

/** The callbacks of one element kind on one field. */
interface Callbacks {
  readonly onChange: (event: ChangeEvent<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>) => void;
  readonly onBlur: () => void;
  readonly ref: FieldRef;
}

/** Built props, with the number text they were built with. */
interface BuiltProps {
  readonly text: NumberText | undefined;
  readonly props: AnyInputProps;
}

// Both caches are keyed by kind, then by the option (or `empty`) the element was given.
const callbackCache = new WeakMap<object, Map<Kind, Map<unknown, Callbacks>>>();
const propsCache = new WeakMap<object, Map<Kind, Map<unknown, BuiltProps>>>();

function kindOf(options: AnyInputOptions | undefined): Kind {
  const kind = options?.kind ?? "text";
  if (kind === "checkbox" && options !== undefined && "value" in options) return "group";
  // The contract's option types allow only these kinds.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return kind as Kind;
}

/** Shows `null` and `undefined` as `""`. */
const asText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" ? String(value) : "";

/** The text of a number field, or the text the user typed while the field still holds what it wrote. */
function numberShown(value: unknown, text: NumberText | undefined): string {
  if (text !== undefined && Object.is(text.value, value)) return text.text;
  return typeof value === "number" && !Number.isNaN(value) ? String(value) : "";
}

function makeCallbacks(handle: Commands, kind: Kind, option: unknown): Callbacks {
  const writable = () => !handle.peek().readOnly;
  const blur = () => handle.handleBlur();
  const ref = fieldRef(handle, kind === "group" || kind === "radio" ? `${kind}:${String(option)}` : "");

  switch (kind) {
    case "number":
    case "range":
      return {
        onChange(event) {
          const text = event.target.value;
          const number = text.trim() === "" ? Number.NaN : Number(text);
          const value = Number.isNaN(number) ? option : number;
          setNumberText(handle, { value, text });
          handle.setValue(value);
        },
        onBlur() {
          setNumberText(handle, undefined);
          handle.handleBlur();
        },
        ref,
      };
    case "checkbox":
      return {
        onChange(event) {
          if (writable()) handle.setValue(event.target.checked);
        },
        onBlur: blur,
        ref,
      };
    case "group":
      return {
        onChange(event) {
          const snapshot = handle.peek();
          if (snapshot.readOnly) return;
          const list: readonly unknown[] = Array.isArray(snapshot.value) ? snapshot.value : [];
          const has = list.includes(option);
          if (event.target.checked && !has) handle.setValue([...list, option]);
          if (!event.target.checked && has) handle.setValue(list.filter((item) => !Object.is(item, option)));
        },
        onBlur: blur,
        ref,
      };
    case "radio":
      return {
        onChange(event) {
          if (event.target.checked && writable()) handle.setValue(option);
        },
        onBlur: blur,
        ref,
      };
    case "select":
      return {
        onChange(event) {
          const value = event.target.value;
          if (writable()) handle.setValue(value === "" ? option : value);
        },
        onBlur: blur,
        ref,
      };
    default:
      return {
        onChange(event) {
          handle.setValue(event.target.value);
        },
        onBlur: blur,
        ref,
      };
  }
}

function buildProps(
  handle: InputHandle,
  snapshot: FieldSnapshot<unknown, unknown>,
  text: NumberText | undefined,
  kind: Kind,
  option: unknown,
  callbacks: Callbacks,
): AnyInputProps {
  const shown = snapshot.shownErrors.length > 0;
  const grouped = kind === "group" || kind === "radio";
  const base: BaseInputProps = {
    name: snapshot.name,
    id: grouped ? `${handle.id}--${encodeSegment(asText(option))}` : handle.id,
    onBlur: callbacks.onBlur,
    ref: callbacks.ref,
    disabled: snapshot.disabled,
    "aria-invalid": shown,
    "aria-describedby": shown ? errorId(handle) : undefined,
  };
  const { value, readOnly } = snapshot;
  const { onChange } = callbacks;
  switch (kind) {
    case "number":
    case "range":
      return { ...base, type: kind, value: numberShown(value, text), readOnly, onChange };
    case "checkbox":
      return { ...base, type: "checkbox", checked: value === true, "aria-readonly": readOnly, onChange };
    case "group":
      return {
        ...base,
        type: "checkbox",
        value: asText(option),
        checked: Array.isArray(value) && value.includes(option),
        "aria-readonly": readOnly,
        onChange,
      };
    case "radio":
      return { ...base, type: "radio", value: asText(option), checked: Object.is(value, option), "aria-readonly": readOnly, onChange };
    case "select":
      return { ...base, value: asText(value), "aria-readonly": readOnly, onChange };
    default:
      return { ...base, value: asText(value), readOnly, onChange };
  }
}

/**
 * The props for one element bound to `handle`. Callbacks are cached per
 * handle and props per snapshot, so both keep their identity until the
 * field changes. `text` is the field's recorded number text.
 */
export function inputPropsFor(
  handle: InputHandle,
  snapshot: FieldSnapshot<unknown, unknown>,
  text: NumberText | undefined,
  options: AnyInputOptions | undefined,
): AnyInputProps {
  const kind = kindOf(options);
  const option = kind === "group" || kind === "radio" ? options?.value : options?.empty;
  const numeric = kind === "number" || kind === "range";
  const byOption = cached(cached(propsCache, snapshot, () => new Map()), kind, () => new Map());
  const built = byOption.get(option);
  if (built !== undefined && (!numeric || built.text === text)) return built.props;

  const callbacksByOption = cached(cached(callbackCache, handle, () => new Map()), kind, () => new Map());
  let callbacks = callbacksByOption.get(option);
  if (callbacks === undefined) {
    // Every core handle has these commands. `InputHandle` only names what the contract's handle types share.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    callbacks = makeCallbacks(handle as unknown as Commands, kind, option);
    callbacksByOption.set(option, callbacks);
  }
  const props = buildProps(handle, snapshot, numeric ? text : undefined, kind, option, callbacks);
  byOption.set(option, { text, props });
  return props;
}
