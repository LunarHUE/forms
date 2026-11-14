// Core has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Where docs/errors.md lives, up to the anchor. Each code's entry has the
 * anchor `core:<code>`.
 *
 * PLACEHOLDER: there is no docs site yet. Change this one constant when
 * there is.
 *
 * Only development messages carry the link for now. In production it would
 * cost about 22 B in every entry and push several size limits over.
 */
const docs = "https://forms.lunarhue.dev/errors#core:";

/** Every error and warning core raises, as docs/errors.md lists it. */
export type Code =
  | "plugins:name"
  | "plugins:cycle"
  | "plugins:write"
  | "plugins:loop"
  | "plugins:copies"
  | "validation:definition"
  | "validation:validator"
  | "schema:defaults"
  | "rebase:store"
  | "submit:unseen";

/**
 * The message for `code`: the package, then what went wrong. Development
 * says it in a sentence, built from `value`, and links to the code's entry in
 * docs/errors.md. A bundler replaces the read of NODE_ENV with "production",
 * folds the check to false and drops the sentences and the link, so
 * production says the code, with `value` after it when there is one.
 */
export function problem(code: Code, value = ""): string {
  let text = value ? `${code} ${value}` : code;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    const fix = 'Add `validation()` from "@lunarhue/forms-core/plugins/validation", or a schema plugin such as `valibot()`, to `plugins`.';
    const sentences: Record<Code, (value: string) => string> = {
      "plugins:name": (name) => `Two plugins are named "${name}".`,
      "plugins:cycle": (name) => `Plugin "${name}" is part of an \`after\` cycle.`,
      "plugins:write": () => "A plugin wrote to the store from inside a hook. Write through `ctx.write`.",
      // 10 is `maxRounds` in store/plugins.ts.
      "plugins:loop": (names) => `Plugins kept answering each other's writes for 10 rounds: ${names}.`,
      "plugins:copies": () => "This store's plugins come from two copies of @lunarhue/forms-core. Install one copy.",
      "validation:definition": () => `This form's definition has \`validate\` or \`schema\`, but no plugin brings the validation runner. ${fix}`,
      "validation:validator": () =>
        `A validator was added to a field (through \`registerValidator\`, \`useValidator\` or a \`validate\` prop), but no plugin brings the validation runner. ${fix}`,
      "schema:defaults": (vendor) => `No schema plugin for vendor "${vendor}", so the definition needs defaultValues.`,
      "rebase:store": () => "rebase: the handle belongs to another store.",
      "submit:unseen": (where) =>
        `A submit failed on errors at ${where}, and nothing on the page reads them, so the user sees no error. Render the form's root errors, and the errors of object and array fields.`,
    };
    text = `${sentences[code](value)} ${docs}${code}`;
  }
  return `@lunarhue/forms-core: ${text}`;
}
