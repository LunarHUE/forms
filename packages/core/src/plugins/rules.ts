import type { FieldPath, Path } from "../path.js";
import type { Part, Plugin, PluginContext } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import { reach } from "../store/handles.js";
import { createParts } from "../store/parts.js";

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

/** The `rules` factory, with the reader of its meta. */
export interface Rules {
  /** The rules plugin, for the form's plugins. */
  (): Plugin<undefined, "rules", RulesMeta>;
  /** Reads the `hidden` flag from a field snapshot or a field object, as `rules.meta(field).hidden`. */
  readonly meta: Plugin<undefined, "rules", RulesMeta>["meta"];
}

// Only `rules` writes this slot.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const meta: Rules["meta"] = (source) => (source.meta?.["rules"] as RulesMeta | undefined) ?? shown;

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
export const rules: Rules = /* @__PURE__ */ Object.assign(
  (): Plugin<undefined, "rules", RulesMeta> =>
    defineHooks({
      name: "rules",
      initialMeta: shown,
      attach(ctx: PluginContext<RulesMeta>, fields: Readonly<Record<string, Rule<unknown>>>) {
        const { store, path } = ctx;
        const list = Object.entries(fields).map(([name, rule]): [Path, Rule<unknown>] => [[...path, ...name.split(".")], rule]);
        const apply = () => {
          const value = store.getSnapshot(path).value;
          for (const [at, rule] of list) {
            const { disabled, hidden } = rule(value);
            const snapshot = store.getSnapshot(at);
            if (disabled !== undefined && snapshot.disabled !== disabled) ctx.write(() => reach(store, at).setDisabled(disabled));
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
    }, { "~parts": createParts }),
  { meta },
);

/**
 * Rules for the fields of a fieldset or a form, keyed by dotted name, as
 * `ruled({ address: (billing) => ({ hidden: billing.sameAsShipping }) })`.
 * Each rule gets the value where the part attaches, typed from the
 * fieldset or the definition it goes on. Needs `rules()`.
 */
export const ruled = <V>(fields: RuleFields<V>): Part<"rules", V> => ({ plugin: "rules", config: fields });
