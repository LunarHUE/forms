import * as v from "valibot";
import { fakeServer } from "../fake-server.js";
import { scenario } from "../scenario.js";

const SignUp = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
  newsletter: v.boolean(),
  nickname: v.optional(v.string()),
  updates: v.optional(v.boolean()),
});

const labels = {
  name: "Name",
  email: "Email",
  newsletter: "Send me the newsletter",
  nickname: "Nickname",
  updates: "Send me product updates",
};

/**
 * A sign-up form: typing, blur, errors, focus on an invalid submit, and a
 * slow save. `nickname` and `updates` are optional and start out missing.
 */
export const basicScenario = {
  ...scenario("basic", "Basic form", {
    values: { [labels.name]: "Ada Lovelace", [labels.email]: "ada@example.com" },
  }),
  labels,
  errors: { name: "Enter your name.", email: "Enter a valid email." },
  submit: { idle: "Sign up", busy: "Signing up..." },
  /**
   * The attributes a valid input carries in every app, leaving out the
   * generated `id`. The contract picks one form where adapters could differ:
   * an explicit `type`, and no `aria-invalid` or `aria-readonly` while they
   * would say "false", since that is their default.
   */
  markup: {
    text: { name: "name", type: "text", value: "Ada Lovelace" },
    checkbox: { name: "newsletter", type: "checkbox" },
  },
  sources: { server: fakeServer },
  definition: {
    schema: SignUp,
    defaultValues: { name: "Ada Lovelace", email: "ada@example.com", newsletter: false },
    onSubmit: async (value: v.InferOutput<typeof SignUp>) => {
      const count = await fakeServer.save(value);
      return `Signed up ${value.name} (save ${count}).`;
    },
  },
};
