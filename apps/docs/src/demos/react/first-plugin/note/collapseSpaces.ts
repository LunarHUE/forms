import { definePlugin } from "@lunarhue/forms-react/plugins";

// Every string written to the form loses its doubled spaces.
export const collapseSpaces = () =>
  definePlugin({
    name: "collapseSpaces",
    setup: () => ({
      beforeWrite: (write) => (typeof write.value === "string" ? write.value.replace(/ {2,}/g, " ") : write.value),
    }),
  });
