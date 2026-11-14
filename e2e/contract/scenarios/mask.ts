import { digits, mask } from "@lunarhue/forms-core/plugins/mask";
import { scenario } from "../scenario.js";

/** Shows "5551234567" as "(555) 123-4567". */
function formatPhone(value: string): string {
  const area = value.slice(0, 3);
  const prefix = value.slice(3, 6);
  const line = value.slice(6, 10);
  if (value.length > 6) return `(${area}) ${prefix}-${line}`;
  if (value.length > 3) return `(${area}) ${prefix}`;
  return area;
}

const labels = { phone: "Phone" };

/**
 * A phone number stored as digits and shown formatted. The mask gives the
 * field its display text, so the input shows it with no override and keeps
 * the caret in place. The starting value is cleaned too.
 */
export const maskScenario = {
  ...scenario("mask", "Mask", { values: { [labels.phone]: "(555) 000-1111" } }),
  labels,
  submit: { idle: "Save", busy: "Saving..." },
  definition: {
    defaultValues: { phone: "555 000 1111" },
    plugins: [mask({ phone: { clean: digits, display: formatPhone } })] as const,
    onSubmit: (value: { phone: string }) => `Saved ${value.phone}.`,
  },
};
