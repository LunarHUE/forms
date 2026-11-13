import type {
  AnyHookPlugin,
  PluginBaseline,
  PluginContext,
  PluginErrorHandler,
  PluginHooks,
  When,
  WriteCause,
  WriteRecord,
} from "../plugin.js";
import type { Path } from "../path.js";
import type { Submission } from "../snapshot.js";
import type { AnyFormStore } from "../store.js";
import type { Baseline } from "./baseline.js";
import type { StoreCore } from "./core.js";
import { freeze } from "./freeze.js";

// Core has no DOM or node types, so this declares the platform globals the host uses.
declare const setTimeout: (fn: () => void) => unknown;
declare const scheduler: { postTask?(fn: () => void, options: { readonly priority: string }): unknown } | undefined;
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** How many rounds of plugin writes one batch may set off before the host stops them. */
const maxRounds = 10;

/** What went wrong, as the short code a production build reports. */
type Problem = "name" | "cycle" | "write" | "loop";

/**
 * The error for `problem`. Development gets a sentence, built from `detail`.
 * A bundler replaces the read of NODE_ENV with "production", folds the check
 * to false and drops the sentences, so production gets `plugins:<problem>`.
 */
function failure(problem: Problem, detail: string): Error {
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    const sentences: Record<Problem, string> = {
      name: `Two plugins are named "${detail}".`,
      cycle: `Plugin "${detail}" is part of an \`after\` cycle.`,
      write: "A plugin wrote to the store from inside a hook. Write through `ctx.write`.",
      loop: `Plugins kept answering each other's writes for ${maxRounds} rounds: ${detail}.`,
    };
    return new Error(sentences[problem]);
  }
  return new Error(`plugins:${problem}`);
}

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
  /** Runs each plugin's setup. The form store calls it once the store and its baseline exist. */
  start(store: AnyFormStore<unknown>, baseline: Baseline): void;
  /** Runs `run`, the reset of the field at `path`, with `cause: "reset"`, then calls `onReset` in the same batch. */
  reset(path: Path, run: () => void): void;
  /** Calls `onSubmit`, and returns a promise that settles once `settled` and every promise `onSubmit` returned have. */
  submitting(settled: Promise<void>): Promise<void>;
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
interface Entry {
  readonly plugin: AnyHookPlugin;
  /** The cause its `ctx.write` writes get. */
  readonly cause: WriteCause;
  hooks: PluginHooks<unknown>;
}

/** Records waiting for one timing's observers. */
interface Bucket {
  /** The plugins with `onWrite` at this timing, in run order. */
  readonly observers: Entry[];
  records: WriteRecord[];
  /** True while a task to deliver them is scheduled. */
  due: boolean;
}

/** The plugins in run order: install order, except that each one comes after the names in its `after`. */
function order(plugins: readonly AnyHookPlugin[]): AnyHookPlugin[] {
  const byName = new Map<string, AnyHookPlugin>();
  for (const plugin of plugins) {
    if (byName.has(plugin.name)) throw failure("name", plugin.name);
    byName.set(plugin.name, plugin);
  }
  const ordered: AnyHookPlugin[] = [];
  // False while a plugin's `after` list is being visited, true once the plugin is placed.
  const placed = new Map<AnyHookPlugin, boolean>();
  const visit = (plugin: AnyHookPlugin) => {
    const state = placed.get(plugin);
    if (state) return;
    if (state === false) throw failure("cycle", plugin.name);
    placed.set(plugin, false);
    for (const name of plugin.after ?? []) {
      const before = byName.get(name);
      if (before) visit(before);
    }
    placed.set(plugin, true);
    ordered.push(plugin);
  };
  plugins.forEach(visit);
  return ordered;
}

/**
 * Makes the host for `plugins`, which has at least one plugin. It wraps the
 * value store's write commands so each write goes through `beforeWrite` and
 * leaves a record for `onWrite`.
 */
export function createPluginHost(
  raw: StoreCore<unknown, unknown>,
  plugins: readonly AnyHookPlugin[],
  report: PluginErrorHandler = rethrowLater,
): PluginHost {
  const entries: Entry[] = [];
  // The plugins with `beforeWrite`, in run order.
  let transforms: Entry[] = [];
  // True when some plugin has `onWrite`. Records are only made then.
  let listening = false;
  let cause: WriteCause = "user";
  // Depth of the host's own batches, and of plugin hooks running now.
  let depth = 0;
  let inHook = 0;
  let settling = false;
  // Records of the batch that is open, for the `sync` observers.
  let records: WriteRecord[] = [];
  // Plugin writes and meta waiting for the round to end.
  let queue: (readonly [Entry, () => void])[] = [];
  // The plugins with a `sync` `onWrite`, in run order, and the buckets of the other two timings.
  const sync: Entry[] = [];
  const deferred: Bucket = { observers: [], records: [], due: false };
  const apis: Record<string, unknown> = {};
  const idle: Bucket = { observers: [], records: [], due: false };

  // Runs one of `entry`'s hooks. A throw goes to `report`, and `fallback` is returned.
  const call = <T>(entry: Entry, fn: () => T, fallback: T): T => {
    inHook++;
    try {
      return fn();
    } catch (error) {
      report(error, entry.plugin.name);
      return fallback;
    } finally {
      inHook--;
    }
  };

  const as = <T>(next: WriteCause, fn: () => T): T => {
    const was = cause;
    cause = next;
    try {
      return fn();
    } finally {
      cause = was;
    }
  };

  const deliver = (observers: readonly Entry[], list: readonly WriteRecord[]) => {
    const frozen = freeze(list);
    for (const entry of observers) call(entry, () => entry.hooks.onWrite?.(frozen), undefined);
  };

  // Delivers a bucket's records. Writes its observers queued run in a batch of their own.
  const drain = (bucket: Bucket) => {
    bucket.due = false;
    const list = bucket.records;
    if (list.length === 0) return;
    bucket.records = [];
    deliver(bucket.observers, list);
    if (queue.length > 0) batch(() => {});
  };

  const runDeferred = () => drain(deferred);
  const runIdle = () => drain(idle);

  // Adds a round's records to a bucket and schedules its delivery.
  const collect = (bucket: Bucket, round: readonly WriteRecord[], schedule: () => void) => {
    if (bucket.observers.length === 0) return;
    for (const record of round) bucket.records.push(record);
    if (bucket.due) return;
    bucket.due = true;
    schedule();
  };

  // Ends the outermost batch, before listeners run: the `sync` observers get
  // its records, the plugin writes they queued run, and the records of those
  // go round again.
  const settle = () => {
    if (settling) return;
    settling = true;
    try {
      let rounds = 0;
      while (records.length > 0 || queue.length > 0) {
        if (++rounds > maxRounds) {
          const writers = new Set<string>();
          for (const record of records) if (typeof record.cause === "object") writers.add(record.cause.plugin);
          for (const [entry] of queue) writers.add(entry.plugin.name);
          const names = [...writers].join(", ");
          records = [];
          queue = [];
          report(failure("loop", names), names);
          break;
        }
        const round = records;
        records = [];
        if (round.length > 0) {
          deliver(sync, round);
          collect(deferred, round, () => void Promise.resolve().then(runDeferred));
          collect(idle, round, () => {
            if (typeof scheduler !== "undefined" && scheduler.postTask) scheduler.postTask(runIdle, { priority: "background" });
            else setTimeout(runIdle);
          });
        }
        const writes = queue;
        queue = [];
        for (const [entry, fn] of writes) {
          try {
            as(entry.cause, fn);
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
    if (inHook > 0) throw failure("write", "");
    return batch(fn);
  };

  const push = (record: WriteRecord) => {
    if (listening) records.push(freeze(record));
  };

  const flag =
    (type: "touched" | "disabled" | "readOnly", command: (path: Path, on: boolean) => boolean) => (path: Path, on: boolean) =>
      recorded(() => {
        if (!command(path, on)) return false;
        push({ type, path, before: !on, after: on, cause });
        return true;
      });

  const valueAt = (path: Path) => raw.getSnapshot(path).value;
  const keysAt = (path: Path) => raw.getSnapshot(path).keys ?? [];

  const core: StoreCore<unknown, unknown> = {
    ...raw,
    batch,
    set: (path, input) =>
      recorded(() => {
        const before = valueAt(path);
        let value = input;
        for (const entry of transforms) {
          const write = freeze({ path, input, value, before, cause });
          const next = call(entry, () => entry.hooks.beforeWrite?.(write), value);
          if (next === refuse) return false;
          value = next;
        }
        if (!raw.set(path, value)) return false;
        push({ type: "value", path, before, after: value, cause });
        return true;
      }),
    insert: (path, index, item) =>
      recorded(() => {
        const before = valueAt(path);
        const key = raw.insert(path, index, item);
        if (key !== undefined)
          push({ type: "insert", path, before, after: valueAt(path), index: keysAt(path).indexOf(key), key, item, cause });
        return key;
      }),
    remove: (path, index) =>
      recorded(() => {
        const before = valueAt(path);
        const key = raw.remove(path, index);
        if (key !== undefined) {
          const item: unknown = Array.isArray(before) ? before[index] : undefined;
          push({ type: "remove", path, before, after: valueAt(path), index, key, item, cause });
        }
        return key;
      }),
    move: (path, from, to) =>
      recorded(() => {
        const before = valueAt(path);
        const key = keysAt(path)[from];
        if (!raw.move(path, from, to)) return false;
        const at = key === undefined ? to : keysAt(path).indexOf(key);
        push({ type: "move", path, before, after: valueAt(path), from, to: at, cause });
        return true;
      }),
    setTouched: flag("touched", (path, on) => raw.setTouched(path, on)),
    setDisabled: flag("disabled", (path, on) => raw.setDisabled(path, on)),
    setReadOnly: flag("readOnly", (path, on) => raw.setReadOnly(path, on)),
  };

  const flush = () => {
    runDeferred();
    runIdle();
  };

  const contextFor = (entry: Entry, store: AnyFormStore<unknown>, baseline: PluginBaseline): PluginContext => {
    const { name } = entry.plugin;
    // Inside a hook the write waits for the round to end. Outside one it runs now.
    const write = (fn: () => void) => {
      if (inHook > 0) queue.push([entry, fn]);
      else as(entry.cause, () => batch(fn));
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

  // Calls `fn` with each plugin's hooks, each call isolated. For the rare hooks: reset and submitted.
  const each = (fn: (hooks: PluginHooks<unknown>) => void) => {
    for (const entry of entries) call(entry, () => fn(entry.hooks), undefined);
  };

  const host: PluginHost = {
    core,
    start(store, { read, equals, move }) {
      hosts.set(store, host);
      // Only the plugin's part of the baseline.
      const baseline: PluginBaseline = { read, equals, move };
      // Setup counts as a hook, so writes it makes wait until every plugin's setup has run.
      for (const plugin of order(plugins)) {
        // Rebase is a plugin, but its writes keep the cause they had as a command.
        const { name } = plugin;
        const entry: Entry = { plugin, cause: name === "rebase" ? name : freeze({ plugin: name }), hooks: {} };
        entries.push(entry);
        entry.hooks = call(entry, () => plugin.setup(contextFor(entry, store, baseline)), {});
      }
      transforms = entries.filter((entry) => entry.hooks.beforeWrite !== undefined);
      for (const entry of entries) {
        if (entry.hooks.api !== undefined) apis[entry.plugin.name] = entry.hooks.api;
        if (!entry.hooks.onWrite) continue;
        listening = true;
        const when: When = entry.hooks.when ?? "sync";
        if (when === "sync") sync.push(entry);
        else (when === "deferred" ? deferred : idle).observers.push(entry);
      }
      if (queue.length > 0) batch(() => {});
    },
    reset(path, run) {
      as("reset", () =>
        batch(() => {
          run();
          each((hooks) => hooks.onReset?.(path));
        }),
      );
    },
    submitting(settled) {
      // A rejection is reported like a throw, and the submit goes on.
      const work = entries.map(async (entry) => {
        try {
          await call(entry, () => entry.hooks.onSubmit?.(), undefined);
        } catch (error) {
          report(error, entry.plugin.name);
        }
      });
      return Promise.all([settled, ...work]).then(() => {});
    },
    submitted(submission) {
      each((hooks) => hooks.onSubmitted?.(submission));
    },
    flush,
    apis,
  };
  return host;
}
