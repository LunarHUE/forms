import { describe, expect, it } from "vitest";

import { hideDevtools } from "./devtools";

const header = 'import { createForms } from "@lunarhue/forms-react";\nimport { docsDevtools } from "@/devtools/enabled";\n\n';

describe("hideDevtools", () => {
  it("drops the import and a lone docsDevtools plugin", () => {
    expect(hideDevtools(`${header}const forms = createForms({ plugins: [docsDevtools] });\n`)).toBe(
      'import { createForms } from "@lunarhue/forms-react";\n\nconst forms = createForms();\n',
    );
  });

  it("keeps the other plugins and options", () => {
    expect(hideDevtools("createForms({ plugins: [mask(), docsDevtools], fields: { PhoneField } })")).toBe(
      "createForms({ plugins: [mask()], fields: { PhoneField } })",
    );
    expect(hideDevtools("createForms({ plugins: [docsDevtools], fields: { TextField } })")).toBe(
      "createForms({ fields: { TextField } })",
    );
  });

  it("leaves a file without the wiring alone", () => {
    const code = 'export function TextField() {\n  return "id";\n}\n';
    expect(hideDevtools(code)).toBe(code);
  });

  it("throws on wiring it can't hide", () => {
    expect(() => hideDevtools("createForms({ plugins: [docsDevtools, mask()] })")).toThrow(/can't hide/);
  });
});
