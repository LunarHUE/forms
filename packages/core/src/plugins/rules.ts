import type { Path } from "../path.js";
import type { HookPlugin, PluginContext } from "../plugin.js";
import { definePlugin } from "../plugins.js";

/** What a rule decides for its field. A flag left out stays as it is. */
export interface RuleResult {
  readonly disabled?: boolean;
  readonly hidden?: boolean;
}

/** The meta `rules` sets on fields with a rule. Read it with `rules().meta(field)`. */
export interface RulesMeta {
  readonly hidden: boolean;
}

/**
 * Derives each named field's `disabled` flag and a `hidden` meta flag from
 * the form value. `fields` maps a dotted stable path, such as
 * `"address.state"`, to a rule that gets the whole value. Rules run when the
 * store is made and after every batch that wrote a value, before
 * listeners, so the flags land in the same render as the value.
 *
 * What the rules set when the store is made is part of its starting state,
 * so the server renders it and hydration sees the same flags. Disabling an
 * object, such as `"shipping"`, disables every field below it.
 */
// `V` only types the rules for the caller. The plugin hands them the store's value as a `V`.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function rules<V>(fields: Readonly<Record<string, (value: V) => RuleResult>>): HookPlugin<undefined, "rules", RulesMeta> {
  const plugin: HookPlugin<undefined, "rules", RulesMeta> = definePlugin({
    name: "rules",
    setup(ctx: PluginContext<RulesMeta>) {
      const { store } = ctx;
      const list = Object.entries(fields).map(([name, rule]): [Path, (value: V) => RuleResult] => [name.split("."), rule]);
      const apply = () => {
        // The root value is the form's value, of type V.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const value = store.getSnapshot([]).value as V;
        for (const [path, rule] of list) {
          const { disabled, hidden } = rule(value);
          const snapshot = store.getSnapshot(path);
          if (disabled !== undefined && snapshot.disabled !== disabled) ctx.write(() => store.fieldAt(path)?.setDisabled(disabled));
          if (hidden !== undefined && plugin.meta(snapshot)?.hidden !== hidden) ctx.setMeta(path, { hidden });
        }
      };
      apply();
      return {
        onWrite(records) {
          if (records.some((record) => record.type === "value" || record.type === "insert" || record.type === "remove")) apply();
        },
      };
    },
  });
  return plugin;
}
