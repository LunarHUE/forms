import type { AnyPlugin, AttachedPart, Part, PluginBaseline, PluginContext, WriteCause, WriteRecord } from "../plugin.js";
import { problem } from "../problem.js";
import type { Path } from "../path.js";
import type { StoreCore } from "./core.js";
import { displaySlot } from "./display.js";
import { freeze } from "./freeze.js";
import { reach } from "./handles.js";
import type { AnyHooks } from "./plugins.js";
import { refuse } from "./refuse.js";
import { related, setAt, valueAt } from "./tree.js";

// Core has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** One set of hooks at a path, as the host keeps it. */
export interface Placed {
  readonly entry: PlacedEntry;
  readonly path: Path;
  /** The part, or undefined for setup's hooks. */
  readonly part: Part | undefined;
  readonly hooks: AnyHooks;
}

/** The plugin a set of hooks belongs to, its place in hook order and the cause of its writes. */
export interface PlacedEntry {
  readonly plugin: AnyPlugin;
  readonly rank: number;
  readonly cause: WriteCause;
}

/** What the host lends the parts code. */
export interface PartsHost<At extends Placed> {
  readonly raw: StoreCore<unknown, unknown>;
  /** Every set of hooks, in hook order. */
  readonly attached: At[];
  readonly baseline: PluginBaseline;
  /** Paths whose validators rerun once the batch ends. */
  readonly paths: Path[];
  /** The installed plugins with hooks, by name. */
  readonly entries: ReadonlyMap<string, At["entry"]>;
  /** Adds the hooks `make` returns at `path`, at their place in hook order, and runs what they do when they arrive. */
  add(entry: At["entry"], path: Path, part: Part, make: (ctx: PluginContext) => AnyHooks): void;
  /** Runs `fn` as a hook, then ends a batch whose writes leave no records. */
  quietly(fn: () => void): void;
  /** True while the store has listeners. */
  listened(): boolean;
  /** Runs `fn` for `at` once the round of hooks ends. */
  later(at: At, fn: () => void): void;
  /** Runs one of `at`'s hooks. A throw is reported and gives `fallback`. */
  call<T>(at: At, fn: () => T, fallback: T): T;
}

/**
 * The parts code the host calls. Only plugins with `part` bring it. Without
 * it every set of hooks is setup's, at the root, so the host needs none of this.
 */
export interface PartsKit<At extends Placed> {
  /** Attaches `parts` at `base`. See `attach`. */
  attach(base: Path, parts: readonly Part[], now?: boolean): void;
  /**
   * False when `at`'s field is gone, and drops its hooks then. With `path`,
   * false too when a write, reset or submit there doesn't reach `at`: when
   * neither path starts with the other.
   */
  live(at: At, path?: Path): boolean;
  /** The records `at` gets: those at, above or below its path. */
  records(at: At, list: readonly WriteRecord[]): readonly WriteRecord[];
  /**
   * Runs the `beforeWrite` of `at`, whose path is below `path`, on the part
   * of the write at its path. Returns the write's new value, or `refuse`.
   */
  down(at: At, path: Path, input: unknown, value: unknown, was: unknown, cause: WriteCause): unknown;
  /** Runs what new hooks of a part do when they arrive: `beforeWrite` on the value there, and `display`. */
  arrive(at: At): void;
  /** The parts attached at `path` and above, in hook order, for `ctx.parts`. */
  list(path: Path): readonly AttachedPart[];
}

/** Makes the parts code of one store's host. */
export type CreateParts = <At extends Placed>(host: PartsHost<At>) => PartsKit<At>;

const keyOf = (path: Path) => JSON.stringify(path);

/** The name parts with hooks of their own go by, in `ctx.parts`, errors and their write cause. */
const own = "part";

/**
 * The parts code: attaching, writes walked down to a part, starting values
 * and display. Every part brings it, so a form whose plugins have only
 * `setup` doesn't.
 */
export const createParts: CreateParts = (host) => {
  const { raw, attached, baseline } = host;
  // Parts with hooks of their own run after every plugin's, in the order they attach.
  const loose = { plugin: { name: own }, rank: Infinity, cause: freeze({ plugin: own }) };
  // The paths each part is attached at, so attaching twice does nothing. A
  // pinned copy counts as the part it copies.
  const done = new Map<Part, Set<string>>();

  // Adds the hooks the part, or its plugin, makes at `path`.
  const add = (path: Path, part: Part) => {
    const { hooks, plugin: name = own } = part;
    const found = host.entries.get(name);
    const entry = hooks ? loose : found;
    const make = hooks ?? found?.plugin.part;
    if (!entry || !make) {
      // The types catch a missing plugin, so production skips the part.
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") throw new Error(problem("plugins:missing", name));
      return;
    }
    const value = () => raw.getSnapshot(path).value;
    host.add(entry, path, part, (ctx) => {
      const at = (dotted: string) => reach(ctx.store, [...path, ...dotted.split(".")]);
      // A plugin's `part` takes the config `part(plugin, config)` typed.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return make({ ...ctx, value, at }, part.config as never) ?? {};
    });
  };

  /**
   * The value path from `path` down to `below`, a path under it, with each
   * array item's key turned into the index it has now. Undefined when
   * `below` names no field or an item that isn't there.
   */
  const stepsDown = (path: Path, below: Path): Path | undefined => {
    const items = raw.itemSteps(below);
    if (!items) return undefined;
    const steps: (string | number)[] = [];
    for (let i = path.length; i < below.length; i++) {
      const step = items[i] ? (raw.getSnapshot(below.slice(0, i)).keys ?? []).indexOf(String(below[i])) : below[i]!;
      if (step === -1) return undefined;
      steps.push(step);
    }
    return steps;
  };

  return {
    attach(base, parts, now) {
      // Works out the new attachments now, so calling this on every render costs no more than the lookups.
      const fresh: [Path, Part][] = [];
      for (const part of parts) {
        const name = part.path && raw.getSnapshot(base).name;
        const path = part.path === undefined ? base : raw.pathOf(name ? `${name}.${part.path}` : part.path);
        if (!path) continue;
        const origin = part["~of"] ?? part;
        let seen = done.get(origin);
        if (!seen) done.set(origin, (seen = new Set()));
        if (seen.has(keyOf(path))) continue;
        seen.add(keyOf(path));
        fresh.push([path, part]);
      }
      if (fresh.length === 0) return;
      const run = () => host.quietly(() => fresh.forEach(([path, part]) => add(path, part)));
      // Once the store has listeners a framework is rendering it, and a write
      // now would update other components mid-render. The parts attach just
      // after, unless the framework takes writes while it renders.
      if (host.listened() && !now) {
        void Promise.resolve().then(run);
        return;
      }
      run();
      // The server renders this starting state too, so hydration starts from it.
      raw.started();
    },
    live(at, reset) {
      const { part, path } = at;
      if (reset && !related(path, reset)) return false;
      if (!part || raw.isLive(path)) return true;
      attached.splice(attached.indexOf(at), 1);
      done.get(part["~of"] ?? part)?.delete(keyOf(path));
      return false;
    },
    records: (at, list) => (at.path.length === 0 ? list : list.filter((record) => related(record.path, at.path))),
    down(at, path, input, value, was, cause) {
      const steps = stepsDown(path, at.path);
      if (!steps) return value;
      const now = valueAt(value, steps);
      const write = freeze({ path: at.path, input: valueAt(input, steps), value: now, before: valueAt(was, steps), cause });
      const next = host.call(at, () => at.hooks.beforeWrite?.(write), now);
      if (next === refuse) return next;
      return Object.is(next, now) ? value : setAt(value, steps, next);
    },
    arrive(at) {
      const { hooks, path } = at;
      if (hooks.beforeWrite) {
        host.later(at, () => {
          const value = raw.getSnapshot(path).value;
          const write = freeze({ path, input: value, value, before: value, cause: "attach" as const });
          const next = host.call(at, () => hooks.beforeWrite?.(write), value);
          if (next === refuse || Object.is(next, value)) return;
          const base = baseline.read(path);
          // The baseline moves with the value while the field isn't dirty.
          if (base && baseline.equals(path, base.value, value)) baseline.move(path, next);
          raw.set(path, next);
          host.paths.push(path);
        });
      }
      // The first display at the path in hook order is the one shown.
      if (!hooks.display || attached.find((other) => other.hooks.display && keyOf(other.path) === keyOf(path)) !== at) return;
      // The hooks are closures from `part`, so they don't need `this`.
      // oxlint-disable-next-line typescript/unbound-method
      const shown = freeze({ display: hooks.display, afterInput: hooks.afterInput });
      host.later(at, () => raw.setMeta(displaySlot, shown, path));
    },
    list: (path) =>
      attached
        .filter((other) => other.part && related(other.path, path) && other.path.length <= path.length)
        .map((other) => ({ name: other.part!.plugin ?? own, path: other.path })),
  };
};
