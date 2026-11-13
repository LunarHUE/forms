import type { AnyFieldHandle, Validator, ValidatorInput } from "@lunarhue/forms-core";
import { createComponent, For, merge, omit, untrack, type Accessor, type Element as SolidElement } from "solid-js";
import { createFieldApi } from "./field-api.js";
import { createItemList } from "./items.js";
import { addValidator } from "./validator.js";

/** A handle with its types erased, as the runtime uses it. */
export type RuntimeHandle = AnyFieldHandle<unknown>;

/** A Solid component with its props erased. */
// `any` lets the app's components, whose props the types checked, be called here.
// oxlint-disable-next-line typescript/no-explicit-any
export type RuntimeComponent = (props: any) => SolidElement;

/** A scope with its types erased: `root`, `Field`, `Items`, and the registered components. */
export type RuntimeScope = Record<string, unknown> & { readonly root: RuntimeHandle };

/** `For` keyed by item identity: each item handle is its own key. */
const ForEach: (props: {
  readonly each: readonly unknown[];
  readonly fallback?: SolidElement;
  readonly children: (item: unknown, index: Accessor<number>) => SolidElement;
}) => SolidElement = For;

/** How a bound component names its field. */
interface FieldTarget {
  readonly name?: string;
  readonly handle?: RuntimeHandle;
}

/** A `validate` prop as the runtime reads it. */
type AnyValidateProp = ValidatorInput<unknown, unknown> | undefined | null | false;

/** The props of a bound component that renders one field: its target and its `validate`. */
interface OneField extends FieldTarget {
  readonly validate?: AnyValidateProp;
}

/** Props of the bound `Field`. */
interface FieldProps extends OneField {
  readonly children: (field: object) => SolidElement;
}

/** Props of the bound `Items`. */
interface ItemsProps extends FieldTarget {
  readonly fallback?: SolidElement;
  readonly children: (item: unknown, index: Accessor<number>) => SolidElement;
}

/** The field a bound component names, read once: `handle`, or `name` resolved from `root`. */
function resolveField(root: RuntimeHandle, props: FieldTarget): RuntimeHandle {
  return untrack(() => {
    if (props.handle !== undefined) return props.handle;
    if (props.name === undefined) throw new Error("@lunarhue/forms-solid: give a bound component a `name` or a `handle`.");
    let handle = root;
    for (const segment of props.name.split(".")) handle = handle.at(segment);
    return handle;
  });
}

/** The options object of a validate prop, or undefined for a function, a schema or none. */
function optionsOf(input: AnyValidateProp) {
  return input && typeof input === "object" && !("~standard" in input) ? input : undefined;
}

/** The function a validate prop gives, read when a run starts. Undefined for a schema or none. */
function functionOf(input: AnyValidateProp): Validator<unknown, unknown> | undefined {
  const check = optionsOf(input)?.validate ?? input;
  return typeof check === "function" ? check : undefined;
}

/**
 * Adds a bound component's `validate` prop for the life of its owner. The
 * kind and the options are read at mount. A function is read from the prop
 * when each run starts, so a reactive prop that gives another function
 * takes effect without registering again.
 */
function addPropValidator(handle: RuntimeHandle, props: OneField): void {
  const input = untrack(() => props.validate);
  if (functionOf(input) === undefined) {
    addValidator(handle, input);
    return;
  }
  const run: Validator<unknown, unknown> = (value, ctx) => functionOf(untrack(() => props.validate))?.(value, ctx);
  const options = optionsOf(input);
  addValidator(handle, options ? { ...options, validate: run } : run);
}

/** A registered component bound to a scope: it renders the app's component with `field` filled in. */
function RegisteredField(props: OneField & { readonly root: RuntimeHandle; readonly component: RuntimeComponent }): SolidElement {
  const handle = resolveField(props.root, props);
  addPropValidator(handle, props);
  const field = createFieldApi(handle);
  const component = untrack(() => props.component);
  return createComponent(component, merge(omit(props, "root", "component", "name", "handle", "validate"), { field }));
}

/** Builds the scope rooted at `root`, with the registered components in `fields`. */
function buildScope(root: RuntimeHandle, fields: Readonly<Record<string, RuntimeComponent>>): RuntimeScope {
  const scope: RuntimeScope = {
    root,
    // `scope.Field`: the field object for one field, passed to the children once.
    Field: (props: FieldProps) => {
      const handle = resolveField(root, props);
      addPropValidator(handle, props);
      const field = createFieldApi(handle);
      return untrack(() => props.children(field));
    },
    // `scope.Items`: the items of an array field, keyed by their stable keys.
    Items: (props: ItemsProps) => {
      const items = createItemList(resolveField(root, props));
      return createComponent(ForEach, {
        get each() {
          return items();
        },
        get fallback() {
          return props.fallback;
        },
        children: (item: unknown, index: Accessor<number>) => props.children(item, index),
      });
    },
  };
  for (const [name, component] of Object.entries(fields)) {
    scope[name] = (props: OneField) => createComponent(RegisteredField, merge(props, { root, component }));
  }
  return scope;
}

/**
 * Returns the function that gives the scope of a handle. It makes each
 * scope once and returns the same object for the same handle after that.
 */
export function scopeCache(fields: Readonly<Record<string, RuntimeComponent>>): (root: RuntimeHandle) => RuntimeScope {
  const scopes = new WeakMap<RuntimeHandle, RuntimeScope>();
  return (root) => {
    const cached = scopes.get(root);
    if (cached) return cached;
    const scope = buildScope(root, fields);
    scopes.set(root, scope);
    return scope;
  };
}
