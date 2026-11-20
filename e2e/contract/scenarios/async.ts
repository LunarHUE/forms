import * as v from "valibot";
import { fakeServer } from "../fake-server.js";
import { scenario } from "../scenario.js";

const SignUp = v.object({
  username: v.pipe(v.string(), v.minLength(3, "Too short.")),
});

const labels = { username: "Username" };

/** An async check against the fake server, where a slow answer for an old value must be dropped. */
export const asyncScenario = {
  ...scenario("async", "Async validation", { values: { [labels.username]: "" } }),
  labels,
  errors: { taken: "That name is taken." },
  /** Text a field shows while its check runs. */
  checking: "Checking...",
  submit: { idle: "Sign up", busy: "Signing up..." },
  sources: { server: fakeServer },
  definition: {
    schema: SignUp,
    defaultValues: { username: "" },
    validate: {
      fields: {
        username: async (name: string) => ((await fakeServer.check(name)) ? { message: "That name is taken." } : undefined),
      },
    },
    onSubmit: (value: v.InferOutput<typeof SignUp>) => `Signed up ${value.username}.`,
  },
};
