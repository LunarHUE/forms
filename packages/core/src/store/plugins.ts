import type {
  AnyHookPlugin,
  PluginBaseline,
  PluginContext,
  PluginErrorHandler,
  PluginHooks,
  WriteCause,
  WriteRecord,
} from "../plugin.js";
import type { Path } from "../path.js";
import type { Submission } from "../snapshot.js";
import type { AnyFormStore } from "../store.js";
import type { Baseline } from "./baseline.js";
import type { StoreCore } from "./core.js";
import type { Validation } from "./runner.js";
import { problem } from "../problem.js";
import { freeze } from "./freeze.js";

// Core has no DOM or node types, so this declares the platform globals the host uses.
declare const setTimeout: (fn: () => void) => unknown;

/** How many rounds of plugin writes one batch may set off before the host stops them. */
export const maxRounds = 10;

/** Returned from `beforeWrite` to stop the write. */
export const refuse: unique symbol = Symbol("refuse");

// The default report: throw on a later task, so the error reaches the page's
// error handler without breaking the write that is running.
const rethrowLater: PluginErrorHandler = (error) => {
  setTimeout(() => {
    throw error;
  });
};

/** Makes the plugin host of one store. */
export type CreateHost = (raw: StoreCore<unknown, unknown>, plugins: readonly AnyHookPlugin[], report?: PluginErrorHandler) => PluginHost;

/** The plugin host of one store. Only a store with plugins has one. */
export interface PluginHost {
  /** The value store with its write commands wrapped, for the rest of the form store to use. */
  readonly core: StoreCore<unknown, unknown>;
  /**
   * Runs each plugin's setup. The form store calls it once the store, its
   * baseline and its validation exist. It makes `validation.changed` wait
   * for the end of the batch, so validators rerun once for all its writes.
   * The writes setup makes leave no records and become the starting state.
   */
  start(store: AnyFormStore<unknown>, baseline: Baseline, validation: Pick<Validation<unknown>, "changed">): void;
  /** Runs `run`, the reset of the field at `path`, with `cause: "reset"`, then calls `onReset` in the same batch. */
  reset(path: Path, run: () => void): void;
  /**
   * Calls `onSubmit`, and returns a promise that settles once `settled` and
   * every promise `onSubmit` returned have. It resolves true when a plugin
   * returned `refuse`, directly or from its promise.
   */
  submitting(settled: Promise<unknown>): Promise<boolean>;
  /** Calls `onSubmitted`. */
  submitted(submission: Submission<unknown>): void;
  /** Delivers waiting `deferred` and `idle` records now. */
  flush(): void;
  /** The `api` each plugin's setup returned, by plugin name. Filled by `start`. */
  readonly apis: Record<string, unknown>;
}

/** The host of each store with plugins, for `flushPlugins`. */
export const hosts: WeakMap<object, PluginHost> = new WeakMap();

/** One installed plugin. */
export interface Entry {
  readonly plugin: AnyHookPlugin;
  /** The cause its `ctx.write` writes get unless it asks for `"rebase"`. */
  readonly cause: WriteCause;
  hooks: PluginHooks<unknown>;
  /** The cleanup its `onActive` returned. */
  off?: (() => void) | undefined;
}

/** A plugin write waiting for the round to end, with the plugin and the cause it runs under. */
export type Queued = readonly [Entry, () => void, WriteCause];

/**
 * A host's insides, shared with its parts. The base host runs setup, plugin
 * writes, batches, reset and the API. Each part adds the code behind some
 * hooks and fills the slots below that it needs. A slot left alone does
 * what the store needs when no plugin has those hooks.
 */
export interface Host extends PluginHost {
  /** The value store under the wrapped one. `transforms` puts `beforeWrite` into its `set` and `insert`. */
  raw: StoreCore<unknown, unknown>;
  /** The wrapped value store. A part may replace its write commands and its subscribe functions. */
  readonly core: StoreCore<unknown, unknown>;
  /** The installed plugins in run order. Filled by `start`. */
  readonly entries: Entry[];
  readonly report: PluginErrorHandler;
  /** The cause of the write running now. */
  cause: WriteCause;
  /** Plugin writes and meta waiting for the round to end. */
  queue: Queued[];
  /** Runs one of `entry`'s hooks. A throw goes to `report`, and `fallback` is returned. */
  readonly call: <T>(entry: Entry, fn: () => T, fallback: T) => T;
  /** Runs a write command in a batch of the host's. Throws when a hook writes to the store directly. */
  readonly recorded: <T>(fn: () => T) => T;
  /** Runs the queued writes now, when there are any. */
  readonly drain: () => void;
  /** From `recorder`: true while the batch has records to deliver. */
  more?(): boolean;
  /** From `recorder`: called at the start of each round of the batch's end, with the round's number. True stops the rounds. */
  stop?(rounds: number): boolean;
  /** From `recorder`: delivers the round's records. */
  round?(): void;
  /** From `recorder`: delivers `list` to the `onWrite` of each of `observers`. */
  deliver?(observers: readonly Entry[], list: readonly WriteRecord[]): void;
  /** From `timing`: takes an observer whose `when` isn't `"sync"`. */
  observe?(entry: Entry): void;
  /** From `timing`: takes each round's records, after the `sync` observers had them. */
  collect?(round: readonly WriteRecord[]): void;
  /** From `order`: puts the plugins in run order. Without it they run in install order. */
  order?(plugins: readonly AnyHookPlugin[]): readonly AnyHookPlugin[];
  /** From `recorder`: runs once setup's writes have landed. */
  ready?(): void;
}

/** Adds the code behind some hooks to a host. It runs when the host is made, before any setup. */
export type HostPart = (host: Host) => void;

const no = () => false;
const nothing = () => {};

/**
 * Makes the host for `plugins`, which has at least one plugin, with the
 * parts they bring. It wraps the value store's write commands so each write
 * runs in a batch, which the parts can hook into.
 */
export function createPluginHost(
  raw: StoreCore<unknown, unknown>,
  plugins: readonly AnyHookPlugin[],
  report: PluginErrorHandler = rethrowLater,
): PluginHost {
  // Depth of the host's own batches, and of plugin hooks running now.
  let depth = 0;
  let inHook = 0;
  let settling = false;
  // Paths that writes other than user edits changed in this batch, and
  // validation's own `changed`, which reruns their validators once the writes end.
  const paths: Path[] = [];
  let changed: ((list: readonly Path[]) => void) | undefined;

  const as = <T>(next: WriteCause, fn: () => T): T => {
    const was = host.cause;
    host.cause = next;
    try {
      return fn();
    } finally {
      host.cause = was;
    }
  };

  // Ends the outermost batch, before listeners run: the parts deliver its
  // records, the plugin writes queued run, and their records go round again.
  const settle = () => {
    if (settling) return;
    settling = true;
    try {
      let rounds = 0;
      while (host.queue.length > 0 || paths.length > 0 || host.more?.()) {
        if (host.stop?.(++rounds)) break;
        if (paths.length > 0) changed?.(paths.splice(0));
        host.round?.();
        const writes = host.queue;
        host.queue = [];
        for (const [entry, fn, by] of writes) {
          try {
            as(by, fn);
          } catch (error) {
            report(error, entry.plugin.name);
          }
        }
      }
    } finally {
      settling = false;
    }
  };

  const batch = <T>(fn: () => T): T =>
    raw.batch(() => {
      depth++;
      try {
        return fn();
      } finally {
        if (--depth === 0) settle();
      }
    });

  // Every wrapped write runs in a batch, so its records reach the `sync` observers before listeners run.
  const recorded = <T>(fn: () => T): T => {
    if (inHook > 0) throw new Error(problem("plugins:write", ""));
    return batch(fn);
  };

  const flush = () => host.flush();

  const contextFor = (entry: Entry, store: AnyFormStore<unknown>, baseline: PluginBaseline): PluginContext => {
    const { name } = entry.plugin;
    // Inside a hook the write waits for the round to end. Outside one it runs now.
    // Any cause but "rebase", as from a caller the types don't check, is the plugin's own.
    const write = (fn: () => void, asked?: unknown) => {
      const by = asked === "rebase" ? asked : entry.cause;
      if (inHook > 0) host.queue.push([entry, fn, by]);
      else as(by, () => batch(fn));
    };
    return {
      store,
      setMeta: (path, value) => write(() => raw.setMeta(name, value, path)),
      setFormMeta: (value) => write(() => raw.setMeta(name, value)),
      write,
      flush,
      baseline,
    };
  };

  const host: Host = {
    raw,
    core: {
      ...raw,
      batch,
      set: (path, value) => recorded(() => host.raw.set(path, value)),
      insert: (path, index, item) => recorded(() => host.raw.insert(path, index, item)),
      remove: (path, index) => recorded(() => raw.remove(path, index)),
      move: (path, from, to) => recorded(() => raw.move(path, from, to)),
      setTouched: (path, on) => recorded(() => raw.setTouched(path, on)),
      setDisabled: (path, on) => recorded(() => raw.setDisabled(path, on)),
      setReadOnly: (path, on) => recorded(() => raw.setReadOnly(path, on)),
    },
    entries: [],
    report,
    cause: "user",
    queue: [],
    call: <T>(entry: Entry, fn: () => T, fallback: T): T => {
      inHook++;
      try {
        return fn();
      } catch (error) {
        report(error, entry.plugin.name);
        return fallback;
      } finally {
        inHook--;
      }
    },
    recorded,
    drain: () => {
      if (host.queue.length > 0) batch(nothing);
    },
    start(store, { read, equals, move }, validation) {
      hosts.set(store, host);
      // Every write runs in a batch of the host's, so the paths wait for it to end.
      changed = validation.changed;
      validation.changed = (list) => void paths.push(...list);
      // Only the plugin's part of the baseline.
      const baseline: PluginBaseline = { read, equals, move };
      const names = new Set<string>();
      for (const plugin of plugins) {
        if (names.has(plugin.name)) throw new Error(problem("plugins:name", plugin.name));
        names.add(plugin.name);
      }
      // Setup counts as a hook, so writes it makes wait until every plugin's setup has run.
      for (const plugin of host.order?.(plugins) ?? plugins) {
        const entry: Entry = { plugin, cause: freeze({ plugin: plugin.name }), hooks: {} };
        host.entries.push(entry);
        entry.hooks = host.call(entry, () => plugin.setup(contextFor(entry, store, baseline)), {});
      }
      // Setup's writes land before any observer is known, so they leave no
      // records. They are the store's starting state, so the server snapshot shows them.
      host.drain();
      raw.started();
      for (const entry of host.entries) if (entry.hooks.api !== undefined) host.apis[entry.plugin.name] = entry.hooks.api;
      host.ready?.();
    },
    reset(path, run) {
      as("reset", () =>
        batch(() => {
          run();
          for (const entry of host.entries) host.call(entry, () => entry.hooks.onReset?.(path), undefined);
        }),
      );
    },
    submitting: (settled) => settled.then(no),
    submitted: nothing,
    flush: nothing,
    apis: {},
  };

  // Each part once, however many plugins bring it.
  const parts = new Set<HostPart>();
  for (const plugin of plugins) for (const part of plugin["~parts"]) parts.add(part);
  parts.forEach((part) => part(host));
  return host;
}
