import { createComponent, createContext, untrack, useContext, type Context, type Element as SolidElement } from "solid-js";

/** A form object with its types erased, as context holds it. */
export type RuntimeForm = Readonly<Record<string, unknown>>;

/** A context that holds a form, or null with no `form.Form` above. */
export type FormContext = Context<RuntimeForm | null>;

/** Makes a context for forms. `null` is its default, so reading it with no provider above doesn't throw. */
export function createFormContext(): FormContext {
  return createContext<RuntimeForm | null>(null);
}

/** Holds the nearest form of any definition. */
const anyForm = createFormContext();

/** Reads a form context and throws a clear error when no `form.Form` is above. */
export function readForm(context: FormContext, caller: string): RuntimeForm {
  const form = useContext(context);
  if (form === null) {
    throw new Error(`@lunarhue/forms-solid: ${caller} found no form. Render it inside the form's \`form.Form\`.`);
  }
  return form;
}

/** See `UseFormContext`. */
export function useAnyForm(): RuntimeForm {
  return readForm(anyForm, "useFormContext()");
}

/** The children `form.Form` takes: a function of the render props, or plain children. */
export type FormChildren = ((props: object) => SolidElement) | SolidElement;

/** The props of `form.Form`, with the form and its definition's context filled in. */
interface ProvideFormProps {
  readonly form: RuntimeForm;
  readonly context: FormContext;
  readonly renderProps: object;
  readonly children: FormChildren;
}

/** Calls a function child with the render props, or returns plain children as they are. */
function renderChildren(children: FormChildren, renderProps: object): SolidElement {
  if (typeof children === "function") return untrack(() => children(renderProps));
  return children;
}

/** `form.Form`: provides the form through both contexts and renders no element of its own. */
export function ProvideForm(props: ProvideFormProps): SolidElement {
  const { form, context, renderProps } = props;
  return createComponent(anyForm, {
    value: form,
    get children() {
      return createComponent(context, {
        value: form,
        get children() {
          return renderChildren(props.children, renderProps);
        },
      });
    },
  });
}
