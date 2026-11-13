import { createFormsCore, type FormsConfig } from "@lunarhue/forms-core";
import { createUniqueId } from "solid-js";
import { createFormContext, readForm, useAnyForm } from "./context.js";
import type { RuntimeFocus } from "./focus.js";
import { buildForm, type RuntimeStore } from "./form-runtime.js";
import { scopeCache, type RuntimeComponent, type RuntimeHandle } from "./scope-runtime.js";

export { useAnyForm };

/** `createForms` options with their types erased. */
interface RuntimeOptions extends FormsConfig<[], unknown> {
  readonly focusOnInvalid?: RuntimeFocus;
  readonly fields?: Readonly<Record<string, RuntimeComponent>>;
}

/** Per-form settings with their types erased. */
interface RuntimeSettings {
  readonly id?: string;
  readonly focusOnInvalid?: RuntimeFocus;
}

/** A core definition with its types erased. */
interface RuntimeDefinition {
  createStore(options: unknown, instance?: { readonly id?: string }): RuntimeStore;
}

/** See `CreateForms`. */
export function createFormsRuntime(options: RuntimeOptions = {}) {
  const core = createFormsCore(options);
  const scopeOf = scopeCache(options.fields ?? {});

  // `config` is a definition config, or a function of per-form options that returns one.
  const define = (config: object) => {
    // `SolidForms.define` checks the config's types. Here it passes through to core with them erased.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const definition = core.define(config as never) as unknown as RuntimeDefinition;
    // A function config takes per-form options, so `createForm`'s first argument is those options.
    const takesOptions = typeof config === "function";
    const context = createFormContext();

    const createForm = (...args: unknown[]) => {
      const [formOptions, settingsArg] = takesOptions ? args : [undefined, args[0]];
      // `CreateFormArgs` types the settings argument.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const settings = (settingsArg ?? {}) as RuntimeSettings;
      const store = definition.createStore(formOptions, { id: settings.id ?? createUniqueId() });
      return buildForm({
        store,
        scope: scopeOf(store.root),
        context,
        focusOnInvalid: settings.focusOnInvalid ?? options.focusOnInvalid ?? true,
      });
    };

    return {
      createStore: (formOptions: unknown, instance?: { readonly id?: string }) => definition.createStore(formOptions, instance),
      createForm,
      useFormContext: () => readForm(context, "useFormContext() of a definition"),
    };
  };

  /** A fieldset is a token whose `scope` is `forms.scope`, typed to the shape. */
  const fieldset = () => ({ scope: scopeOf });

  return { define, scope: (handle: RuntimeHandle) => scopeOf(handle), fieldset };
}
