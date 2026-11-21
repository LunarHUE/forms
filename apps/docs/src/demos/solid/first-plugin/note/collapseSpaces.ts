import { definePlugin } from "@lunarhue/forms-solid/plugins";

// Trims and collapses doubled spaces on every string field when the user leaves it.
// Running on blur keeps the user's caret steady while they type.
export const collapseSpaces = definePlugin({
  name: "collapseSpaces",
  setup: (ctx) => ({
    onBlur(path) {
      const value = ctx.store.getSnapshot(path).value;
      if (typeof value !== "string") return;
      const clean = value.trim().replace(/ {2,}/g, " ");
      if (clean !== value) {
        ctx.write(() => ctx.store.fieldAt(path)?.setValue(clean, { edited: false }));
      }
    },
  }),
});
