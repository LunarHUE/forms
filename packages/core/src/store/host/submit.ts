import { type HostPart, refuse } from "../plugins.js";

/** The part behind `onSubmit` and `onSubmitted`. */
export const submit: HostPart = (host) => {
  host.submitting = (settled) => {
    let refused = false;
    const work = [settled];
    for (const entry of host.entries) {
      // A refusal returned at once stops the plugins after it.
      if (refused) break;
      const out = host.call(entry, () => entry.hooks.onSubmit?.(), undefined);
      refused = out === refuse;
      // A rejection is reported like a throw, and the submit goes on.
      work.push(
        Promise.resolve(out).then(
          (value) => {
            if (value === refuse) refused = true;
          },
          (error: unknown) => host.report(error, entry.plugin.name),
        ),
      );
    }
    return Promise.all(work).then(() => refused);
  };
  host.submitted = (submission) => {
    for (const entry of host.entries) host.call(entry, () => entry.hooks.onSubmitted?.(submission), undefined);
  };
};
