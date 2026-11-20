---
"@lunarhue/forms-react": minor
---

`inputProps` no longer takes a `kind`. Each kind of element has its own function, and each one type-checks only on a field of the value type it writes:

| Function | Element | Field type |
| --- | --- | --- |
| `inputProps(field, { type }?)` | text-like `<input>` | string |
| `textareaProps(field)` | `<textarea>` | string |
| `selectProps(field, { empty }?)` | `<select>` | string |
| `numberProps(field, { empty }?)` | `<input type="number">` | number |
| `rangeProps(field)` | `<input type="range">` | number |
| `checkboxProps(field)` | `<input type="checkbox">` | boolean |
| `checkboxGroupProps(field, value)` | one box of a group | array of strings or numbers |
| `radioProps(field, value)` | one radio | string, number or boolean |

A form ships only the functions it calls, so a form with text inputs only is about 530 B brotli smaller than before. `empty` is still required when the field's type has no `undefined`.

```tsx
// Before
<input {...inputProps(field, { kind: "number", empty: 0 })} />
<input {...inputProps(field, { kind: "radio", value: "pro" })} />
<input {...inputProps(field, { kind: "checkbox", value: "urgent" })} />

// After
<input {...numberProps(field, { empty: 0 })} />
<input {...radioProps(field, "pro")} />
<input {...checkboxGroupProps(field, "urgent")} />
```

`useInputProps` is gone. `useField(handle)` now returns the field object, the same one `form.Field` gives its children, so pass that to a props function. `useField(handle, select, isEqual?)` is unchanged.

```tsx
// Before
<input {...useInputProps(handle, { kind: "checkbox" })} />

// After
<input {...checkboxProps(useField(handle))} />
```

`field.setNumberText` is gone, and `field.text` no longer holds the text typed in a number input. Bind a number input by hand with `numberPieces(field, { empty }?)`, which returns that text with its own `setText` and `handleBlur`:

```tsx
// Before
<Input value={field.text} onValueChange={(text) => field.setNumberText(text)} onBlur={field.handleBlur} />

// After
const number = numberPieces(field);
<Input value={number.text} onValueChange={(text) => number.setText(text)} onBlur={number.handleBlur} />
```

The types `TextareaOptions`, `NumberInputOptions`, `CheckboxInputOptions`, `CheckboxGroupOptions`, `RadioInputOptions` and `SelectOptions` are gone. `EmptyOption<V>` names the `{ empty }` option, `RangeInputProps` the props of a range input, and `NumberPieces` what `numberPieces` returns. `NumberInputProps` is for number inputs only.
