import { errorId, type FieldSnapshot, optionId, type Path } from "@lunarhue/forms-core";
import { displayOf } from "./display.js";
import type { ControlProps } from "./input.js";
import { elementsOf } from "./refs.js";

/** The handle members the input props call. Every core handle has them. */
export interface InputHandle {
  readonly id: string;
  readonly path: Path;
  readonly store: { getSnapshot(path: Path): FieldSnapshot<unknown, unknown> };
  setValue(value: unknown): void;
  handleBlur(): void;
}

/** What the input props are built from. */
export interface InputSource {
  readonly handle: InputHandle;
  /** The field's snapshot as a reactive read. */
  readonly read: () => FieldSnapshot<unknown, unknown>;
  /** Registers an element as the field's focus target. */
  readonly register: (element: HTMLElement) => void;
}

/** Every input option, loosely typed, as the runtime reads them. */
export interface AnyInputOptions {
  readonly kind?: string;
  readonly type?: string;
  readonly value?: unknown;
  readonly empty?: unknown;
  readonly describedBy?: string;
}

/** Returns the id the input props point `aria-describedby` at while the field shows errors. */
export function errorIdOf(handle: { readonly id: string }): string {
  return errorId(handle.id);
}

/** A field value as the text of an input: empty while it is null or undefined, or not a primitive. */
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

/** The input element an event was bound on. */
function inputOf(event: Event): HTMLInputElement | HTMLTextAreaElement | undefined {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : undefined;
}

/**
 * Adds the props every input kind shares to `own` and returns it. The
 * getters read the field's signal, so each is a reactive read. `id` is the
 * element's id, the handle's unless the element is one option of the field.
 */
function withControl(source: InputSource, options: AnyInputOptions | undefined, own: object, id = source.handle.id): object {
  const { handle, read, register } = source;
  const errorsId = errorIdOf(handle);
  const control: ControlProps<HTMLElement> = {
    id,
    get name() {
      return read().name;
    },
    ref: register,
    onBlur: () => handle.handleBlur(),
    get disabled() {
      return read().disabled;
    },
    get "aria-invalid"() {
      return read().shownErrors.length > 0 ? "true" : undefined;
    },
    get "aria-describedby"() {
      const ids: string[] = [];
      if (options?.describedBy) ids.push(options.describedBy);
      if (read().shownErrors.length > 0) ids.push(errorsId);
      return ids.length > 0 ? ids.join(" ") : undefined;
    },
  };
  // A prop of `own` wins over the shared one of the same name.
  return Object.defineProperties(own, { ...Object.getOwnPropertyDescriptors(control), ...Object.getOwnPropertyDescriptors(own) });
}

/** The current snapshot from the store, for event handlers. */
function current(handle: InputHandle): FieldSnapshot<unknown, unknown> {
  return handle.store.getSnapshot(handle.path);
}

function textProps(source: InputSource, options: AnyInputOptions | undefined, textarea: boolean): object {
  const { handle, read } = source;
  const own = {
    get value() {
      const { value, meta } = read();
      const shown = displayOf(meta);
      return shown ? shown.display(value) : asText(value);
    },
    get readonly() {
      return read().readOnly;
    },
    onInput: (event: Event) => {
      const input = inputOf(event);
      if (!input) return;
      handle.setValue(input.value);
      const { value, meta } = current(handle);
      displayOf(meta)?.edit?.(input, value, event);
    },
  };
  // A textarea has no `type`. Defined, not assigned, so the getters above stay getters.
  if (!textarea) Object.defineProperty(own, "type", { value: options?.type ?? "text", enumerable: true });
  return withControl(source, options, own);
}

function numberProps(source: InputSource, options: AnyInputOptions | undefined): object {
  const { handle, read, register } = source;
  let element: HTMLInputElement | undefined;
  // The value the last edit left in the field, until the input loses focus.
  // While the field still holds it, the input keeps the text as typed, so
  // `2.50` or `1.` isn't rewritten under the cursor.
  let typed: { readonly value: unknown } | undefined;
  const own = {
    type: options?.type ?? "number",
    get value() {
      const value = read().value;
      return element !== undefined && typed !== undefined && Object.is(typed.value, value) ? element.value : asText(value);
    },
    get readonly() {
      return read().readOnly;
    },
    onInput: (event: Event) => {
      const input = inputOf(event);
      if (!(input instanceof HTMLInputElement)) return;
      let value: unknown = Number.isNaN(input.valueAsNumber) ? Number(input.value) : input.valueAsNumber;
      // An empty value with `badInput` is text such as `-` that isn't a number yet.
      if (input.value === "") value = input.validity.badInput ? Number.NaN : options?.empty;
      if (Number.isNaN(value)) {
        typed = { value: current(handle).value };
        return;
      }
      typed = { value };
      handle.setValue(value);
    },
    onBlur: () => {
      // Once the input loses focus it shows the field's number again.
      typed = undefined;
      if (element !== undefined) element.value = asText(current(handle).value);
      handle.handleBlur();
    },
  };
  const tracked: InputSource = {
    ...source,
    register: (input) => {
      if (input instanceof HTMLInputElement) element = input;
      register(input);
    },
  };
  return withControl(tracked, options, own);
}

/** Puts every radio button of the field back to the field's value. */
function restoreRadios(handle: InputHandle): void {
  const value = asText(current(handle).value);
  for (const element of elementsOf(handle)) {
    if (element instanceof HTMLInputElement && element.type === "radio") element.checked = element.value === value;
  }
}

function checkboxProps(source: InputSource, options: AnyInputOptions | undefined): object {
  const { handle, read } = source;
  const group = options?.value !== undefined;
  const option = options?.value;
  const holds = (value: unknown) => (group ? Array.isArray(value) && value.includes(option) : value === true);
  const own = {
    type: "checkbox",
    value: group ? asText(option) : undefined,
    get checked() {
      return holds(read().value);
    },
    get "aria-readonly"() {
      return read().readOnly ? "true" : undefined;
    },
    onChange: (event: Event) => {
      const input = inputOf(event);
      if (!(input instanceof HTMLInputElement)) return;
      const snapshot = current(handle);
      if (snapshot.readOnly) {
        input.checked = holds(snapshot.value);
        return;
      }
      if (!group) {
        handle.setValue(input.checked);
        return;
      }
      const list: readonly unknown[] = Array.isArray(snapshot.value) ? snapshot.value : [];
      if (input.checked) handle.setValue(list.includes(option) ? list : [...list, option]);
      else handle.setValue(list.filter((each) => each !== option));
    },
  };
  return withControl(source, options, own, group ? optionId(handle.id, asText(option)) : handle.id);
}

function radioProps(source: InputSource, options: AnyInputOptions | undefined): object {
  const { handle, read } = source;
  const option = options?.value;
  const own = {
    type: "radio",
    value: asText(option),
    get checked() {
      return read().value === option;
    },
    get "aria-readonly"() {
      return read().readOnly ? "true" : undefined;
    },
    onChange: (event: Event) => {
      const input = inputOf(event);
      if (!(input instanceof HTMLInputElement)) return;
      if (current(handle).readOnly) restoreRadios(handle);
      else if (input.checked) handle.setValue(option);
    },
  };
  return withControl(source, options, own, optionId(handle.id, asText(option)));
}

function selectProps(source: InputSource, options: AnyInputOptions | undefined): object {
  const { handle, read } = source;
  const own = {
    get value() {
      return asText(read().value);
    },
    get "aria-readonly"() {
      return read().readOnly ? "true" : undefined;
    },
    onChange: (event: Event) => {
      const select = event.currentTarget;
      if (!(select instanceof HTMLSelectElement)) return;
      const snapshot = current(handle);
      if (snapshot.readOnly) select.value = asText(snapshot.value);
      else handle.setValue(select.value);
    },
  };
  return withControl(source, options, own);
}

/** Builds the input props for `options.kind`. The caller's overloads type the result. */
export function buildInputProps(source: InputSource, options: AnyInputOptions | undefined): object {
  switch (options?.kind ?? "text") {
    case "textarea":
      return textProps(source, options, true);
    case "number":
      return numberProps(source, options);
    case "checkbox":
      return checkboxProps(source, options);
    case "radio":
      return radioProps(source, options);
    case "select":
      return selectProps(source, options);
    default:
      return textProps(source, options, false);
  }
}

/** An option value with its type, so `1` and `"1"` give different keys. */
function typedKey(value: unknown): string {
  return `${typeof value}:${asText(value)}`;
}

/** A key that is equal for two option objects that build the same props. */
export function optionsKey(options: AnyInputOptions = {}): string {
  return [options.kind ?? "text", options.type ?? "", typedKey(options.value), typedKey(options.empty), options.describedBy ?? ""].join("|");
}
