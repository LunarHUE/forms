import type { Attachment, Part, PluginHooks, WriteCause } from "../plugin.js";
import type { Path } from "../path.js";
import type { StoreCore } from "./core.js";
import { freeze } from "./freeze.js";
import { related, setAt, valueAt } from "./tree.js";

/** One set of hooks at a path, as the host keeps it. */
export interface Placed {
  readonly path: Path;
  /** The part, or undefined for setup's hooks. */
  readonly part: Part | undefined;
  readonly hooks: PluginHooks<unknown>;
}

/** What the host lends the parts code. */
export interface PartsHost<At extends Placed> {
  readonly raw: StoreCore<unknown, unknown>;
  /** Every set of hooks, in hook order. */
  readonly attached: readonly At[];
  /** Adds the hooks the part's plugin makes at `path`. Throws `plugins:missing` when the store has no such plugin. */
  add(path: Path, part: Part): void;
  /** Runs `fn` as a hook, then ends a batch whose writes leave no records. */
  quietly(fn: () => void): void;
  /** True while the store has listeners. */
  listened(): boolean;
  /** Runs `fn` for `at` once the round of hooks ends. */
  later(at: At, fn: () => void): void;
  /** Runs the `beforeWrite` of `at`. A throw is reported and gives `fallback`. */
  run(at: At, write: Parameters<NonNullable<PluginHooks["beforeWrite"]>>[0], fallback: unknown): unknown;
  /** What `beforeWrite` returns to stop a write. */
  readonly refuse: symbol;
}

/** The parts code the host calls. Only plugins with `attach` bring it. */
export interface PartsKit<At extends Placed> {
  /** Attaches `parts` at `base`. See `attach`. */
  attach(base: Path, parts: readonly Part[], now?: boolean): void;
  /** Forgets that `at` attached, after its field went away. */
  forget(at: At): void;
  /**
   * Runs the `beforeWrite` of `at`, whose path is below `path`, on the part
   * of the write at its path. Returns the write's new value, or `refuse`.
   */
  down(at: At, path: Path, input: unknown, value: unknown, before: unknown, cause: WriteCause): unknown;
  /** Shows the display of `at` when it is the first at its path. */
  arrive(at: At): void;
  /** What `ctx.attachments(path)` returns. */
  list(path: Path): readonly Attachment[];
}

/** Makes the parts code of one store's host. */
export type CreateParts = <At extends Placed>(host: PartsHost<At>) => PartsKit<At>;

/**
 * The parts code: attaching, writes walked down to a part, and display. In
 * a module of its own so plugins with only `setup` don't bring it.
 */
const keyOf = (path: Path) => JSON.stringify(path);

export const createParts: CreateParts = (host) => {
  const { raw, attached } = host;
  // The paths each part is attached at, so attaching twice does nothing. A
  // pinned copy counts as the part it copies.
  const done = new Map<Part, Set<string>>();

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

  const attachAll = (base: Path, parts: readonly Part[]) => {
    const name = raw.getSnapshot(base).name;
    for (const part of parts) {
      const path = part.path === undefined ? base : raw.pathOf(name ? `${name}.${part.path}` : part.path);
      if (!path) continue;
      const origin = part["~of"] ?? part;
      let seen = done.get(origin);
      if (!seen) done.set(origin, (seen = new Set()));
      if (seen.has(keyOf(path))) continue;
      seen.add(keyOf(path));
      host.add(path, part);
    }
  };

  return {
    attach(base, parts, now) {
      const run = () => host.quietly(() => attachAll(base, parts));
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
    forget({ part, path }) {
      if (part) done.get(part["~of"] ?? part)?.delete(keyOf(path));
    },
    down(at, path, input, value, before, cause) {
      const steps = stepsDown(path, at.path);
      if (!steps) return value;
      const was = valueAt(value, steps);
      const write = freeze({ path: at.path, input: valueAt(input, steps), value: was, before: valueAt(before, steps), cause });
      const next = host.run(at, write, was);
      if (next === host.refuse) return next;
      return Object.is(next, was) ? value : setAt(value, steps, next);
    },
    arrive(at) {
      const { hooks } = at;
      // The first display at the path in hook order is the one shown.
      if (!hooks.display || attached.find((other) => other.hooks.display && keyOf(other.path) === keyOf(at.path)) !== at) return;
      // The hooks are closures from `attach`, so they don't need `this`.
      // oxlint-disable-next-line typescript/unbound-method
      const shown = freeze({ display: hooks.display, edit: hooks.edit });
      host.later(at, () => raw.setMeta("~display", shown, at.path));
    },
    list: (path) =>
      attached
        .filter((other) => other.part && related(other.path, path) && other.path.length <= path.length)
        .map((other) => ({ name: other.part!.plugin, path: other.path })),
  };
};
