---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Plugins that work per field now take parts. A part is a plugin's config for one place: a field type, a fieldset or a form. The plugin goes in the form's plugins once, with no config, and its parts go where they apply. Using a field type or fieldset whose parts need a plugin the form lacks is a type error, such as `Add mask() to this form's plugins: PhoneField uses it`. Without types the store throws `plugins:missing`.

`field(component, ...parts)` from the adapters makes a field type. Register it in `fields` like a component. Its parts attach at each field it renders, the first time it renders it. `forms.fieldset(schema, ...parts)` and `forms.fieldset<V>(...parts)` take parts for each field the fieldset is used on, and `forms.define(config, ...parts)` takes parts for the whole form. `PhoneField.at(name)` and `Billing.at(name)` pin a field type's or fieldset's parts at one field, for `define`, so they attach when the store is made.

Fieldset scopes now carry the plugin names their parts need, so the field components a fieldset renders are checked against them.

To migrate a mask, install `mask()` and put `masked(...)` on the field type that renders the field:

```ts
// Before
const contact = forms.define({ defaultValues, plugins: [mask({ phone: { clean: digits, display: formatPhone } })] });

// After
const PhoneField = field(PhoneInput, masked({ clean: digits, display: formatPhone }));
const forms = createForms({ plugins: [mask()], fields: { PhoneField } });
const contact = forms.define({ defaultValues });
```

A wildcard such as `"lines.*.sku"` becomes a field type on the row's component. A field that may not render before its value matters, such as one on a later step, takes `PhoneField.at("phone")` after the config. `mask`'s `name` option is gone: a field type can carry two `masked` parts, which clean in order, and the first display wins.

To migrate rules, install `rules()` and pass `ruled(...)` after the config. It takes the value type from the definition, so it needs no type argument. Read `hidden` with `rules.meta(field)`:

```ts
// Before
const orderRules = rules<Order>({ street: (value) => ({ disabled: value.pickup }) });
const order = forms.define({ defaultValues, plugins: [orderRules] });
orderRules.meta(field).hidden;

// After
const order = forms.define({ defaultValues }, ruled({ street: (value) => ({ disabled: value.pickup }) }));
rules.meta(field).hidden;
```

Rules on a fieldset get the fieldset's value: `forms.fieldset(Billing, ruled({ ... }))`. To write rules apart from a definition, name the type, as `ruled<Order>({ ... })`.

A plugin list can hold `false`, `null` or `undefined`, as in `plugins: [mask(), dev && devtools()]`. The form skips them, and the types count a plugin that may be missing as not installed.

For plugin authors:

- `definePlugin` takes `attach(ctx, config)`, which runs once per path a part attaches at and returns hooks for that path. Its hooks get writes at or above the path walked down to it, and a refuse there refuses the whole write. Write a typed constructor for the parts, as `(config): Part<"mask", string> => ({ plugin: "mask", config })`.
- `requires: () => [dirty]` names plugins a plugin needs. The form must install them, or it is a type error. The plugin's hooks run after theirs, and `ctx.plugins` holds their APIs.
- `ctx.installed` lists the store's plugins in hook order, and `ctx.attachments(path)` the parts attached at a path and above.
- `attach` can return an `initial` hook, which gets the value at the part's path when the part attaches and returns the value to keep there.
- `FieldDisplay` meta is gone. Return `display` and `edit` hooks from `attach` instead.
- What `attach` writes makes no write records. A value `initial` cleans moves the baseline with it while the field isn't dirty, and a reset to the initial values keeps it clean.

New exports: `attach`, `Part`, `Parts`, `PartNames`, `Attachment`, `Requirements`, `RequiresMet`, `Nested`, `DefineParts`, `MetaHolder` and `PluginMembers` from core, `field` and `FieldType` from the adapters, and `FieldValueOf` from React.
