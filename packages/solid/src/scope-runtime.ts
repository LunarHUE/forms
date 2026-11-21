import { type NamedAnyFieldHandle, attach, type Part, type Validator, type ValidatorInput } from "@lunarhue/forms-core";
import { merge, omit } from "#solid";
import { createComponent, untrack } from "solid-js";
import type { SolidElement } from "./element.js";
import { createFieldApi } from "./field-api.js";
import { problem } from "./problem.js";
import { addValidator } from "./validator.js";

/** A handle with its types erased, as the runtime uses it. */
export type RuntimeHandle = NamedAnyFieldHandle<unknown>;

/** A Solid component with its props erased. */
// `any` lets the app's components, whose props the types checked, be called here.
// oxlint-disable-next-line typescript/no-explicit-any
export type RuntimeComponent = (props: any) => SolidElement;

/** A `fields` entry with its types erased: a component, or a field type from `defineField`. */
export type RuntimeEntry = RuntimeComponent | { readonly component: RuntimeComponent; readonly parts: readonly Part[] };

/** A scope with its types erased: `root`, `Field` and the registered components. */
export type RuntimeScope = Record<string, unknown> & { readonly root: RuntimeHandle };

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

/** The field a bound component names, read once: `handle`, or `name` resolved from `root`. */
function resolveField(root: RuntimeHandle, props: FieldTarget): RuntimeHandle {
  return untrack(() => {
    if (props.handle !== undefined) return props.handle;
    if (props.name === undefined) throw new Error(problem("field:target"));
    let handle = root;
    for (const segment of props.name.split(".")) handle = handle.at(segment);
    return handle;
  });
}

/** The function a validate prop gives, read when a run starts. Undefined for a schema or none. */
function functionOf(input: AnyValidateProp): Validator<unknown, unknown> | undefined {
  // A schema that is also a function, as some libraries make them, counts as a schema.
  return typeof input === "function" && !("~standard" in input) ? input : undefined;
}

/**
 * Adds a bound component's `validate` prop for the life of its owner. The
 * kind and the timing tags are read at mount. A function is read from the
 * prop when each run starts, so a reactive prop that gives another function
 * takes effect without registering again.
 */
function addPropValidator(handle: RuntimeHandle, props: OneField): void {
  const input = untrack(() => props.validate);
  const fn = functionOf(input);
  if (fn === undefined) {
    addValidator(handle, input);
    return;
  }
  // The tags `debounced`, `validateOn` and `recheckOnSubmit` put on the function come along.
  addValidator(
    handle,
    Object.assign((value: unknown, ctx: never) => functionOf(untrack(() => props.validate))?.(value, ctx), fn),
  );
}

/** A registered component bound to a scope: it renders the app's component with `field` filled in. */
function RegisteredField(props: OneField & { readonly root: RuntimeHandle; readonly entry: RuntimeEntry }): SolidElement {
  const handle = resolveField(props.root, props);
  const entry = untrack(() => props.entry);
  const { component, parts } = typeof entry === "function" ? { component: entry, parts: [] } : entry;
  // The parts attach before the field is read, so it renders what they did, on the server too.
  attach(handle, parts, true);
  addPropValidator(handle, props);
  const field = createFieldApi(handle);
  return createComponent(component, merge(omit(props, "root", "entry", "name", "handle", "validate"), { field }));
}

/** Builds the scope rooted at `root`, with the registered components in `fields`. */
function buildScope(root: RuntimeHandle, fields: Readonly<Record<string, RuntimeEntry>>): RuntimeScope {
  const scope: RuntimeScope = {
    root,
    // `scope.Field`: the field object for one field, passed to the children once.
    Field: (props: FieldProps) => {
      const handle = resolveField(root, props);
      addPropValidator(handle, props);
      const field = createFieldApi(handle);
      return untrack(() => props.children(field));
    },
  };
  for (const [name, entry] of Object.entries(fields)) {
    scope[name] = (props: OneField) => createComponent(RegisteredField, merge(props, { root, entry }));
  }
  return scope;
}

/**
 * Returns the function that gives the scope of a handle. It makes each
 * scope once and returns the same object for the same handle after that.
 */
export function scopeCache(fields: Readonly<Record<string, RuntimeEntry>>): (root: RuntimeHandle) => RuntimeScope {
  const scopes = new WeakMap<RuntimeHandle, RuntimeScope>();
  return (root) => {
    const cached = scopes.get(root);
    if (cached) return cached;
    const scope = buildScope(root, fields);
    scopes.set(root, scope);
    return scope;
  };
}
