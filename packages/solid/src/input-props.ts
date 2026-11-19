import { errorId, type FieldSnapshot, optionId } from "@lunarhue/forms-core";
import type { ControlProps } from "./input.js";
import { asText, type FieldPieces, type PiecesHandle } from "./pieces.js";
import { elementsOf } from "./refs.js";

/** A field object as the input props read it: its snapshot getters, handle and pieces. */
export type InputField = FieldSnapshot<unknown, unknown> &
  FieldPieces & {
    readonly handle: { readonly id: string } & PiecesHandle;
  };

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
function withControl(field: InputField, options: AnyInputOptions | undefined, own: object, id = field.handle.id): object {
  const errorsId = errorIdOf(field.handle);
  const control: ControlProps<HTMLElement> = {
    id,
    get name() {
      return field.name;
    },
    ref: field.ref,
    onBlur: field.handleBlur,
    get disabled() {
      return field.disabled;
    },
    get "aria-invalid"() {
      return field.shownErrors.length > 0 ? "true" : undefined;
    },
    get "aria-describedby"() {
      const ids: string[] = [];
      if (options?.describedBy) ids.push(options.describedBy);
      if (field.shownErrors.length > 0) ids.push(errorsId);
      return ids.length > 0 ? ids.join(" ") : undefined;
    },
  };
  // A prop of `own` wins over the shared one of the same name.
  return Object.defineProperties(own, { ...Object.getOwnPropertyDescriptors(control), ...Object.getOwnPropertyDescriptors(own) });
}

/** The current snapshot from the store, for event handlers. */
function current(handle: PiecesHandle): FieldSnapshot<unknown, unknown> {
  return handle.store.getSnapshot(handle.path);
}

function textProps(field: InputField, options: AnyInputOptions | undefined, textarea: boolean): object {
  const own = {
    get value() {
      return field.text;
    },
    get readonly() {
      return field.readOnly;
    },
    onInput: (event: Event) => {
      const input = inputOf(event);
      if (input) field.setText(input.value, event);
    },
  };
  // A textarea has no `type`. Defined, not assigned, so the getters above stay getters.
  if (!textarea) Object.defineProperty(own, "type", { value: options?.type ?? "text", enumerable: true });
  return withControl(field, options, own);
}

function numberProps(field: InputField, options: AnyInputOptions | undefined): object {
  const { handle } = field;
  let element: HTMLInputElement | undefined;
  const own = {
    type: options?.type ?? "number",
    get value() {
      return field.text;
    },
    get readonly() {
      return field.readOnly;
    },
    ref: (input: HTMLElement) => {
      if (input instanceof HTMLInputElement) element = input;
      field.ref(input);
    },
    onInput: (event: Event) => {
      const input = inputOf(event);
      // An empty value with `badInput` is text such as `-` or `1.` that isn't a number yet.
      // The element keeps it as typed, so this writes nothing and changes no text.
      if (input instanceof HTMLInputElement && !input.validity.badInput) field.setNumberText(input.value, options?.empty);
    },
    onBlur: () => {
      field.handleBlur();
      // Once the input loses focus it shows the field's number again, including over text such as `1.`.
      if (element !== undefined) element.value = asText(current(handle).value);
    },
  };
  return withControl(field, options, own);
}

/** Puts every radio button of the field back to the field's value. */
function restoreRadios(handle: PiecesHandle): void {
  const value = asText(current(handle).value);
  for (const element of elementsOf(handle)) {
    if (element instanceof HTMLInputElement && element.type === "radio") element.checked = element.value === value;
  }
}

function checkboxProps(field: InputField, options: AnyInputOptions | undefined): object {
  const { handle } = field;
  const group = options?.value !== undefined;
  const option = options?.value;
  const holds = (value: unknown) => (group ? Array.isArray(value) && value.includes(option) : value === true);
  const own = {
    type: "checkbox",
    value: group ? asText(option) : undefined,
    get checked() {
      return holds(field.value);
    },
    get "aria-readonly"() {
      return field.readOnly ? "true" : undefined;
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
  return withControl(field, options, own, group ? optionId(handle.id, asText(option)) : handle.id);
}

function radioProps(field: InputField, options: AnyInputOptions | undefined): object {
  const { handle } = field;
  const option = options?.value;
  const own = {
    type: "radio",
    value: asText(option),
    get checked() {
      return field.value === option;
    },
    get "aria-readonly"() {
      return field.readOnly ? "true" : undefined;
    },
    onChange: (event: Event) => {
      const input = inputOf(event);
      if (!(input instanceof HTMLInputElement)) return;
      if (current(handle).readOnly) restoreRadios(handle);
      else if (input.checked) handle.setValue(option);
    },
  };
  return withControl(field, options, own, optionId(handle.id, asText(option)));
}

function selectProps(field: InputField, options: AnyInputOptions | undefined): object {
  const { handle } = field;
  const own = {
    get value() {
      return asText(field.value);
    },
    get "aria-readonly"() {
      return field.readOnly ? "true" : undefined;
    },
    onChange: (event: Event) => {
      const select = event.currentTarget;
      if (!(select instanceof HTMLSelectElement)) return;
      const snapshot = current(handle);
      if (snapshot.readOnly) select.value = asText(snapshot.value);
      else handle.setValue(select.value);
    },
  };
  return withControl(field, options, own);
}

/** Builds the input props for `options.kind`. The caller's overloads type the result. */
function buildInputProps(field: InputField, options: AnyInputOptions | undefined): object {
  switch (options?.kind ?? "text") {
    case "textarea":
      return textProps(field, options, true);
    case "number":
      return numberProps(field, options);
    case "checkbox":
      return checkboxProps(field, options);
    case "radio":
      return radioProps(field, options);
    case "select":
      return selectProps(field, options);
    default:
      return textProps(field, options, false);
  }
}

/** An option value with its type, so `1` and `"1"` give different keys. */
function typedKey(value: unknown): string {
  return `${typeof value}:${asText(value)}`;
}

/** A key that is equal for two option objects that build the same props. */
function optionsKey(options: AnyInputOptions = {}): string {
  return [options.kind ?? "text", options.type ?? "", typedKey(options.value), typedKey(options.empty), options.describedBy ?? ""].join("|");
}

const propsCache = new WeakMap<object, Map<string, object>>();

/** The input props for a field object, the same object for the same options. */
export function inputPropsFor(field: InputField, options: AnyInputOptions | undefined): object {
  let byKey = propsCache.get(field);
  if (byKey === undefined) propsCache.set(field, (byKey = new Map()));
  const key = optionsKey(options);
  let props = byKey.get(key);
  if (props === undefined) byKey.set(key, (props = buildInputProps(field, options)));
  return props;
}
