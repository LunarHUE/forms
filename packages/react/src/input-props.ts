import { type FieldSnapshot, optionId } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import { type BaseInputProps, errorId, type FieldRef } from "./input.js";
import { type NumberText, setNumberText } from "./number-text.js";
import { refFor } from "./refs.js";
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
  readonly type?: string;
  readonly value?: unknown;
  readonly empty?: unknown;
}

/** Props for any input kind, as the runtime builds them. */
export type AnyInputProps = BaseInputProps & Record<string, unknown>;

type Kind = "text" | "textarea" | "number" | "range" | "checkbox" | "group" | "radio" | "select";

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

// Both caches are keyed by kind, then by the option (or `empty`, or a text input's `type`) the element was given.
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

/** The `onChange` of one element kind on one field. */
function changeHandler(handle: Commands, kind: Kind, option: unknown): Callbacks["onChange"] {
  const writable = () => !handle.peek().readOnly;
  switch (kind) {
    case "number":
    case "range":
      return (event) => {
        const text = event.target.value;
        const number = text === "" ? Number.NaN : Number(text);
        // Text such as `-` isn't a number yet. The browser reports it as an empty value with `badInput`.
        if (Number.isNaN(number) && (text !== "" || event.target.validity.badInput)) {
          setNumberText(handle, { value: handle.peek().value, text });
          return;
        }
        const value = Number.isNaN(number) ? option : number;
        setNumberText(handle, { value, text });
        handle.setValue(value);
      };
    case "checkbox":
      return (event) => {
        if (writable()) handle.setValue(event.target.checked);
      };
    case "group":
      return (event) => {
        const snapshot = handle.peek();
        if (snapshot.readOnly) return;
        const list: readonly unknown[] = Array.isArray(snapshot.value) ? snapshot.value : [];
        const has = list.includes(option);
        if (event.target.checked && !has) handle.setValue([...list, option]);
        if (!event.target.checked && has) handle.setValue(list.filter((item) => !Object.is(item, option)));
      };
    case "radio":
      return (event) => {
        if (event.target.checked && writable()) handle.setValue(option);
      };
    case "select":
      return (event) => {
        const value = event.target.value;
        if (writable()) handle.setValue(value === "" ? option : value);
      };
    default:
      return (event) => {
        handle.setValue(event.target.value);
      };
  }
}

function makeCallbacks(handle: Commands, kind: Kind, option: unknown): Callbacks {
  const numeric = kind === "number" || kind === "range";
  return {
    onChange: changeHandler(handle, kind, option),
    onBlur: () => {
      // A number input shows the field's number again once it loses focus.
      if (numeric) setNumberText(handle, undefined);
      handle.handleBlur();
    },
    ref: refFor(handle),
  };
}

function buildProps(
  handle: InputHandle,
  snapshot: FieldSnapshot<unknown, unknown>,
  text: NumberText | undefined,
  kind: Kind,
  option: unknown,
  callbacks: Callbacks,
): AnyInputProps {
  // An ARIA state that is off is left out. React would write `false` as "false".
  const shown = snapshot.shownErrors.length > 0 || undefined;
  const grouped = kind === "group" || kind === "radio";
  const base: BaseInputProps = {
    name: snapshot.name,
    id: grouped ? optionId(handle.id, asText(option)) : handle.id,
    onBlur: callbacks.onBlur,
    ref: callbacks.ref,
    disabled: snapshot.disabled,
    "aria-invalid": shown,
    "aria-describedby": shown ? errorId(handle) : undefined,
  };
  const { value, readOnly } = snapshot;
  const ariaReadOnly = readOnly || undefined;
  const { onChange } = callbacks;
  switch (kind) {
    case "number":
    case "range":
      return { ...base, type: kind, value: numberShown(value, text), readOnly, onChange };
    case "checkbox":
      return { ...base, type: "checkbox", checked: value === true, "aria-readonly": ariaReadOnly, onChange };
    case "group":
      return {
        ...base,
        type: "checkbox",
        value: asText(option),
        checked: Array.isArray(value) && value.includes(option),
        "aria-readonly": ariaReadOnly,
        onChange,
      };
    case "radio":
      return { ...base, type: "radio", value: asText(option), checked: Object.is(value, option), "aria-readonly": ariaReadOnly, onChange };
    case "select":
      return { ...base, value: asText(value), "aria-readonly": ariaReadOnly, onChange };
    case "textarea":
      return { ...base, value: asText(value), readOnly, onChange };
    default:
      return { ...base, type: option ?? "text", value: asText(value), readOnly, onChange };
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
  const option = kind === "group" || kind === "radio" ? options?.value : kind === "text" ? options?.type : options?.empty;
  const numeric = kind === "number" || kind === "range";
  const byOption = cached(cached(propsCache, snapshot, () => new Map()), kind, () => new Map());
  const built = byOption.get(option);
  if (built !== undefined && (!numeric || built.text === text)) return built.props;

  const callbacksByOption = cached(cached(callbackCache, handle, () => new Map()), kind, () => new Map());
  // Every core handle has these commands. `InputHandle` only names what the contract's handle types share.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const callbacks = cached(callbacksByOption, option, () => makeCallbacks(handle as unknown as Commands, kind, option));
  const props = buildProps(handle, snapshot, numeric ? text : undefined, kind, option, callbacks);
  byOption.set(option, { text, props });
  return props;
}
