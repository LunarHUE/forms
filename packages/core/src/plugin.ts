import type { FieldMeta, FormMeta } from "./index.js";
import type { Path } from "./path.js";
import type { Submission } from "./snapshot.js";
import type { AnyFormStore } from "./store.js";
import type { CreateHost } from "./store/plugins.js";

/**
 * What made a write. `"user"` is a write from outside any plugin, `"reset"`
 * and `"rebase"` are writes those commands made, and `{ plugin }` is a write
 * a plugin made through `ctx.write`.
 */
export type WriteCause = "user" | "reset" | "rebase" | { readonly plugin: string };

/** The members every `WriteRecord` has. */
interface RecordBase {
  /** The stable path written. For an array command, the array's path. */
  readonly path: Path;
  readonly cause: WriteCause;
}

/** A value write. */
interface ValueRecord extends RecordBase {
  readonly type: "value";
  readonly before: unknown;
  readonly after: unknown;
}

/** An item added to an array or taken out of one. */
interface ItemRecord extends RecordBase {
  readonly type: "insert" | "remove";
  /** The array before the write. */
  readonly before: unknown;
  /** The array after the write. */
  readonly after: unknown;
  /** Where the item went in, or where it was before it went. */
  readonly index: number;
  /** The item's stable key. */
  readonly key: string;
  readonly item: unknown;
}

/** An item moved within its array. */
interface MoveRecord extends RecordBase {
  readonly type: "move";
  readonly before: unknown;
  readonly after: unknown;
  readonly from: number;
  /** Where the item ended up, after clamping. */
  readonly to: number;
}

/** A change to a field's own touched, disabled or read-only flag. */
interface FlagRecord extends RecordBase {
  readonly type: "touched" | "disabled" | "readOnly";
  readonly before: boolean;
  readonly after: boolean;
}

/**
 * One committed write. Records are frozen in development and never change,
 * so a plugin reading one sees the write as it happened, whatever other
 * plugins did since.
 */
export type WriteRecord = ValueRecord | ItemRecord | MoveRecord | FlagRecord;

/** A value write about to happen, as `beforeWrite` sees it. */
export interface Write {
  readonly path: Path;
  /** What the caller wrote, before any plugin changed it. */
  readonly input: unknown;
  /** The value as the plugins before this one left it. */
  readonly value: unknown;
  /** The value there now. */
  readonly before: unknown;
  readonly cause: WriteCause;
}

/**
 * When `onWrite` runs.
 * - `"sync"`: once at the end of the outermost batch, before listeners run,
 *   with that batch's records.
 * - `"deferred"`: once per task, on a microtask, with every record since the
 *   last delivery.
 * - `"idle"`: after paint, on a background task, with every record since the
 *   last delivery.
 */
export type When = "sync" | "deferred" | "idle";

/** Called when a plugin hook throws, with the plugin's name. The write and the other plugins carry on. */
export type PluginErrorHandler = (error: unknown, plugin: string) => void;

/** The type of slot `N` in meta interface `M`, or unknown when nothing declared it. */
type SlotOf<M, N> = N extends keyof M ? M[N] : unknown;

/** What a plugin's `setup` gets. Each plugin gets its own, once per store. */
export interface PluginContext<N extends string = string> {
  /** The store the plugin is installed on. */
  readonly store: AnyFormStore<unknown>;
  /**
   * Sets this plugin's meta on the field at stable path `path`. Each plugin
   * writes only the slot under its own name. Inside a hook it lands with the
   * queued writes, after every plugin in the round has run.
   */
  setMeta(this: void, path: Path, value: SlotOf<FieldMeta, N>): void;
  /** Sets this plugin's meta on the form. It lands when `setMeta` would. */
  setFormMeta(this: void, value: SlotOf<FormMeta, N>): void;
  /**
   * Runs `fn`, whose store writes get `cause: { plugin: name }`. Inside a
   * hook, setup included, it is queued and runs once every plugin in the
   * round has run, before listeners. Outside a hook it runs now, in a batch.
   * Writing to the store any other way from inside a hook throws.
   */
  write(this: void, fn: () => void): void;
  /** Delivers waiting `deferred` and `idle` records now. */
  flush(this: void): void;
}

/** What `setup` returns. Every hook is optional. */
export interface PluginHooks<A = undefined> {
  /**
   * Runs before each value write, in plugin order. Return the value to
   * write, or `refuse` from `@lunarhue/forms-core/plugins` to stop the
   * write. Writes from reset, rebase and plugins come through too, and
   * `write.cause` tells them apart. Items that `push` and `insert` add don't.
   */
  beforeWrite?(write: Write): unknown;
  /** Gets committed writes at the time `when` names. */
  onWrite?(records: readonly WriteRecord[]): void;
  /** When `onWrite` runs. Defaults to `"sync"`. */
  readonly when?: When;
  /** Runs inside a reset's batch, after the values went back, with the reset field's stable path. */
  onReset?(path: Path): void;
  /**
   * Runs when a submit starts. A returned promise runs alongside validation,
   * and submit waits for both before it reads the schema output. A rejection
   * goes to `onPluginError` and the submit carries on.
   */
  onSubmit?(): unknown;
  /** Runs once a submit has ended, with how it ended. */
  onSubmitted?(submission: Submission<unknown>): void;
  /** What `pluginApi(store, plugin)` returns. */
  readonly api?: A;
}

/** What `definePlugin` takes. */
export interface PluginDefinition<A = undefined, N extends string = string> {
  /** Unique within a store. It names the meta slot and the write cause. */
  readonly name: N;
  /** The plugins this one runs after, by name. A name that isn't installed is ignored. */
  readonly after?: readonly string[];
  /** Runs once per store, when the store is made, and returns the plugin's hooks. */
  setup(ctx: PluginContext<N>): PluginHooks<A>;
}

/**
 * A plugin, as `definePlugin` from `@lunarhue/forms-core/plugins` makes it.
 * Install it with `createFormsCore({ plugins })` or a definition's `plugins`.
 */
export interface Plugin<A = undefined, N extends string = string> extends PluginDefinition<A, N> {
  /**
   * Makes the store's plugin host. It comes with the plugin, so a store
   * without plugins never loads the host's code. Internal.
   */
  readonly host: CreateHost;
}

/** A plugin of any api and name. */
// `any` lets a plugin of every `A` and `N` fit, whatever their variance.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyPlugin = Plugin<any, any>;
