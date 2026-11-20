---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Handles are strict in their value type. A component that asks for `ArrayHandle<Tag[]>` no longer takes the handle of a `WideTag[]` with more keys, since its `push` and `setValue` would store items without them. The same holds for object handles and for `HandleOf<typeof fieldset>`. A handle of a form with more plugins still fits one that asks for fewer.

To keep a reusable component that takes wider values, make it generic. A fieldset component passes its type parameter as the second argument of `HandleOf`:

```tsx
// Before
function AddressFields(props: { field: HandleOf<typeof AddressFieldset> }) { ... }

// After
function AddressFields<A extends Address>(props: { field: HandleOf<typeof AddressFieldset, A> }) { ... }
```

A list component is generic in its item type and takes a function that makes a full item, since it can't build the keys it doesn't know:

```tsx
function TagList<T extends Tag>(props: { tags: ArrayHandle<T[], FormError, "arrays">; create: (base: Tag) => T }) {
  // props.tags.push(props.create({ id: 1, name: "" }))
}
```

Inside such a component, `field.at("city")` reads as its type in the constraint, so it fits a `FieldApi<string>` component. Some things still need help:

- `useInputProps` and `createInputProps` read the value type from the handle's own type. Type the child first: `const city: FieldHandle<string> = field.at("city")`.
- A merge write on a generic object, `field.setValue({ city: "Oslo" })`, doesn't type-check. Write the child: `field.at("city").setValue("Oslo")`.
- A child that is an object itself stays generic and needs a generic component of its own.
- A generic handle passes only to props with the same plugin list. Type props as `HandleOf<typeof fieldset, A>` so they share the fieldset's.

Type changes that come with it:

- `setValue` on object and array handles, and `push` and `insert` on array handles, are properties instead of methods.
- `FieldHandle<V>` distributes over a generic `V`'s constraint, which is how the children of a generic handle resolve. For concrete types it gives the same handles as before.
- `fieldset.scope(handle)` infers the handle's type, and `Scope` and `ScopeMembers` take the root's value type as a last, optional parameter.
- `HandleOf` takes an optional second parameter, the value type. It defaults to the fieldset's.
- In Solid, a `FieldType` is checked exactly against the component type it was made with.
