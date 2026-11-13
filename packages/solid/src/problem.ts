// The package has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Where docs/errors.md lives, up to the anchor. Each code's entry has the
 * anchor `solid:<code>`.
 *
 * PLACEHOLDER: there is no docs site yet. Change this one constant when
 * there is.
 */
const docs = "https://forms.lunarhue.dev/errors#solid:";

/** Every error the adapter raises, as docs/errors.md lists it. */
export type Code = "field:target" | "context:form" | "context:forms" | "context:definition";

/**
 * The message for `code`: the package, then what went wrong, then a link to
 * the code's entry in docs/errors.md. Development says what went wrong in a
 * sentence. A bundler replaces the read of NODE_ENV with "production", folds
 * the check to false and drops the sentences, so production says the code.
 */
export function problem(code: Code): string {
  let text: string = code;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    const sentences: Record<Code, string> = {
      "field:target": "give a bound component a `name` or a `handle`.",
      "context:form": "useFormContext() found no form. Render it inside the form's `form.Form`.",
      "context:forms":
        "useFormContext(forms) found no form made from those forms. It skips forms of other `createForms` calls. Render it inside the `form.Form` of a form made from one of their definitions.",
      "context:definition":
        "useFormContext(definition) found no form made from that definition. It skips forms of other definitions. Render it inside the `form.Form` of a form made by `createForm(definition)`.",
    };
    text = sentences[code];
  }
  return `@lunarhue/forms-solid: ${text} ${docs}${code}`;
}
