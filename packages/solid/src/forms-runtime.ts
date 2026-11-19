import { attach, createFormsCore, type FormsConfig, type Part, type Plugins } from "@lunarhue/forms-core";
import { createUniqueId } from "solid-js";
import { madeBy, madeFrom, useAnyForm, type RuntimeForm } from "./context.js";
import type { RuntimeFocus } from "./focus.js";
import { buildForm, type RuntimeStore } from "./form-runtime.js";
import { pin } from "./field-type.js";
import { scopeCache, type RuntimeEntry, type RuntimeHandle } from "./scope-runtime.js";

export { useAnyForm };

/** `createForms` options with their types erased. */
interface RuntimeOptions extends FormsConfig<Plugins, unknown> {
  readonly focusOnInvalid?: RuntimeFocus;
  readonly fields?: Readonly<Record<string, RuntimeEntry>>;
}

/** Per-form settings with their types erased. */
interface RuntimeSettings {
  readonly id?: string;
  readonly focusOnInvalid?: RuntimeFocus;
  readonly plugins?: Plugins;
}

/** A core definition with its types erased. */
interface RuntimeDefinition {
  createStore(options: unknown, instance?: { readonly id: string; readonly plugins: Plugins | undefined }): RuntimeStore;
}

/** How each definition makes a form, from `createForm`'s arguments after the definition. */
const makers = new WeakMap<object, (args: readonly unknown[]) => RuntimeForm>();

/** See `createForm`. */
export function createFormRuntime(definition: object, ...args: unknown[]): RuntimeForm | undefined {
  return makers.get(definition)?.(args);
}

/** See `createForms`. */
export function createFormsRuntime(options: RuntimeOptions = {}) {
  const core = createFormsCore(options);
  const scopeOf = scopeCache(options.fields ?? {});

  // `config` is a definition config, or a function of per-form options that returns one.
  const define = (config: object, ...parts: readonly Part[]) => {
    // `SolidForms.define` checks the config's and the parts' types. Here they pass through to core with them erased.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const definition = core.define(config as never, ...(parts as never[])) as unknown as RuntimeDefinition;
    // A function config takes per-form options, so `createForm`'s argument after the definition is those options.
    const takesOptions = typeof config === "function";

    makers.set(definition, (args) => {
      const [formOptions, settingsArg] = takesOptions ? args : [undefined, args[0]];
      // `CreateFormArgs` types the settings argument.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const settings = (settingsArg ?? {}) as RuntimeSettings;
      const store = definition.createStore(formOptions, { id: settings.id ?? createUniqueId(), plugins: settings.plugins });
      const form = buildForm({
        store,
        scope: scopeOf(store.root),
        focusOnInvalid: settings.focusOnInvalid ?? options.focusOnInvalid ?? true,
      });
      madeFrom.set(form, definition);
      madeBy.set(form, forms);
      return form;
    });
    return definition;
  };

  /**
   * A fieldset is a token whose `scope` is `forms.scope`, typed to the shape,
   * after attaching its parts. Its first argument is its schema, or its
   * first part when it has no schema.
   */
  const fieldset = (first?: object, ...rest: readonly Part[]) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const parts = first === undefined || "~standard" in first ? rest : [first as Part, ...rest];
    return {
      scope(handle: RuntimeHandle) {
        if (parts.length > 0) attach(handle, parts, true);
        return scopeOf(handle);
      },
      at: (name: string) => pin(parts, name),
    };
  };

  const forms = { define, scope: (handle: RuntimeHandle) => scopeOf(handle), fieldset };
  return forms;
}
