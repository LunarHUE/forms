import type { Path } from "../path.js";
import type { Plugin } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import { isPlainObject } from "../store/tree.js";

/** An array's item keys, or an object's own keys. */
type Keys = readonly string[];

/** The children of `value`, an array or a plain object, as stable path segments with their values. */
const children = (value: unknown, keys: Keys): [string, unknown][] =>
  keys.map((key, i) => [key, Array.isArray(value) ? value[i] : isPlainObject(value) ? value[key] : undefined]);

/**
 * Makes the value a successful submit sent the form's baseline, so a form
 * that stays on screen after saving is clean again. Install it beside
 * `dirty()`: `define({ plugins: [baselineOnSubmit()] })`.
 *
 * Only a submit that ends `"succeeded"` moves the baseline. A field edited
 * while the save ran keeps its newer value and stays dirty. An array item
 * inserted, removed or moved meanwhile keeps its own dirty flag, since
 * items pair by the keys they had when the value was sent.
 *
 * Without `dirty()` nothing is dirty, but the baseline still moves, so a
 * later reset goes back to the saved value.
 */
export function baselineOnSubmit(): Plugin<undefined, "baselineOnSubmit"> {
  return defineHooks({
    name: "baselineOnSubmit",
    setup({ store, baseline }) {
      // While a submit runs: each array and object the form held at each
      // stable path, with its keys at the time. The sent value is one of them.
      let seen: Map<string, WeakMap<object, Keys>> | undefined;

      const note = (value: unknown, path: string[]) => {
        if (!seen || !(Array.isArray(value) || isPlainObject(value))) return;
        const id = JSON.stringify(path);
        let at = seen.get(id);
        if (!at) seen.set(id, (at = new WeakMap()));
        // Values are never changed in place, so one seen here before has nothing new below it.
        if (at.has(value)) return;
        const keys = Array.isArray(value) ? (store.getSnapshot(path).keys ?? []) : Object.keys(value);
        at.set(value, keys);
        for (const [key, child] of children(value, keys)) note(child, [...path, key]);
      };

      // The item keys each array of `sent` had when it was sent, by stable path.
      const pairing = (sent: unknown) => {
        const pairs = new Map<string, Keys>();
        const visit = (value: unknown, path: string[]) => {
          if (typeof value !== "object" || value === null) return;
          const id = JSON.stringify(path);
          const keys = seen?.get(id)?.get(value);
          if (!keys) return;
          if (Array.isArray(value)) pairs.set(id, keys);
          for (const [key, child] of children(value, keys)) visit(child, [...path, key]);
        };
        visit(sent, []);
        return (path: Path) => pairs.get(JSON.stringify(path)) ?? false;
      };

      const current = () => store.getSnapshot([]).value;

      return {
        onSubmit() {
          seen = new Map();
          note(current(), []);
        },
        // Validation may still be running, and an edit made now can still be sent.
        onWrite() {
          note(current(), []);
        },
        onReset(path) {
          // A reset of the whole form aborts the submit, which then never ends here.
          if (path.length === 0) seen = undefined;
        },
        onSubmitted(submission, input) {
          if (submission.status === "succeeded") baseline.move([], input, pairing(input));
          seen = undefined;
        },
      };
    },
  });
}
