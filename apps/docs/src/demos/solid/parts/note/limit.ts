import type { Part } from "@lunarhue/forms-solid";
import { definePlugin, part } from "@lunarhue/forms-solid/plugins";
import { replaceText } from "@lunarhue/forms-solid/text";

interface Limit {
  readonly max: number;
}

// The plugin. `part` runs once for each field a `limited` part lands on.
// `display` and `afterInput` keep the caret in place when typing in the middle of the text.
export const limit = definePlugin({
  name: "limit",
  part: (_ctx, { max }: Limit) => {
    const cap = (value: string) => value.slice(0, max);
    return {
      beforeWrite: (write) => (typeof write.value === "string" ? cap(write.value) : write.value),
      display: (value) => (typeof value === "string" ? value : ""),
      afterInput: (input, value, event) => replaceText(input, typeof value === "string" ? value : "", cap, event),
    };
  },
});

// The part. It fits string fields only and needs limit() in the form's plugins.
export const limited = (max: number): Part<typeof limit, string> => part(limit, { max });
