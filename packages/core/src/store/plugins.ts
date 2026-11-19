import type {
  AnyPlugin,
  Part,
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
import type { PartsKit } from "./parts.js";
import type { Validation } from "./runner.js";
import { problem } from "../problem.js";
import { freeze } from "./freeze.js";
import { type HostLink, hosts } from "./hosts.js";
import { related } from "./tree.js";

// Core has no DOM types, so this declares the platform global the host uses.
declare const setTimeout: (fn: () => void) => unknown;

/** How many rounds of plugin writes one batch may set off before the host stops them. */
const maxRounds = 10;

/** Returned from `beforeWrite` to stop the write. */
export const refuse: unique symbol = Symbol("refuse");

// The default report: throw on a later task, so the error reaches the page's
// error handler without breaking the write that is running.
const rethrowLater: PluginErrorHandler = (error) => {
  setTimeout(() => {
    throw error;
  });
};

/** Makes the store's plugin host from every plugin the store has. */
export type CreateHost = (raw: StoreCore<unknown, unknown>, plugins: readonly AnyPlugin[], report?: PluginErrorHandler) => PluginHost;

/** The plugin host of one store. Only a store with a plugin that has `setup` or `attach` has one. */
export interface PluginHost extends HostLink {
  /** The value store with its write commands wrapped, for the rest of the form store to use. */
  readonly core: StoreCore<unknown, unknown>;
  /**
   * Runs each plugin's setup, then attaches `parts` at the root. The form
   * store calls it once the store, its baseline and its validation exist.
   * It makes `validation.changed` wait for the end of the batch, so
   * validators rerun once for all its writes. The writes setup and the
   * parts make leave no records and become the starting state.
   */
  start(store: AnyFormStore<unknown>, baseline: Baseline, validation: Pick<Validation<unknown>, "changed">, parts: readonly Part[]): void;
  /** Runs `run`, the reset of the field at `path`, with `cause: "reset"`, then calls `onReset` in the same batch. */
  reset(path: Path, run: () => void): void;
  /**
   * Calls `onSubmit`, and returns a promise that settles once `settled` and
   * every promise `onSubmit` returned have. It resolves true when a plugin
   * returned `refuse`, directly or from its promise.
   */
  submitting(settled: Promise<unknown>): Promise<boolean>;
  /** Calls `onSubmitted` in a batch, so the writes it queues land when it returns. */
  submitted(submission: Submission<unknown>, input: unknown): void;
  /** The `api` each plugin's setup returned, by plugin name. Filled by `start`. */
  readonly apis: Record<string, unknown>;
}

/** One installed plugin with hooks. */
interface Entry {
  readonly plugin: AnyPlugin;
  /** Its place in hook order. */
  readonly rank: number;
  /** The cause its `ctx.write` writes get unless it asks for `"rebase"`. */
  readonly cause: WriteCause;
}

/** One set of hooks at a path: a plugin's setup at the root, or one of its parts. */
interface Attached {
  readonly entry: Entry;
  readonly path: Path;
  /** The part, or undefined for setup's hooks. */
  readonly part: Part | undefined;
  hooks: PluginHooks<unknown>;
  /** The cleanup its `onActive` returned. */
  off?: (() => void) | undefined;
}

/**
 * The plugins in hook order: install order, except that each one comes
 * after the names in its `after` and the plugins its `requires` names. A
 * required plugin that isn't installed throws `plugins:missing`.
 */
function order(plugins: readonly AnyPlugin[]): AnyPlugin[] {
  const byName = new Map<string, AnyPlugin>();
  for (const plugin of plugins) {
    if (byName.has(plugin.name)) {
      if (plugin.setup || plugin.attach) throw new Error(problem("plugins:name", plugin.name));
    } else byName.set(plugin.name, plugin);
  }
  const ordered: AnyPlugin[] = [];
  // False while a plugin's `after` list is being visited, true once the plugin is placed.
  const placed = new Map<AnyPlugin, boolean>();
  const visit = (plugin: AnyPlugin) => {
    const state = placed.get(plugin);
    if (state) return;
    if (state === false) throw new Error(problem("plugins:cycle", plugin.name));
    placed.set(plugin, false);
    const required = (plugin.requires?.() ?? []).map((need) => (typeof need === "function" ? need() : need).name);
    for (const name of required) if (!byName.has(name)) throw new Error(problem("plugins:missing", `${name} ${plugin.name}`));
    for (const name of [...(plugin.after ?? []), ...required]) {
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
 * Makes the host for `plugins`, at least one of which has `setup` or
 * `attach`. It wraps the value store's write commands so each write goes
 * through `beforeWrite` and leaves a record for `onWrite`.
 */
export function createPluginHost(
  raw: StoreCore<unknown, unknown>,
  plugins: readonly AnyPlugin[],
  report: PluginErrorHandler = rethrowLater,
): PluginHost {
  // Every plugin, in hook order, and the ones with hooks by name.
  const installed = order(plugins);
  const entries = new Map<string, Entry>();
  for (const plugin of installed) {
    if (plugin.setup || plugin.attach) entries.set(plugin.name, { plugin, rank: entries.size, cause: freeze({ plugin: plugin.name }) });
  }
  // Every set of hooks, in hook order: by plugin, then by when it attached.
  const attached: Attached[] = [];
  // True when some hooks have `onWrite`. Records are only made then.
  let listening = false;
  // Above 0 while attaching before the store has listeners: those writes leave no records.
  let quiet = 0;
  let cause: WriteCause = "user";
  // Depth of the host's own batches, and of plugin hooks running now.
  let depth = 0;
  let inHook = 0;
  let settling = false;
  // Records of the batch that is open, for the `sync` observers.
  let records: WriteRecord[] = [];
  // Plugin writes and meta waiting for the round to end.
  let queue: (readonly [Attached, () => void, WriteCause])[] = [];
  // Paths that writes other than user edits changed in this batch, and
  // validation's own `changed`, which reruns their validators once the writes end.
  const paths: Path[] = [];
  let changed: ((list: readonly Path[]) => void) | undefined;
  const apis: Record<string, unknown> = {};
  let store: AnyFormStore<unknown>;
  let baseline: PluginBaseline;

  // Runs one of `at`'s hooks. A throw goes to `report`, and `fallback` is returned.
  const call = <T>(at: Attached, fn: () => T, fallback: T): T => {
    inHook++;
    try {
      return fn();
    } catch (error) {
      report(error, at.entry.plugin.name);
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

  // True while `at`'s path names a live field. Hooks at a path that is gone are dropped.
  const live = (at: Attached): boolean => {
    const { part, path } = at;
    if (!part || raw.isLive(path)) return true;
    attached.splice(attached.indexOf(at), 1);
    kit?.forget(at);
    return false;
  };

  const deliver = (observers: readonly Attached[], list: readonly WriteRecord[]) => {
    const frozen = freeze(list);
    for (const at of observers) {
      const mine = at.path.length === 0 ? frozen : frozen.filter((record) => related(record.path, at.path));
      if (mine.length > 0 && live(at)) call(at, () => at.hooks.onWrite?.(mine), undefined);
    }
  };

  // The `deferred` and `idle` timings, from the first plugin that brings
  // them. Writes their observers queued run in a batch of their own.
  const timing = plugins
    .find((plugin) => plugin["~timing"])
    ?.["~timing"]?.<Attached>((observers, list) => {
      deliver(observers, list);
      if (queue.length > 0) batch(() => {});
    });

  // Ends the outermost batch, before listeners run: the `sync` observers get
  // its records, the plugin writes they queued run, and the records of those
  // go round again.
  const settle = () => {
    if (settling) return;
    settling = true;
    try {
      let rounds = 0;
      while (records.length > 0 || queue.length > 0 || paths.length > 0) {
        if (++rounds > maxRounds) {
          const writers = new Set<string>();
          for (const record of records) if (typeof record.cause === "object") writers.add(record.cause.plugin);
          for (const [at] of queue) writers.add(at.entry.plugin.name);
          const names = [...writers].join(", ");
          records = [];
          queue = [];
          report(new Error(problem("plugins:loop", names)), names);
          break;
        }
        if (paths.length > 0) changed?.(paths.splice(0));
        const round = records;
        records = [];
        if (round.length > 0) {
          deliver(
            attached.filter((at) => at.hooks.onWrite && (at.hooks.when ?? "sync") === "sync"),
            round,
          );
          timing?.collect(round);
        }
        const writes = queue;
        queue = [];
        for (const [at, fn, by] of writes) {
          try {
            as(by, fn);
          } catch (error) {
            report(error, at.entry.plugin.name);
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
    if (inHook > 0) throw new Error(problem("plugins:write"));
    return batch(fn);
  };

  const push = (record: WriteRecord) => {
    if (listening && !quiet) records.push(freeze(record));
  };

  const flag =
    (type: "touched" | "disabled" | "readOnly", command: (path: Path, on: boolean) => boolean) => (path: Path, on: boolean) =>
      recorded(() => {
        if (!command(path, on)) return false;
        push({ type, path, before: !on, after: on, cause });
        return true;
      });

  // Listeners on the store. `onActive` runs at the first, and its cleanup after the last.
  let listeners = 0;
  const activate = (at: Attached) => {
    at.off = call(at, () => at.hooks.onActive?.(), undefined);
  };
  const counted =
    <A extends unknown[]>(subscribe: (...args: A) => () => void) =>
    (...args: A) => {
      let off: (() => void) | undefined = subscribe(...args);
      if (listeners++ === 0) {
        attached.forEach(activate);
        if (queue.length > 0) batch(() => {});
      }
      return () => {
        if (!off) return;
        off();
        off = undefined;
        if (--listeners === 0) {
          for (const at of attached) if (at.off) call(at, at.off, undefined);
          // A store with no listeners may never batch again, so writes the cleanups queued run now.
          if (queue.length > 0) batch(() => {});
        }
      };
    };

  const valueOf = (path: Path) => raw.getSnapshot(path).value;
  const keysAt = (path: Path) => raw.getSnapshot(path).keys ?? [];

  /**
   * Runs `input` through each `beforeWrite` that the write at `path`
   * reaches. Hooks at or above `path` get the write as it is. Hooks below it
   * get the part of the value at their path. Returns the value to write, or
   * `refuse`.
   */
  const transform = (path: Path, input: unknown, before: unknown): unknown => {
    let value = input;
    // A copy, as a hook can attach more.
    for (const at of attached.slice()) {
      const { hooks } = at;
      if (!hooks.beforeWrite || !related(at.path, path) || !live(at)) continue;
      if (at.path.length <= path.length) {
        const write = freeze({ path, input, value, before, cause });
        value = call(at, () => hooks.beforeWrite?.(write), value);
      } else if (kit) {
        value = kit.down(at, path, input, value, before, cause);
        if (value === refuse) return refuse;
      }
      if (value === refuse) break;
    }
    return value;
  };

  const core: StoreCore<unknown, unknown> = {
    ...raw,
    batch,
    subscribe: counted(raw.subscribe),
    subscribeForm: counted(raw.subscribeForm),
    set: (path, input) =>
      recorded(() => {
        const before = valueOf(path);
        const value = transform(path, input, before);
        if (value === refuse || !raw.set(path, value)) return false;
        push({ type: "value", path, before, after: value, cause });
        return true;
      }),
    // The row's key exists only once it is in, so `beforeWrite` sees the row
    // after the insert, as a write at the row's path. A refused row comes out again.
    insert: (path, index, input) =>
      recorded(() => {
        const before = valueOf(path);
        let key = raw.insert(path, index, input);
        let item = input;
        if (key !== undefined) {
          const row = [...path, key];
          item = transform(row, input, undefined);
          if (item === refuse) {
            raw.remove(path, keysAt(path).indexOf(key));
            key = undefined;
          } else if (!Object.is(item, input)) raw.set(row, item);
        }
        if (key !== undefined)
          push({ type: "insert", path, before, after: valueOf(path), index: keysAt(path).indexOf(key), key, item, cause });
        return key;
      }),
    remove: (path, index) =>
      recorded(() => {
        const before = valueOf(path);
        const key = raw.remove(path, index);
        if (key !== undefined) {
          const item: unknown = Array.isArray(before) ? before[index] : undefined;
          push({ type: "remove", path, before, after: valueOf(path), index, key, item, cause });
        }
        return key;
      }),
    move: (path, from, to) =>
      recorded(() => {
        const before = valueOf(path);
        const key = keysAt(path)[from];
        if (!raw.move(path, from, to)) return false;
        const at = key === undefined ? to : keysAt(path).indexOf(key);
        push({ type: "move", path, before, after: valueOf(path), from, to: at, cause });
        return true;
      }),
    setTouched: flag("touched", (path, on) => raw.setTouched(path, on)),
    setDisabled: flag("disabled", (path, on) => raw.setDisabled(path, on)),
    setReadOnly: flag("readOnly", (path, on) => raw.setReadOnly(path, on)),
  };

  const flush = () => timing?.flush();

  // Queued inside a hook, so it waits for the round to end. Run now, in a batch, outside one.
  const later = (at: Attached, fn: () => void, by: WriteCause = at.entry.cause) => {
    if (inHook > 0) queue.push([at, fn, by]);
    else as(by, () => batch(fn));
  };

  const contextFor = (at: Attached): PluginContext => {
    const { name } = at.entry.plugin;
    return {
      store,
      path: at.path,
      plugins: apis,
      installed,
      attachments: (path) => kit?.list(path) ?? [],
      setMeta: (path, value) => later(at, () => raw.setMeta(name, value, path)),
      setFormMeta: (value) => later(at, () => raw.setMeta(name, value)),
      // Any cause but "rebase", as from a caller the types don't check, is the plugin's own.
      write: (fn, asked?: unknown) => later(at, fn, asked === "rebase" ? asked : at.entry.cause),
      flush,
      baseline,
    };
  };

  // Runs what new hooks do when they arrive: clean the value with `initial`,
  // show the display, start `onActive` and join a timing.
  const arrive = (at: Attached) => {
    const { hooks, path } = at;
    if (hooks.api !== undefined && !at.part) apis[at.entry.plugin.name] = hooks.api;
    if (hooks.initial !== undefined) {
      later(at, () => {
        const value = valueOf(path);
        const next = call(at, () => hooks.initial?.(value), value);
        if (Object.is(next, value)) return;
        const base = baseline.read(path);
        // The baseline moves with the value while the field isn't dirty.
        if (base && baseline.equals(path, base.value, value)) baseline.move(path, next);
        raw.set(path, next);
        paths.push(path);
      });
    }
    kit?.arrive(at);
    if (listeners > 0) activate(at);
    if (hooks.onWrite) {
      listening = true;
      const when: When = hooks.when ?? "sync";
      if (when !== "sync") timing?.add(when, at);
    }
  };

  // Adds hooks at their place in hook order, then runs `make` for them.
  const add = (entry: Entry, path: Path, part: Part | undefined, make: (ctx: PluginContext) => PluginHooks<unknown>) => {
    const at: Attached = { entry, path, part, hooks: {} };
    const index = attached.findIndex((other) => other.entry.rank > entry.rank);
    attached.splice(index === -1 ? attached.length : index, 0, at);
    at.hooks = call(at, () => make(contextFor(at)), {});
    arrive(at);
  };

  // Runs `fn` as a hook, so the writes it makes wait until it ends. They
  // land before any observer knows of them, so they leave no records.
  const quietly = (fn: () => void) => {
    inHook++;
    try {
      fn();
    } finally {
      inHook--;
    }
    quiet++;
    try {
      batch(() => {});
    } finally {
      quiet--;
    }
  };

  // The parts code, from the first plugin that brings it, as every plugin with `attach` does.
  const kit: PartsKit<Attached> | undefined = plugins
    .find((plugin) => plugin["~parts"])
    ?.["~parts"]?.<Attached>({
      raw,
      attached,
      add(path, part) {
        const entry = entries.get(part.plugin);
        if (!entry?.plugin.attach) throw new Error(problem("plugins:missing", part.plugin));
        const { plugin } = entry;
        // `attach` takes the config its part constructor typed.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        add(entry, path, part, (ctx) => plugin.attach?.(ctx, part.config as never) ?? {});
      },
      quietly,
      listened: () => listeners > 0,
      later,
      run: (at, write, fallback) => call(at, () => at.hooks.beforeWrite?.(write), fallback),
      refuse,
    });

  const attach = (base: Path, parts: readonly Part[], now?: boolean) => {
    if (kit) kit.attach(base, parts, now);
    else if (parts[0]) throw new Error(problem("plugins:missing", parts[0].plugin));
  };

  // Calls `fn` with the hooks the reset at `path` reaches, each call isolated.
  const each = (fn: (hooks: PluginHooks<unknown>) => void, path: Path = []) => {
    for (const at of attached.slice()) if (related(at.path, path) && live(at)) call(at, () => fn(at.hooks), undefined);
  };

  const host: PluginHost = {
    core,
    start(made, { read, equals, move }, validation, parts) {
      store = made;
      hosts.set(store, host);
      // Every write runs in a batch of the host's, so the paths wait for it to end.
      changed = validation.changed;
      validation.changed = (list) => void paths.push(...list);
      // Only the plugin's part of the baseline.
      baseline = { read, equals, move };
      // Setup's writes wait until every plugin's setup has run. They are the
      // store's starting state, so the server snapshot shows them.
      quietly(() => {
        for (const entry of entries.values()) {
          const { plugin } = entry;
          if (plugin.setup) add(entry, [], undefined, (ctx) => plugin.setup?.(ctx) ?? {});
        }
      });
      attach([], parts, true);
      raw.started();
    },
    attach,
    reset(path, run) {
      as("reset", () =>
        batch(() => {
          run();
          each((hooks) => hooks.onReset?.(path), path);
        }),
      );
    },
    submitting(settled) {
      let refused = false;
      const work = [settled];
      for (const at of attached) {
        // A refusal returned at once stops the plugins after it.
        if (refused) break;
        const out = call(at, () => at.hooks.onSubmit?.(), undefined);
        refused = out === refuse;
        // A rejection is reported like a throw, and the submit goes on.
        work.push(
          Promise.resolve(out).then(
            (value) => {
              if (value === refuse) refused = true;
            },
            (error: unknown) => report(error, at.entry.plugin.name),
          ),
        );
      }
      return Promise.all(work).then(() => refused);
    },
    submitted(submission, input) {
      batch(() => each((hooks) => hooks.onSubmitted?.(submission, input)));
    },
    flush,
    apis,
  };
  return host;
}
