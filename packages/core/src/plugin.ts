import type { Path } from "./path.js";
import type { SchemaAdapter } from "./schema-adapter.js";
import type { Submission } from "./snapshot.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { AnyFormStore } from "./store.js";
import type { CreateHost } from "./store/plugins.js";
import type { CreateValidation } from "./store/runner.js";

/**
 * What made a write. `"user"` is a write from outside any plugin, `"reset"`
 * is a write reset made, `"rebase"` is a write a plugin made through
 * `ctx.write(fn, "rebase")`, as the `rebase` plugin does, and `{ plugin }`
 * is a write any plugin made through `ctx.write(fn)`.
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

/** The baseline at one path, as `ctx.baseline.read` returns it. */
export interface BaselineAt {
  readonly value: unknown;
  /**
   * For an array, the key of the current item each baseline item pairs
   * with, by index. Undefined for anything else, and for an item no current
   * item pairs with.
   */
  readonly keys: readonly (string | undefined)[] | undefined;
}

/**
 * The form's baseline: the value fields are dirty against and reset goes
 * back to. For plugins that bring in a value from outside the form, such as
 * a fresh server copy. Paths are stable paths.
 */
export interface PluginBaseline {
  /** The baseline at `path`, or undefined when `path` names no live field. */
  read(this: void, path: Path): BaselineAt | undefined;
  /** True when `a` equals `b` at `path` by the form's dirty comparison, `equals` included. */
  equals(this: void, path: Path, a: unknown, b: unknown): boolean;
  /**
   * Makes `value` the baseline of the subtree at `path`, then rechecks
   * dirty. Each array in it pairs its items with the current items by
   * index, except at a path where `keep` returns true: there it keeps the
   * pairing the old baseline had. It writes no value, so to change values
   * too, call it inside `ctx.write` with the writes.
   */
  move(this: void, path: Path, value: unknown, keep?: (path: Path) => boolean): void;
}

/**
 * What a hook plugin's `setup` gets. Each plugin gets its own, once per
 * store. `M` is the plugin's meta on a field and `F` its meta on the form.
 * Annotate `setup`'s parameter to set them:
 * `setup(ctx: PluginContext<{ hidden: boolean }>)`.
 */
export interface PluginContext<M = unknown, F = unknown> {
  /** The store the plugin is installed on. */
  readonly store: AnyFormStore<unknown>;
  /**
   * Sets this plugin's meta on the field at stable path `path`. Each plugin
   * writes only the slot under its own name. Inside a hook it lands with the
   * queued writes, after every plugin in the round has run.
   */
  setMeta(this: void, path: Path, value: M): void;
  /** Sets this plugin's meta on the form. It lands when `setMeta` would. */
  setFormMeta(this: void, value: F): void;
  /**
   * Runs `fn`, whose store writes get `cause: { plugin: name }`. Pass
   * `"rebase"` to give them `cause: "rebase"` instead, for writes that move
   * the form to a value from outside. A plugin can't claim `"user"` or
   * `"reset"`. Inside a hook, setup included, it is queued and runs once
   * every plugin in the round has run, before listeners. Outside a hook it
   * runs now, in a batch. Writing to the store any other way from inside a
   * hook throws.
   */
  write(this: void, fn: () => void, cause?: "rebase"): void;
  /** Delivers waiting `deferred` and `idle` records now. */
  flush(this: void): void;
  /** Reads and moves the form's baseline. */
  readonly baseline: PluginBaseline;
}

/** What `setup` returns. Every hook is optional. */
export interface PluginHooks<A = undefined> {
  /**
   * Runs before each value write, in plugin order. Return the value to
   * write, or `refuse` from `@lunarhue/forms-core/plugins` to stop the
   * write. Writes from reset, rebase and plugins come through too, and
   * `write.cause` tells them apart. A write of an object comes through once,
   * at the object's path, so a plugin that cares about a field below it
   * walks down to it. A row that `push` or `insert` adds comes through as a
   * write at the row's path, with `before` undefined. The row is already in
   * the array then, since its key is made by the insert. Return a
   * replacement row, or `refuse` to take the row out again. The array then
   * holds the items it had, though its listeners run once.
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
   * and submit waits for both before it reads the schema output. A throw or
   * a rejection goes to `onPluginError` and the submit carries on.
   *
   * Return `refuse`, directly or from the promise, to stop the submit. The
   * definition's `onSubmit` isn't called and the submission ends
   * `"invalid"`, as it does when validation fails. Set a form error first,
   * as with `ctx.store.root.setErrors`, so the user sees why. A refusal
   * returned directly stops the plugins after this one from running their
   * `onSubmit`. One returned from a promise can't, since they have run.
   */
  onSubmit?(): unknown;
  /** Runs once a submit has ended, with how it ended. */
  onSubmitted?(submission: Submission<unknown>): void;
  /**
   * Runs when the store gets its first listener, as when a component mounts
   * a field. The function it returns runs when the last listener goes. Use
   * it to listen to something outside the form, so a store nobody reads,
   * such as one a render made and threw away, holds no outside listener.
   */
  onActive?(): (() => void) | undefined;
  /** The plugin's own API. The form has it as `form.plugins[name]`, and so does the store. */
  readonly api?: A;
}

/** What `definePlugin` takes. */
export interface PluginDefinition<A = undefined, N extends string = string, M = unknown, F = unknown> {
  /** Unique among a store's hook plugins. It names the meta slot, the write cause and the API's key. */
  readonly name: N;
  /** The plugins this one runs after, by name. A name that isn't installed is ignored. */
  readonly after?: readonly string[];
  /**
   * Runs once per store, when the store is made, and returns the plugin's
   * hooks. What it writes is part of the store's starting state: the server
   * snapshot shows it and no plugin gets a record of it. It runs on the
   * server too, so it must not read the browser. Do that in `onActive`.
   */
  setup(ctx: PluginContext<M, F>): PluginHooks<A>;
  /** Gives the form's starting value. See `Plugin.initial`. */
  initial?(value: unknown): unknown;
}

/** Anything with plugin meta: a field or form snapshot, or an adapter's field object. */
export interface MetaSource {
  readonly meta?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * What goes in a `plugins` list. A plugin can bring any of three things,
 * and every member but `name` is optional:
 * - hooks into writes, reset and submit, with meta and an API, from
 *   `definePlugin` in `@lunarhue/forms-core/plugins` (see `HookPlugin`);
 * - a schema adapter, which gives its library's schemas default values, so
 *   their forms need no `defaultValues` (see `SchemaPlugin`);
 * - the validation runner, which `validation()` from
 *   `@lunarhue/forms-core/plugins/validation` brings alone and every schema
 *   plugin brings too.
 *
 * The host and the runner come with the plugin, so a store whose plugins
 * bring neither never loads their code.
 */
export interface Plugin<A = undefined, N extends string = string, M = unknown, F = unknown> {
  /** The plugin's name. A hook plugin's must be unique among the store's hook plugins. */
  readonly name: N;
  /** A hook plugin's: the plugins it runs after, by name. */
  readonly after?: readonly string[];
  /** A hook plugin's: runs once per store and returns its hooks. */
  setup?(ctx: PluginContext<M, F>): PluginHooks<A>;
  /**
   * Gives the form's starting value. It runs before the store is made, with
   * the value the store would start from, and returns the value to start
   * from instead, or undefined to keep it. The store, its baseline and its
   * server snapshot all start there, and no write is recorded. When several
   * plugins have it, each gets the value the one before returned, so the
   * last one that returns a value wins.
   */
  initial?(value: unknown): unknown;
  /** A hook plugin's: makes the store's plugin host. Internal. */
  readonly "~host"?: CreateHost;
  /** A hook plugin's: reads its meta from a field. */
  meta?(source: MetaSource): M | undefined;
  /** A hook plugin's: reads its meta from the form snapshot. */
  formMeta?(source: MetaSource): F | undefined;
  /** A schema plugin's: the adapter that gives its schemas' default values. */
  readonly schema?: SchemaAdapter<never>;
  /** The validation runner, from a schema plugin or `validation()`. Internal. */
  readonly validation?: CreateValidation;
}

/**
 * A plugin with hooks, as `definePlugin` makes it. `A` is its API, `N` its
 * name, `M` its meta on a field and `F` its meta on the form.
 */
export interface HookPlugin<A = undefined, N extends string = string, M = unknown, F = unknown> extends Plugin<A, N, M, F> {
  setup(ctx: PluginContext<M, F>): PluginHooks<A>;
  readonly "~host": CreateHost;
  /**
   * Reads this plugin's meta from a field snapshot or a field object, as
   * `rules.meta(field)?.hidden`. Undefined until the plugin sets some there.
   */
  meta(source: MetaSource): M | undefined;
  /** Reads this plugin's meta from the form snapshot. Undefined until the plugin sets some. */
  formMeta(source: MetaSource): F | undefined;
}

/** A plugin that brings a schema adapter for schemas of type `S`, and the validation runner. */
export interface SchemaPlugin<S extends StandardSchemaV1 = StandardSchemaV1, N extends string = string> extends Plugin<undefined, N> {
  readonly schema: SchemaAdapter<S>;
  readonly validation: CreateValidation;
}

/** The plugin `validation()` returns: the validation runner alone. */
export interface ValidationPlugin extends Plugin<undefined, "validation"> {
  readonly validation: CreateValidation;
}

/** A plugin of any kind, API, name and meta. */
// `any` lets a plugin of every `A`, `N`, `M` and `F` fit, whatever their variance.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyPlugin = Plugin<any, any, any, any>;

/**
 * Plugins that fit a form of value type `V`. A plugin that names the value
 * type it works on, as `bind` does, must name `V`. Every other plugin fits.
 */
export type PluginsFor<V> = readonly (AnyPlugin & { readonly "~value"?: (value: V) => V })[];

/** A hook plugin of any API, name and meta. */
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyHookPlugin = HookPlugin<any, any, any, any>;

/** A list of plugins, as `createFormsCore({ plugins })` takes it. */
export type Plugins = readonly AnyPlugin[];

/** True when a plugin in `P` brings the validation runner. */
export type HasValidation<P extends Plugins> = [Extract<P[number], { readonly validation: CreateValidation }>] extends [never]
  ? false
  : true;

/** The schema types the schema plugins in `P` accept. */
export type PluginSchemas<P extends Plugins> =
  P[number] extends infer T ? (T extends { readonly schema: SchemaAdapter<infer S> } ? S : never) : never;

/** True when a schema plugin in `P` accepts schema type `S`. */
export type HasSchemaPlugin<S, P extends Plugins> = [S] extends [never]
  ? false
  : [S] extends [PluginSchemas<P>]
    ? true
    : false;

/** The name `T` has on `form.plugins`: its name when it is a hook plugin with an API, else never. */
type ApiName<T> =
  // oxlint-disable-next-line typescript/no-explicit-any
  T extends HookPlugin<infer A, infer N, any, any> ? ([A] extends [undefined] ? never : N) : never;

/** The API of hook plugin `T`. */
// oxlint-disable-next-line typescript/no-explicit-any
type ApiOf<T> = T extends HookPlugin<infer A, string, any, any> ? A : never;

/** The APIs of the hook plugins in `P` that have one, by plugin name: what `form.plugins` holds. */
export type PluginApis<P extends Plugins> = { readonly [T in P[number] as ApiName<T>]: ApiOf<T> };

/**
 * What `validate` becomes when no plugin brings the validation runner. The
 * compiler names the missing property, which says what to install.
 */
export interface ValidationNotInstalled {
  readonly "Add validation() or a schema plugin such as valibot() to plugins to use validate": never;
}

/**
 * What `schema` becomes when no plugin brings the validation runner, which
 * runs the schema. The compiler names the missing property, which says what
 * to install.
 */
export interface SchemaNeedsValidation {
  readonly "Add validation() or a schema plugin such as valibot() to plugins to use schema": never;
}

/**
 * `T` when a plugin in `P` brings the validation runner. Otherwise `T`
 * marked as needing it, so a value is a type error whose message names what
 * to install, while `undefined`, `null` and `false` in `T` stay allowed. The
 * mark keeps `T` itself, so a validator inside still gets its parameter
 * types and only the missing runner is reported.
 */
export type IfValidation<P extends Plugins, T> =
  HasValidation<P> extends true ? T : (NonNullable<T> & ValidationNotInstalled) | Extract<T, undefined | null | false>;
