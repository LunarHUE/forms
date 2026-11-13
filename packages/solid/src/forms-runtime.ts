import { createFormsCore, type FormsConfig } from "@lunarhue/forms-core";
import { createUniqueId } from "solid-js";
import { madeFrom, useAnyForm, type RuntimeForm } from "./context.js";
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

/** How each definition makes a form, from `createForm`'s arguments after the definition. */
const makers = new WeakMap<object, (args: readonly unknown[]) => RuntimeForm>();

/** See `CreateForm`. */
export function createFormRuntime(definition: object, ...args: unknown[]): RuntimeForm | undefined {
  return makers.get(definition)?.(args);
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
    // A function config takes per-form options, so `createForm`'s argument after the definition is those options.
    const takesOptions = typeof config === "function";

    makers.set(definition, (args) => {
      const [formOptions, settingsArg] = takesOptions ? args : [undefined, args[0]];
      // `CreateFormArgs` types the settings argument.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const settings = (settingsArg ?? {}) as RuntimeSettings;
      const store = definition.createStore(formOptions, { id: settings.id ?? createUniqueId() });
      const form = buildForm({
        store,
        scope: scopeOf(store.root),
        focusOnInvalid: settings.focusOnInvalid ?? options.focusOnInvalid ?? true,
      });
      madeFrom.set(form, definition);
      return form;
    });
    return definition;
  };

  /** A fieldset is a token whose `scope` is `forms.scope`, typed to the shape. */
  const fieldset = () => ({ scope: scopeOf });

  return { define, scope: (handle: RuntimeHandle) => scopeOf(handle), fieldset };
}
