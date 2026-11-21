import type { FieldDisplay, TextControl } from "../plugin.js";
import { refuse } from "../store/refuse.js";
import type { Part, PartContext, PartWrite } from "./store.js";

/**
 * A part that changes each value written at its path before the store
 * takes it, and the value there when it attaches. `fn` gets the value and
 * the write, and returns the value to keep, or `refuse` to stop the write.
 * The same call as full's `transform`.
 */
export const transform = <V>(fn: (value: V, write: PartWrite<V>) => V | typeof refuse): Part<never, V> => ({
  "~mini": (ctx) => {
    // The hook runs at a path whose value is `V`, which the part's type checks where it attaches.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion, unicorn/consistent-function-scoping
    const hook = (write: PartWrite<unknown>) => fn(write.value as V, write as PartWrite<V>);
    ctx["~field"].writes.push(hook);
    const before = ctx.value();
    const next = hook({ path: ctx.path, input: before, value: before, before, cause: "attach" });
    if (next !== refuse) ctx["~start"](next);
  },
});

/**
 * A part that sets the text a text input shows for its field. `afterInput`
 * runs after each edit, with the input, to put the text in and place the
 * caret. The same call as full's `text`.
 */
export const text = <V>(display: (value: V) => string, afterInput?: (input: TextControl, value: V, event: object) => void): Part<never, V> => ({
  "~mini": (ctx) => {
    // The display runs at a path whose value is `V`, which the part's type checks where it attaches.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    ctx["~field"].text ??= (afterInput ? { display, afterInput } : { display }) as FieldDisplay;
  },
});

/**
 * A part that calls `fn` with the value at its path when it attaches, and
 * again after each write at, above or below it, before listeners. Write
 * through `ctx.write`. The same call as full's `observe`.
 */
export const observe = <V>(fn: (value: V, ctx: PartContext<V>) => void): Part<never, V> => ({
  "~mini": (ctx) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const run = () => fn(ctx.value() as V, ctx as PartContext<V>);
    run();
    ctx["~observe"](run);
  },
});
