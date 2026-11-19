// The package has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * The errors page, up to the anchor. Its source is
 * apps/docs/src/content/errors.mdx. Each code's entry has the
 * anchor `react:<code>`. Only development messages carry the link, as in core.
 */
const docs = "https://forms.lunarhue.dev/errors#react:";

/** Every error and warning the adapter raises, as the errors page lists it. */
export type Code = "form:definition" | "context:form" | "context:forms" | "context:definition" | "id:server";

/**
 * The message for `code`: the package, then what went wrong. Development
 * says it in a sentence and links to the code's entry on the errors page. A
 * bundler replaces the read of NODE_ENV with "production", folds the check to
 * false and drops the sentences and the link, so production says the code.
 */
export function problem(code: Code): string {
  let text: string = code;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    const sentences: Record<Code, string> = {
      "form:definition": "useForm takes a definition from forms.define.",
      "context:form": "no form.Form is mounted above this component. Render it inside form.Form, or pass the form down as a prop.",
      "context:forms":
        "no form.Form of these forms is mounted above this component. Forms of other createForms calls don't count. Render it inside the form.Form of a form made from one of their definitions.",
      "context:definition":
        "no form.Form of this definition is mounted above this component. Forms of other definitions don't count. Render it inside the form.Form of a form made from it.",
      "id:server":
        "a form was server rendered without an `id`. React before 18 has no `useId`, so the generated id can't match on the client. Pass `id` to `useForm`.",
    };
    text = `${sentences[code]} ${docs}${code}`;
  }
  return `@lunarhue/forms-react: ${text}`;
}
