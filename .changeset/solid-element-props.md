---
"@lunarhue/forms-solid": minor
---

`inputProps` no longer takes a `kind`, and `createInputProps` is gone. Each kind of element has its own function, the same set as in `@lunarhue/forms-react`, and each one type-checks only on a field of the value type it writes. The same holds for `./v1`.

| Function | Element | Field type |
| --- | --- | --- |
| `inputProps(field, { type, describedBy }?)` | text-like `<input>` | string |
| `textareaProps(field, { describedBy }?)` | `<textarea>` | string |
| `selectProps(field, { empty, describedBy }?)` | `<select>` | string |
| `numberProps(field, { empty, describedBy }?)` | `<input type="number">` | number |
| `rangeProps(field, { describedBy }?)` | `<input type="range">` | number |
| `checkboxProps(field, { describedBy }?)` | `<input type="checkbox">` | boolean |
| `checkboxGroupProps(field, value, { describedBy }?)` | one box of a group | array of strings or numbers |
| `radioProps(field, value, { describedBy }?)` | one radio | string, number or boolean |

`describedBy` works as before: its ids go in `aria-describedby` ahead of the error id. `empty` is still required when the field's type has no `undefined`. `selectProps` now takes it too, and writes it when the user picks an option whose value is `""`. The props still read the field through getters, so each one updates the element on its own.

```tsx
// Before
<input {...inputProps(field, { kind: "number", empty: 0 })} />
<input {...inputProps(field, { kind: "radio", value: "pro", describedBy: "plan-hint" })} />
<input {...inputProps(field, { kind: "checkbox", value: "urgent" })} />
<input {...inputProps(field, { kind: "number", type: "range" })} />

// After
<input {...numberProps(field, { empty: 0 })} />
<input {...radioProps(field, "pro", { describedBy: "plan-hint" })} />
<input {...checkboxGroupProps(field, "urgent")} />
<input {...rangeProps(field)} />
```

For a handle, make the field object with `createField(handle)` and pass that:

```tsx
// Before
<input {...createInputProps(handle, { kind: "checkbox" })} />

// After
<input {...checkboxProps(createField(handle))} />
```

`field.setNumberText` is gone, and `field.text` no longer holds the text typed in a number input. `field.handleBlur` no longer drops that text either. Bind a number input by hand with `numberPieces(field, { empty }?)`, which returns that text with its own `setText` and `handleBlur`:

```tsx
// Before
<input value={field.text} onInput={(event) => field.setNumberText(event.currentTarget.value)} onBlur={field.handleBlur} />

// After
const number = numberPieces(field);
<input value={number.text} onInput={(event) => number.setText(event.currentTarget.value)} onBlur={number.handleBlur} />
```

A range input now writes `valueAsNumber`, and puts the slider back while the field is read-only. `inputProps` and `textareaProps` now take a field of a union of string literals, as in React.

The types `CheckableProps`, `ControlProps`, `InputOptions`, `TextareaOptions`, `NumberInputOptions`, `NumberInputType`, `CheckboxOptions`, `CheckboxGroupOptions`, `RadioOptions` and `SelectOptions` are gone. `BaseInputProps` takes the place of `ControlProps`. `CheckboxInputProps`, `CheckboxGroupInputProps` and `RadioInputProps` replace `CheckableProps`, and `RangeInputProps` names the props of a range input. `DescribedByOption` names the `{ describedBy }` option, `EmptyOption<V>` the `{ empty }` option, and `NumberPieces` what `numberPieces` returns. `NumberInputProps` is for number inputs only.
