import type { FieldPath, Path } from "../path.js";
import type { HookPlugin, PluginContext } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import type { IsUnknown } from "../value.js";

/** What a rule decides for its field. A flag left out stays as it is. */
export interface RuleResult {
  readonly disabled?: boolean;
  readonly hidden?: boolean;
}

/**
 * The meta `rules` keeps on each field. Read it with the plugin's reader, as
 * `deliveryRules.meta(field).hidden`. A field no rule hides reads
 * `{ hidden: false }`.
 */
export interface RulesMeta {
  readonly hidden: boolean;
}

const shown: RulesMeta = Object.freeze({ hidden: false });

/** A rule. It gets the whole form value and returns its field's flags. */
export type Rule<V> = (value: V) => RuleResult;

/**
 * What `rules` takes when `V` is left out. The compiler names the missing
 * property, which says what to write.
 */
export interface RulesNeedValueType {
  readonly "Name the form's value type, as rules<Order>({ ... })": never;
}

/** What `rules` takes: a rule for each field, keyed by the field's dotted name, as `name` props take it. */
export type RuleFields<V> = IsUnknown<V> extends true ? RulesNeedValueType : { readonly [P in FieldPath<V>]?: Rule<V> };

/** The plugin `rules` returns. `V` is the value type its rules take. */
export interface RulesPlugin<V> extends HookPlugin<undefined, "rules", RulesMeta, unknown, never> {
  /**
   * Type information only, always undefined at runtime. It lets a form check
   * that its value fits `V`, since the rules get the form's value as a `V`.
   */
  readonly "~value"?: (value: V) => never;
}

/**
 * Derives each named field's `disabled` flag and a `hidden` meta flag from
 * the form value. `fields` maps a field's dotted name, such as
 * `"address.state"`, to a rule that gets the whole value. Names go through
 * objects only, as `name` props do, so a rule can't name an array item.
 * Rules run when the store is made and after every batch that wrote a value,
 * before listeners, so the flags land in the same render as the value.
 *
 * Name the form's value type, as `rules<Order>({ ... })`. A name that isn't
 * a field of `Order` is a type error, and so is installing the plugin on a
 * form whose value isn't an `Order`.
 *
 * What the rules set when the store is made is part of its starting state,
 * so the server renders it and hydration sees the same flags. Disabling an
 * object, such as `"shipping"`, disables every field below it.
 */
export function rules<V>(fields: RuleFields<V>): RulesPlugin<V> {
  const plugin: RulesPlugin<V> = defineHooks({
    name: "rules",
    initialMeta: shown,
    setup(ctx: PluginContext<RulesMeta>) {
      const { store } = ctx;
      // The parameter's type checked each name against `V`. Here they are plain strings.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const named = fields as Readonly<Record<string, Rule<V>>>;
      const list = Object.entries(named).map(([name, rule]): [Path, Rule<V>] => [name.split("."), rule]);
      const apply = () => {
        // The root value is the form's value, of type V.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const value = store.getSnapshot([]).value as V;
        for (const [path, rule] of list) {
          const { disabled, hidden } = rule(value);
          const snapshot = store.getSnapshot(path);
          if (disabled !== undefined && snapshot.disabled !== disabled) ctx.write(() => store.fieldAt(path)?.setDisabled(disabled));
          if (hidden !== undefined && plugin.meta(snapshot).hidden !== hidden) ctx.setMeta(path, { hidden });
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
