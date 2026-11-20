import { scenario } from "../scenario.js";

const labels = { plan: "Plan", free: "Free", pro: "Pro", rating: "Rating", raise: "Raise the rating" };

/**
 * Fields the devtools inspector finds through their elements: a radio group,
 * whose radios share one field, and a custom input that records itself with
 * the adapter's field ref.
 */
export const inspectScenario = {
  ...scenario("inspect", "Inspect fields", { checked: [labels.free] }),
  labels,
  definition: {
    defaultValues: { plan: "free", rating: 3 },
  },
};
