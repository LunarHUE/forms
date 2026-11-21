import type { Path } from "../path.js";
import type { AnyPlugin, Part, PartContext, TextControl, Write, WriteRecord } from "../plugin.js";
import type { Submission } from "../snapshot.js";
import { createParts } from "../store/parts.js";
import { createPluginHost } from "../store/plugins.js";
import type { refuse } from "../store/refuse.js";

/** A write about to happen at a part's path, as a part's `beforeWrite` sees it, with the value typed. */
export interface PartWrite<V> extends Omit<Write, "value" | "before"> {
  /** The value as the hooks before this one left it. */
  readonly value: V;
  /** The value there now. */
  readonly before: V | undefined;
}

/** What a part with hooks of its own gets where it attaches: `PartContext`, with the value typed. */
export interface ValuePartContext<V> extends Omit<PartContext, "value"> {
  /** The value at the part's path now. */
  value(this: void): V;
}

/**
 * The hooks of a part with no plugin, for the value `V` at its path. They
 * work as a plugin's part hooks do. See `PluginHooks` and `PartHooks`.
 */
export interface ValuePartHooks<V> {
  /**
   * Runs before each write that reaches the part's path, and once on the
   * value there when the part attaches, with `cause: "attach"`. Returns the
   * value to write, or `refuse` to stop the write.
   */
  beforeWrite?(write: PartWrite<V>): V | typeof refuse;
  /** The text a text input shows for the value. The first part at a field with `display` wins. */
  display?(value: V): string;
  /** Runs after each edit in a text input that shows `display`. See `PartHooks.afterInput`. */
  afterInput?(input: TextControl, value: V, event: object): void;
  /** Runs after each batch that wrote at, above or below the part's path, before listeners. */
  onWrite?(records: readonly WriteRecord[]): void;
  /** Runs after a reset at, above or below the part's path. */
  onReset?(path: Path): void;
  /** Runs when the store gets its first listener. Return a cleanup for when it loses its last. */
  onActive?(): (() => void) | undefined;
  /** Runs when a submit starts. Return `refuse`, directly or from a promise, to stop it. */
  beforeSubmit?(): unknown;
  /** Runs when a submit ends. */
  onSubmitted?(submission: Submission<unknown>, input: unknown): void;
}

/** A plugin factory whose plugin has a `part` hook, as `part(plugin, config)` takes it. */
export type PartPlugin = ((...options: never[]) => AnyPlugin) & { readonly "~config"?: (config: never) => void };

/** The config `part(plugin, config)` takes for plugin factory `P`: nothing for `void`. */
export type PartConfig<P> = P extends { readonly "~config"?: (config: infer C) => void } ? ([C] extends [void] ? [] : [config: C]) : never;

/**
 * Makes a part. With a plugin factory, it is a part of that plugin, and the
 * plugin's `part` hook gets `config` at each path it attaches at. The
 * plugin must be in the form's plugins. `V` is the value the part fits. It
 * comes from where the part goes, or give it with the plugin's type:
 * `part<typeof limit, string>(limit, 10)`.
 *
 * With hooks, or a function of the part's context that returns them, it is
 * a part of its own, which needs no plugin: `part<string>({ beforeWrite })`.
 * See `transform`, `text` and `observe` for the common ones.
 *
 * Put a part on a field type (`defineField(Input, part)`), a fieldset, or
 * after a definition's config.
 */
export function part<P extends PartPlugin, V = unknown>(plugin: P, ...config: PartConfig<P>): Part<P, V>;
export function part<V>(hooks: ValuePartHooks<V> | ((ctx: ValuePartContext<V>) => ValuePartHooks<V>)): Part<never, V>;
export function part(first: object, config?: unknown): Part {
  // A factory `definePlugin` made has readers. Calling it with no options gives its name, as `requires` does.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if ("meta" in first) return { plugin: (first as () => AnyPlugin)().name, config, "~parts": createParts };
  // The hooks are typed for the part's value, which the part fits.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const hooks = (typeof first === "function" ? first : () => first) as NonNullable<Part["hooks"]>;
  return { hooks, "~parts": createParts, "~host": createPluginHost };
}

/**
 * A part that changes each value written at its path before the store
 * takes it, and the value there when it attaches. `fn` gets the value and
 * the write, and returns the value to keep, or `refuse` to stop the write:
 * `transform<string>((value) => value.trim())`. It needs no plugin.
 */
export const transform = <V>(fn: (value: V, write: PartWrite<V>) => V | typeof refuse): Part<never, V> =>
  part<V>({ beforeWrite: (write) => fn(write.value, write) });

/**
 * A part that sets the text a text input shows for its field: `display`
 * gives the text for the value, and `afterInput` puts it in the input after
 * each edit and places the caret, as `replaceText` does. Without
 * `afterInput` the framework puts the text in. It needs no plugin.
 */
export const text = <V>(display: (value: V) => string, afterInput?: (input: TextControl, value: V, event: object) => void): Part<never, V> =>
  part<V>({ display, ...(afterInput && { afterInput }) });

/**
 * A part that calls `fn` with the value at its path when it attaches, and
 * again after each batch that wrote there, before listeners. Write through
 * `ctx.write`, as in
 * `observe<Post>((post, ctx) => ctx.write(() => ctx.at("slug").setValue(slugify(post.title))))`.
 * It needs no plugin.
 */
export const observe = <V>(fn: (value: V, ctx: ValuePartContext<V>) => void): Part<never, V> =>
  part<V>((ctx) => {
    const run = () => fn(ctx.value(), ctx);
    run();
    return { onWrite: run };
  });
