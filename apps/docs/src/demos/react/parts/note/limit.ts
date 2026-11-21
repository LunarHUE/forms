import { definePlugin } from "@lunarhue/forms-react/plugins";

interface Limit {
  readonly max: number;
}

// The plugin. `part` runs once for each field a `limited` part lands on.
export const limit = definePlugin({
  name: "limit",
  part: (_ctx, { max }: Limit) => ({
    beforeWrite: (write) => (typeof write.value === "string" ? write.value.slice(0, max) : write.value),
  }),
});

// The part. It fits string fields only and needs limit() in the form's plugins.
export const limited = (max: number) => limit.part<string>({ max });
