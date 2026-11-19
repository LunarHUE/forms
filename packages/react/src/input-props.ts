import { type FieldSnapshot, optionId } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import { type BaseInputProps, errorId } from "./input.js";
import { setNumberText } from "./number-text.js";
import { asText, type FieldPieces } from "./pieces.js";
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

/** The `onChange` of one element kind on one field. */
type OnChange = (event: ChangeEvent<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>) => void;

/** What the props are built from: a field object, which has every snapshot member, the pieces and `text`. */
export type InputState = FieldSnapshot<unknown, unknown> & FieldPieces & { readonly text: string };

// Both caches are keyed by kind, then by the option (or `empty`, or a text input's `type`) the element was given.
const changeCache = new WeakMap<object, Map<Kind, Map<unknown, OnChange>>>();
const propsCache = new WeakMap<object, Map<Kind, Map<unknown, AnyInputProps>>>();

function kindOf(options: AnyInputOptions | undefined): Kind {
  const kind = options?.kind ?? "text";
  if (kind === "checkbox" && options !== undefined && "value" in options) return "group";
  // The contract's option types allow only these kinds.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return kind as Kind;
}

/** The `onChange` of one element kind on one field. Text and number kinds go through the field's pieces. */
function changeHandler(handle: Commands, pieces: FieldPieces, kind: Kind, option: unknown): OnChange {
  const writable = () => !handle.peek().readOnly;
  switch (kind) {
    case "number":
    case "range":
      return (event) => {
        // Text such as `-` isn't a number yet. The browser reports it as an empty value with `badInput`.
        if (event.target.validity.badInput) setNumberText(handle, { value: handle.peek().value, text: event.target.value });
        else pieces.setNumberText(event.target.value, option);
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
      return (event) => pieces.setText(event.target.value, event);
  }
}

function buildProps(
  handle: InputHandle,
  snapshot: InputState,
  kind: Kind,
  option: unknown,
  onChange: OnChange,
): AnyInputProps {
  // An ARIA state that is off is left out. React would write `false` as "false".
  const shown = snapshot.shownErrors.length > 0 || undefined;
  const grouped = kind === "group" || kind === "radio";
  const base: BaseInputProps = {
    name: snapshot.name,
    id: grouped ? optionId(handle.id, asText(option)) : handle.id,
    onBlur: snapshot.handleBlur,
    ref: snapshot.ref,
    disabled: snapshot.disabled,
    "aria-invalid": shown,
    "aria-describedby": shown ? errorId(handle) : undefined,
  };
  const { value, readOnly, text } = snapshot;
  const ariaReadOnly = readOnly || undefined;
  switch (kind) {
    case "number":
    case "range":
      return { ...base, type: kind, value: text, readOnly, onChange };
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
      return { ...base, value: text, readOnly, onChange };
    default:
      return { ...base, type: option ?? "text", value: text, readOnly, onChange };
  }
}

/**
 * The props for one element bound to `handle`, built on the pieces of
 * `field`, its field object. Callbacks are cached per handle and props per
 * field object, so both keep their identity until the field changes.
 */
export function inputPropsFor(handle: InputHandle, field: InputState, options: AnyInputOptions | undefined): AnyInputProps {
  const kind = kindOf(options);
  const option = kind === "group" || kind === "radio" ? options?.value : kind === "text" ? options?.type : options?.empty;
  const byOption = cached(cached(propsCache, field, () => new Map()), kind, () => new Map());
  const cachedProps = byOption.get(option);
  if (cachedProps !== undefined) return cachedProps;

  // Every core handle has these commands. `InputHandle` only names what the contract's handle types share.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const commands = handle as unknown as Commands;
  const changes = cached(cached(changeCache, handle, () => new Map()), kind, () => new Map());
  const onChange = cached(changes, option, () => changeHandler(commands, field, kind, option));
  const props = buildProps(handle, field, kind, option, onChange);
  byOption.set(option, props);
  return props;
}
