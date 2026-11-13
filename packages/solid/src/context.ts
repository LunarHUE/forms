import { createComponent, createContext, untrack, useContext, type Element as SolidElement } from "solid-js";

/** A form object with its types erased, as context holds it. */
export type RuntimeForm = Readonly<Record<string, unknown>>;

/** What a `form.Form` provides: its form, and what the `form.Form` above it provides. */
interface FormNode {
  readonly form: RuntimeForm;
  readonly parent: FormNode | null;
}

/** The one context every `form.Form` provides. `null` is its default, so reading it with no provider above doesn't throw. */
const formContext = createContext<FormNode | null>(null);

/** The definition each form was made from. */
export const madeFrom = new WeakMap<RuntimeForm, object>();

/**
 * See `UseFormContext`. With a definition it walks up from the nearest
 * `form.Form` to the first form made from that definition. Throws a clear
 * error when there is none.
 */
export function useAnyForm(definition?: object): RuntimeForm {
  let node = useContext(formContext);
  if (definition !== undefined) {
    while (node !== null && madeFrom.get(node.form) !== definition) node = node.parent;
  }
  if (node === null) {
    throw new Error(
      definition === undefined
        ? "@lunarhue/forms-solid: useFormContext() found no form. Render it inside the form's `form.Form`."
        : "@lunarhue/forms-solid: useFormContext(definition) found no form made from that definition. It skips forms of other definitions. Render it inside the `form.Form` of a form made by `createForm(definition)`.",
    );
  }
  return node.form;
}

/** The children `form.Form` takes: a function of the render props, or plain children. */
export type FormChildren = ((props: object) => SolidElement) | SolidElement;

/** The props of `form.Form`, with the form filled in. */
interface ProvideFormProps {
  readonly form: RuntimeForm;
  readonly renderProps: object;
  readonly children: FormChildren;
}

/** Calls a function child with the render props, or returns plain children as they are. */
function renderChildren(children: FormChildren, renderProps: object): SolidElement {
  if (typeof children === "function") return untrack(() => children(renderProps));
  return children;
}

/** `form.Form`: provides the form, linked to the form above, and renders no element of its own. */
export function ProvideForm(props: ProvideFormProps): SolidElement {
  const { form, renderProps } = props;
  return createComponent(formContext, {
    value: { form, parent: useContext(formContext) },
    get children() {
      return renderChildren(props.children, renderProps);
    },
  });
}
