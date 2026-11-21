import type { FieldPath, Path } from "../path.js";
import type { MetaHolder, PartContext, PluginFactory } from "../plugin.js";
import { defineWith } from "../store/define.js";
import { part } from "./part.js";

/** What a rule decides for its field. A flag left out stays as it is. */
export interface RuleResult {
  readonly disabled?: boolean;
  readonly hidden?: boolean;
}

/**
 * The meta `rules` keeps on each field. Read it with `rules.meta(field)`. A
 * field no rule hides reads `{ hidden: false }`.
 */
export interface RulesMeta {
  readonly hidden: boolean;
}

const shown: RulesMeta = Object.freeze({ hidden: false });

/** A rule. It gets the value where its part attaches and returns its field's flags. */
export type Rule<V> = (value: V) => RuleResult;

/** What `ruled` takes: a rule for each field, keyed by the field's dotted name, as `name` props take it. */
export type RuleFields<V> = { readonly [P in FieldPath<V>]?: Rule<V> };

// Only `rules` writes this slot.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const meta = (source: MetaHolder): RulesMeta => (source.meta?.["rules"] as RulesMeta | undefined) ?? shown;

/** What a `rules` part takes, with the value type erased. `ruled` types it. */
type AnyRuleFields = { readonly [name: string]: Rule<never> | undefined };

/**
 * The rules plugin. Put `rules()` in the form's plugins, and `ruled(...)`
 * on a fieldset, `forms.fieldset(Billing, ruled({ ... }))`, or after a
 * definition's config, `define(config, ruled({ ... }))`.
 *
 * Each rule sets its field's `disabled` flag and a `hidden` meta flag from
 * the value where its part attaches: the fieldset's value, or the form's.
 * Rules run when the part attaches and after every batch that wrote a value
 * there, before listeners, so the flags land in the same render as the
 * value. What they set before the store has listeners is part of its
 * starting state, so the server renders it and hydration sees the same
 * flags. Disabling an object, such as `"shipping"`, disables every field
 * below it.
 */
export const rules: PluginFactory<undefined, "rules", RulesMeta, never, never, readonly [], void, AnyRuleFields> = /* @__PURE__ */ defineWith(
  {
    name: "rules",
    initialMeta: shown,
    part(ctx: PartContext<RulesMeta>, fields: AnyRuleFields) {
      const { store, path } = ctx;
      const list = Object.entries(fields).map(([name, rule]): [string, Path, Rule<never> | undefined] => [name, [...path, ...name.split(".")], rule]);
      const apply = () => {
        // A rule gets the value of the place its part fits, as `ruled` typed it.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const value = ctx.value() as never;
        for (const [name, at, rule] of list) {
          if (!rule) continue;
          const { disabled, hidden } = rule(value);
          const snapshot = store.getSnapshot(at);
          if (disabled !== undefined && snapshot.disabled !== disabled) ctx.write(() => ctx.at(name).setDisabled(disabled));
          if (hidden !== undefined && meta(snapshot).hidden !== hidden) ctx.setMeta(at, { hidden });
        }
      };
      apply();
      return {
        onWrite(records) {
          if (records.some((record) => record.type === "value" || record.type === "insert" || record.type === "remove")) apply();
        },
      };
    },
  },
);

/**
 * Rules for the fields of a fieldset or a form, keyed by dotted name, as
 * `ruled({ address: (billing) => ({ hidden: billing.sameAsShipping }) })`.
 * Each rule gets the value where the part attaches, typed from the
 * fieldset or the definition it goes on. Needs `rules()`.
 */
export const ruled = <V>(fields: RuleFields<V>) => part<typeof rules, V>(rules, fields);
