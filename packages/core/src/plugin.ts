import type { Path } from "./path.js";
import type { SchemaAdapter } from "./schema-adapter.js";
import type { Submission } from "./snapshot.js";
import type { AnyFormStore } from "./store.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { CreateDirty } from "./store/dirty.js";
import type { CreateHost } from "./store/plugins.js";
import type { CreateParts } from "./store/parts.js";
import type { CreateTiming } from "./store/timing.js";

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

/** When `onWrite` runs. See `PluginHooks.when`. Internal. */
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
 * a fresh server copy. Paths are stable paths. The baseline is there with or
 * without `dirty()`.
 */
export interface PluginBaseline {
  /** The baseline at `path`, or undefined when `path` names no live field. */
  read(this: void, path: Path): BaselineAt | undefined;
  /**
   * True when `a` equals `b` at `path` by the form's dirty comparison,
   * `equals` included. Without `dirty()` there is no comparison, and only
   * the same value, by `Object.is`, is equal.
   */
  equals(this: void, path: Path, a: unknown, b: unknown): boolean;
  /**
   * Makes `value` the baseline of the subtree at `path`, then rechecks
   * dirty. Each array in it pairs its items with the current items by
   * index, unless `keep` says otherwise for the array's stable path. When
   * it returns true the array keeps the pairing the old baseline had. When
   * it returns a key list, baseline item `i` pairs with the current item
   * whose key is at index `i`, as `BaselineAt.keys` reads, so a key no
   * current item has leaves that baseline item unpaired. It writes no
   * value, so to change values too, call it inside `ctx.write` with the
   * writes.
   */
  move(this: void, path: Path, value: unknown, keep?: (path: Path) => boolean | readonly (string | undefined)[]): void;
}

/**
 * What a plugin's `setup` and `attach` get. Each call gets its own: `setup`
 * once per store, `attach` once per path it attaches at. `M` is the
 * plugin's meta on a field and `F` its meta on the form, `never` when it
 * keeps none. `Q` is the plugins its `requires` names. Annotate the
 * parameter to set `M` and `F`: `setup(ctx: PluginContext<{ hidden: boolean }>)`.
 */
export interface PluginContext<M = never, F = never, Q extends Plugins = readonly []> {
  /** The store the plugin is installed on. */
  readonly store: AnyFormStore<unknown>;
  /** The stable path the hooks attach at. `[]` in `setup`. */
  readonly path: Path;
  /** The APIs of the plugins `requires` names, by name. Their setup has run. */
  readonly plugins: PluginApis<Q>;
  /** Every plugin on the store, in the order their hooks run. */
  readonly installed: readonly AnyPlugin[];
  /**
   * The plugins attached at `path` and above it, in the order their hooks
   * run, with the path each attached at. Setup's hooks aren't listed.
   */
  attachments(this: void, path: Path): readonly Attachment[];
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
   * `"reset"`. Inside a hook, setup and attach included, it is queued and
   * runs once every plugin in the round has run, before listeners. Outside
   * a hook it runs now, in a batch. Writing to the store any other way from
   * inside a hook throws.
   */
  write(this: void, fn: () => void, cause?: "rebase"): void;
  /** Delivers waiting `deferred` and `idle` records now. */
  flush(this: void): void;
  /** Reads and moves the form's baseline. */
  readonly baseline: PluginBaseline;
}

/** One plugin attached at a path, as `ctx.attachments` lists it. */
export interface Attachment {
  readonly name: string;
  readonly path: Path;
}

/** What `setup` returns. Every hook is optional. */
export interface PluginHooks<A = undefined> {
  /**
   * Runs before each value write, in plugin order. Return the value to
   * write, or `refuse` from `@lunarhue/forms-core/plugins` to stop the
   * write. Writes from reset, rebase and plugins come through too, and
   * `write.cause` tells them apart. Hooks from `setup` get every write as
   * it is. Hooks from `attach` get only the writes that reach their path: a
   * write at or above it arrives walked down to it, with `path` the
   * attached path, and a write below it arrives as it is. A row that `push`
   * or `insert` adds comes through as a write at the row's path, with
   * `before` undefined. The row is already in
   * the array then, since its key is made by the insert. Return a
   * replacement row, or `refuse` to take the row out again. The array then
   * holds the items it had, though its listeners run once.
   */
  beforeWrite?(write: Write): unknown;
  /**
   * Gets committed writes at the time `when` names. Hooks from `attach` get
   * only the records at, above or below their path.
   */
  onWrite?(records: readonly WriteRecord[]): void;
  /**
   * When `onWrite` runs. Defaults to `"sync"`.
   * - `"sync"`: once at the end of the outermost batch, before listeners
   *   run, with that batch's records.
   * - `"deferred"`: once per task, on a microtask, with every record since
   *   the last delivery.
   * - `"idle"`: after paint, on a background task, with every record since
   *   the last delivery.
   */
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
  /**
   * Runs once a submit has ended, with how it ended. `input` is the form
   * value the definition's `onSubmit` got as `ctx.input`, read once
   * validation finished, so it holds edits made while validation ran. It is
   * there when the submit ended `"succeeded"` or `"failed"`, and undefined
   * when it ended `"invalid"`. A submit that a reset aborts doesn't end
   * here.
   */
  onSubmitted?(submission: Submission<unknown>, input: unknown): void;
  /**
   * Runs when the store gets its first listener, as when a component mounts
   * a field. The function it returns runs when the last listener goes. Use
   * it to listen to something outside the form, so a store nobody reads,
   * such as one a render made and threw away, holds no outside listener.
   */
  onActive?(): (() => void) | undefined;
  /**
   * Cleans the value at the hook's path when the hooks attach, and returns
   * the value to keep. From `setup` it gets the form's starting value. A
   * value it changes is written with no record, and the baseline moves with
   * it while the field isn't dirty, so a cleaned starting value doesn't make
   * the field dirty.
   */
  initial?(value: unknown): unknown;
  /**
   * The text a text input shows for the field's value, as `(555) 123-4567`
   * for `5551234567`. A pure function of the value. The adapters' text
   * pieces and props show it in place of the value. When several plugins
   * attached at one field give it, the first in hook order wins.
   */
  display?(value: unknown): string;
  /**
   * Runs after each edit in a text input that shows `display`, once the
   * typed text went to the store. `input` still holds the typed text and
   * its caret, `value` is the field's value now and `event` is the input
   * event. Put the display text in `input` and place the caret, as
   * `replaceText` from `@lunarhue/forms-core/plugins` does. Without it the
   * framework puts the text in and the caret lands where the browser leaves
   * it.
   */
  edit?(input: TextControl, value: unknown, event: object): void;
  /** The plugin's own API, from `setup` only. The form has it as `form.plugins[name]`, and so does the store. */
  readonly api?: A;
}

/** The parts of a text input or textarea that a display's `edit` changes. Every `HTMLInputElement` and `HTMLTextAreaElement` fits. */
export interface TextControl {
  value: string;
  readonly selectionStart: number | null;
  setSelectionRange(start: number, end: number): void;
}

/** Anything with plugin meta: a field or form snapshot, or an adapter's field object. */
export interface MetaHolder {
  readonly meta?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * What every plugin has. `Plugin` adds the meta readers. Every member but
 * `name` is optional, and the store runs what is there. Internal.
 */
export interface PluginMembers<A, N extends string, M, F, S extends StandardSchemaV1, Q extends Plugins = readonly []> {
  /** Unique among a store's plugins that have hooks. It names the meta slot, the write cause, the API's key and the plugin a part attaches. */
  readonly name: N;
  /** The plugins this one runs after, by name. A name that isn't installed is ignored. */
  readonly after?: readonly string[];
  /**
   * The plugins this one needs, as their factories, such as
   * `() => [dirty, rebase]`, or as plugins. It is called when a store is
   * made. Each must be in the form's plugins too: this doesn't install
   * them. A form without one is a type error, and without types the store
   * throws `plugins:missing`. The plugin runs after them, and its context's
   * `plugins` holds their APIs. A factory is called with no arguments to
   * read its name.
   */
  readonly requires?: () => Requirements;
  /** Type information only: the plugins `requires` names. */
  readonly "~requires"?: Q;
  /**
   * Runs once per store, when the store is made, and returns the plugin's
   * hooks. What it writes is part of the store's starting state: the server
   * snapshot shows it and no plugin gets a record of it. It runs on the
   * server too, so it must not read the browser. Do that in `onActive`.
   */
  setup?(ctx: PluginContext<M, F, Q>): PluginHooks<A>;
  /**
   * Runs once for each path a part of this plugin attaches at, with the
   * part's config, and returns the hooks for that path. `ctx.path` is the
   * path. A part attaches when a field type or fieldset that carries it
   * renders, or when the store is made for parts given to `define`. The
   * attachment lasts as long as the path: removing an array item removes
   * the attachments in it. A plugin's part constructor types the config and
   * the values it fits, see `Part`.
   */
  attach?(ctx: PluginContext<M, F, Q>, config: never): PluginHooks<never>;
  /**
   * A schema adapter, which gives the default values of its library's
   * schemas of type `S`, so their forms need no `defaultValues`. A plugin
   * with one is a schema plugin, such as `zod()`.
   */
  readonly schema?: SchemaAdapter<S>;
  /** Makes the store's plugin host. Internal. */
  readonly "~host"?: CreateHost;
  /** Makes the host's `deferred` and `idle` timings. Internal. */
  readonly "~timing"?: CreateTiming;
  /** Attaches parts and runs the hooks they make. Internal. */
  readonly "~parts"?: CreateParts;
  /** Dirty tracking, from `dirty()`. Internal. */
  readonly "~dirty"?: CreateDirty;
}

/** The reader of a plugin that keeps meta on fields. */
interface MetaReader<M> {
  /**
   * Reads this plugin's meta from a field snapshot or a field object, as
   * `rules.meta(field).hidden`. Before the plugin sets any it returns the
   * plugin's `initialMeta`.
   */
  meta(source: MetaHolder): M;
}

/** The reader of a plugin that keeps meta on the form. */
interface FormMetaReader<F> {
  /** Reads this plugin's meta from the form snapshot. Before the plugin sets any it returns the plugin's `initialFormMeta`. */
  formMeta(source: MetaHolder): F;
}

/**
 * What goes in a `plugins` list, as `definePlugin` makes it. `A` is its
 * API, `N` its name, `M` its meta on a field, `F` its meta on the form and
 * `S` the schemas its schema adapter takes. A plugin with field meta has a
 * `meta` reader and one with form meta a `formMeta` reader. `never` means
 * it has none of that.
 *
 * A plugin can bring hooks for the whole store (`setup`), hooks for the
 * paths its parts attach at (`attach`), and a schema adapter (`schema`).
 * `Q` is the plugins it requires. Make one with `definePlugin`.
 */
export type Plugin<
  A = undefined,
  N extends string = string,
  M = never,
  F = never,
  S extends StandardSchemaV1 = never,
  Q extends Plugins = readonly [],
> = PluginMembers<A, N, M, F, S, Q> &
  ([M] extends [never] ? unknown : MetaReader<M>) &
  ([F] extends [never] ? unknown : FormMetaReader<F>) &
  ([S] extends [never] ? unknown : { readonly schema: SchemaAdapter<S> });

/** A plugin of any kind, API, name and meta. Internal. */
// `any` lets a plugin of every `A`, `M`, `F` and `S` fit, whatever their variance.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyPlugin = PluginMembers<any, string, any, any, any, any>;

/** What `requires` returns: plugin factories that take no arguments, or plugins. */
export type Requirements = readonly (AnyPlugin | (() => AnyPlugin))[];

/** The plugins a `requires` list names: each factory's result, or the plugin. Internal. */
export type RequiredPlugins<R extends Requirements> = { readonly [K in keyof R]: R[K] extends () => infer T ? T : R[K] };

/** A list of plugins, as `createFormsCore({ plugins })` takes it. */
export type Plugins = readonly AnyPlugin[];

/**
 * Plugins that fit a form of value type `V`. A plugin that names the value
 * type it works on says through `"~value"` how it must match `V`: `bind`
 * must name `V` itself. Every other plugin fits.
 */
export type PluginsFor<V> = readonly (AnyPlugin & { readonly "~value"?: (value: V) => V })[];

/**
 * The names of the plugins in `P`, as a union. A plugin whose name is a
 * plain `string`, not a literal, adds nothing.
 */
export type PluginNames<P extends Plugins> = P[number] extends infer T
  ? T extends { readonly name: infer N extends string }
    ? string extends N
      ? never
      : N
    : never
  : never;

/** The schema types the schema plugins in `P` accept. Internal. */
export type PluginSchemas<P extends Plugins> =
  P[number] extends infer T ? (T extends { readonly schema?: SchemaAdapter<infer S> } ? S : never) : never;

/** True when a schema plugin in `P` accepts schema type `S`. Internal. */
export type HasSchemaPlugin<S, P extends Plugins> = [S] extends [never]
  ? false
  : [S] extends [PluginSchemas<P>]
    ? true
    : false;

/** The name `T` has on `form.plugins`: its name when it has an API, else never. */
type ApiName<T> =
  // oxlint-disable-next-line typescript/no-explicit-any
  T extends PluginMembers<infer A, infer N, any, any, any, any> ? ([A] extends [undefined] ? never : N) : never;

/** The API of plugin `T`. */
// oxlint-disable-next-line typescript/no-explicit-any
type ApiOf<T> = T extends PluginMembers<infer A, string, any, any, any, any> ? A : never;

/** The APIs of the plugins in `P` that have one, by plugin name: what `form.plugins` holds. */
export type PluginApis<P extends Plugins> = { readonly [T in P[number] as ApiName<T>]: ApiOf<T> };

/** What `Needs` gives when plugins are missing. Each key names one to add, and `By` what uses it. */
type AddPlugins<N extends string, By extends string> = {
  readonly [K in N as `Add ${K}() to this form's plugins${By extends "" ? "" : `: ${By} uses it`}`]: never;
};

/**
 * `T` when every plugin named in `N` is among `Installed`, the names of a
 * form's plugins (see `PluginNames`). Otherwise a type with one key per
 * missing plugin, such as `"Add dirty() to this form's plugins"`, so a value
 * given for it is a type error that names what to install. `By` names what
 * needs it, as in `"Add mask() to this form's plugins: PhoneField uses it"`.
 * A definition's `equals` is typed `Needs<Installed, "dirty", Equals>`.
 */
export type Needs<Installed extends string, N extends string, T, By extends string = ""> = [Exclude<N, Installed>] extends [never]
  ? T
  : AddPlugins<Exclude<N, Installed>, By>;

/** The names of the plugins the plugins in `P` require. Internal. */
export type RequiredNames<P extends Plugins> = P[number] extends infer T
  ? T extends { readonly "~requires"?: infer Q extends Plugins }
    ? PluginNames<Q>
    : never
  : never;

/**
 * `unknown` when every plugin the plugins in `P` require is among
 * `Installed`. Otherwise a type with one key per missing plugin, such as
 * `"Add dirty() to the plugins: autosave requires it"`, which a plugin list
 * can't have. A list is checked as `P & RequiresMet<P, Installed>`.
 */
export type RequiresMet<P extends Plugins, Installed extends string> = [Exclude<RequiredNames<P>, Installed>] extends [never]
  ? unknown
  : {
      readonly [T in P[number] as T extends { readonly "~requires"?: infer Q extends Plugins }
        ? Exclude<PluginNames<Q>, Installed> extends infer K extends string
          ? [K] extends [never]
            ? never
            : `Add ${K}() to the plugins: ${T["name"]} requires it`
          : never
        : never]: never;
    };

/**
 * A plugin's config for one place: a field type's value, a fieldset, or a
 * form. `N` is the plugin it needs and `V` the value it fits. A part fits
 * a place whose value is assignable to `V`, so `Part<"mask", string>` fits
 * string fields only. A plugin makes its parts with a typed constructor:
 *
 * ```ts
 * export const masked = (config: MaskConfig): Part<"mask", string> => ({ plugin: "mask", config });
 * ```
 *
 * The parts go on a field type (`field(PhoneInput, masked(...))`), a
 * fieldset (`forms.fieldset(Billing, ruled(...))`), or after a definition's
 * config (`define(config, ruled(...))`). The plugin must be in the form's
 * plugins: a part doesn't install it.
 */
export interface Part<N extends string = string, V = never> {
  /** The name of the plugin whose `attach` gets the config. */
  readonly plugin: N;
  /** What the plugin's `attach` gets. */
  readonly config?: unknown;
  /** A dotted name below where the part attaches, for parts pinned at a field, as `fieldset.at("billing")` makes. */
  readonly path?: string;
  /** Type information only: the values the part fits. */
  readonly "~fits"?: (value: V) => void;
  /** The part this one is a pinned copy of, so the two attach once at a path. Internal. */
  readonly "~of"?: Part;
}

/** One part or a list of them, as `define` takes them after the config. */
export type Parts<N extends string = string, V = never> = Part<N, V> | readonly Part<N, V>[];

/** The plugin names the parts in `P` need. */
export type PartNames<P> = P extends readonly (infer T)[] ? PartNames<T> : P extends Part<infer N> ? N : never;

/** The value type `{ a: { b: V } }` for dotted name `"a.b"`, what a part pinned at that name fits. */
export type Nested<K extends string, V> = K extends `${infer H}.${infer T}` ? { readonly [P in H]: Nested<T, V> } : { readonly [P in K]: V };

/**
 * The members of `T` when plugin `N` is among `Installed`, and none when it
 * isn't. Reading one of them without the plugin is then a type error, and
 * a type with more plugins stays assignable to one with fewer. Internal.
 */
// A conditional type here would make TypeScript measure the types it sits in
// as invariant in `Installed`. Indexing a mapped type keeps them
// contravariant, as the members say they are.
export type Gate<Installed extends string, N extends string, T> = Pick<T, { readonly [K in N]: keyof T }[N & Installed]>;
