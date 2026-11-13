import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
// The main entry's own modules, so the legacy entry's fallbacks never load here.
import { createForms, useForm } from "../src/forms.js";
import { modern } from "./render.js";

const profile = createForms().define({ defaultValues: { name: "Ada" } });

function Profile() {
  useForm(profile, { id: "profile" });
  return null;
}

const rendering = () => renderToString(<Profile />);

it.runIf(modern)("runs the main entry on React 18 and later", () => {
  expect(rendering).not.toThrow();
});

it.runIf(!modern)("throws a clear error at first use of the main entry on React before 18", () => {
  expect(rendering).toThrow("@lunarhue/forms-react: React before 18 needs @lunarhue/forms-react/legacy.");
});
