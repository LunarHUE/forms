import type { Path, PathSegment } from "../path.js";
import { blank, entries, settle, type Snapshot } from "./entries.js";
import { deepFreeze, dev } from "./freeze.js";
import {
  createKeyList,
  indexOfKey,
  initialIndex,
  initialKeys,
  insertKey,
  keysView,
  type KeyList,
  moveKey,
  removeKey,
  resizeKeys,
} from "./keys.js";
import { childOf, isPlainObject, setAt } from "./tree.js";

export type { Snapshot } from "./entries.js";

/** What `createStoreCore` takes. */
export interface StoreCoreOptions {
  /** The store id. */
  readonly id: string;
  /** The starting value. Frozen in development on first use. */
  readonly initial: unknown;
}

/**
 * The value store under a form store: the value tree, item keys, field
 * snapshots and listeners. Every path here is a stable path.
 */
export interface StoreCore {
  /** The store id. */
  readonly id: string;
  /** Calls `listener` after a write that changes the snapshot at `path`. Returns the function that unsubscribes. */
  subscribe(path: Path, listener: () => void): () => void;
  /** The snapshot at `path`, the identical object until one of its members changes. */
  getSnapshot(path: Path): Snapshot;
  /** The snapshot `path` had when the store was created. */
  getServerSnapshot(path: Path): Snapshot;
  /** Runs `fn`, holding listeners until the outermost batch returns. */
  batch<T>(fn: () => T): T;
  /**
   * Writes `value` at `path`. Returns false and does nothing when the value
   * is already there, or when the path is dead, goes through a leaf, or names
   * an item key its array doesn't have.
   */
  set(path: Path, value: unknown): boolean;
  /**
   * Inserts `item` before `index` in the array at `path`, clamping the index.
   * A missing array starts empty. Returns the new item's key, or undefined
   * when nothing was written.
   */
  insert(path: Path, index: number, item: unknown): string | undefined;
  /** Removes the item at `index`. Returns its key, or undefined when nothing was removed. */
  remove(path: Path, index: number): string | undefined;
  /** Moves the item at `from` to `to`, clamping `to`. Returns false when nothing moved. */
  move(path: Path, from: number, to: number): boolean;
  /** How many paths have a node, and how many of those hold subscriber state. For tests and leak checks. */
  stats(): { readonly nodes: number; readonly subscribed: number };
}

interface Subscription {
  readonly listener: () => void;
  /** The snapshot this listener last saw. It isn't called again until the snapshot differs. */
  seen: Snapshot;
  active: boolean;
}

/**
 * One stable path the store knows about. A node exists once something read,
 * subscribed or wrote at its path or below it. Every live node is brought up
 * to date on each write that reaches it, so reads only look nodes up.
 */
interface Node {
  readonly parent: Node | undefined;
  /** The stable segment under the parent, as a string. */
  readonly seg: string;
  value: unknown;
  /** The item's index when the parent is an array that has `seg` as a key, else -1. */
  index: number;
  /** True when the path goes through a leaf or an item key its array doesn't have. Writes here do nothing. */
  blocked: boolean;
  /** True once the item at or above this node was removed. A dead node never changes again. */
  dead: boolean;
  name: string;
  snapshot: Snapshot;
  /** The snapshot from before the first change since listeners last ran. Set only while the node waits to wake them. */
  before: Snapshot | undefined;
  server: Snapshot | undefined;
  /** The item keys, once the value here has been an array. */
  list: KeyList | undefined;
  /** Live child nodes by stable segment. */
  children: Map<string, Node> | undefined;
  /** Dead child nodes by item key, kept so their last snapshot stays readable. */
  removed: Map<string, Node> | undefined;
  subscriptions: Set<Subscription> | undefined;
}

const clamp = (index: number, max: number) => Math.max(0, Math.min(index, max));

/** Makes a value store. It does nothing until something reads, subscribes or writes. */
export function createStoreCore({ id, initial }: StoreCoreOptions): StoreCore {
  let current = initial;
  let root: Node | undefined;
  // How many writes have changed the value. While it is 0 the current snapshot is the server snapshot.
  let writes = 0;
  let batchDepth = 0;
  // Nodes whose snapshot changed and whose listeners haven't run yet.
  const pending = new Set<Node>();

  // Where `node` sits now, from its parent's value and key list.
  const place = (node: Node) => {
    const parent = node.parent;
    if (!parent) {
      node.value = current;
      return;
    }
    node.index = -1;
    node.value = undefined;
    node.blocked = parent.blocked;
    if (parent.blocked) return;
    const holder = parent.value;
    if (Array.isArray(holder)) {
      const index = parent.list ? indexOfKey(parent.list, node.seg) : -1;
      if (index < 0) node.blocked = true;
      else {
        node.index = index;
        node.value = holder[index];
      }
    } else if (isPlainObject(holder)) node.value = childOf(holder, node.seg);
    else if (holder !== undefined && holder !== null) node.blocked = true;
  };

  const nameOf = (node: Node) => {
    const parent = node.parent;
    if (!parent) return "";
    const segment = node.index >= 0 ? String(node.index) : node.seg;
    return parent.name === "" ? segment : `${parent.name}.${segment}`;
  };

  const bury = (node: Node) => {
    node.dead = true;
    if (node.children) for (const child of node.children.values()) bury(child);
  };

  // Moves the child at item key `key` to `removed` and marks its subtree dead.
  // Its snapshots are current as of the last write, so they stay the last ones.
  const kill = (node: Node, key: string) => {
    const child = node.children?.get(key);
    if (!child) return;
    node.children?.delete(key);
    (node.removed ??= new Map()).set(key, child);
    bury(child);
  };

  // Fits the key list to the value. Keys are made here the first time the value is an array.
  const syncKeys = (node: Node) => {
    const length = Array.isArray(node.value) ? node.value.length : 0;
    if (!node.list) {
      if (Array.isArray(node.value)) node.list = createKeyList(length);
      return;
    }
    for (const key of resizeKeys(node.list, length)) kill(node, key);
  };

  // Step 3 adds per-field state to the snapshot here.
  const build = (node: Node) =>
    entries(node.value, node.name, Array.isArray(node.value) && node.list ? keysView(node.list) : undefined);

  const rebuild = (node: Node) => {
    const previous = node.snapshot;
    const next = settle(build(node), previous, node.before);
    if (next === previous) return;
    node.snapshot = next;
    if (node.subscriptions && !pending.has(node)) {
      node.before = previous;
      pending.add(node);
    }
  };

  const createNode = (parent: Node | undefined, seg: string): Node => {
    const node: Node = {
      parent,
      seg,
      value: undefined,
      index: -1,
      blocked: false,
      dead: parent?.dead ?? false,
      name: "",
      snapshot: blank,
      before: undefined,
      server: undefined,
      list: undefined,
      children: undefined,
      removed: undefined,
      subscriptions: undefined,
    };
    place(node);
    node.name = nameOf(node);
    syncKeys(node);
    node.snapshot = settle(build(node), undefined, undefined);
    if (writes === 0) node.server = node.snapshot;
    return node;
  };

  const rootNode = () => {
    if (!root) {
      // The caller's initial value is frozen in development, here on first
      // use rather than at creation, so creating a store changes nothing.
      if (dev) deepFreeze(current);
      root = createNode(undefined, "");
    }
    return root;
  };

  const nodeAt = (path: Path): Node => {
    let node = rootNode();
    for (const segment of path) {
      const seg = String(segment);
      let child = node.children?.get(seg) ?? node.removed?.get(seg);
      if (!child) {
        child = createNode(node, seg);
        (node.children ??= new Map()).set(seg, child);
      }
      node = child;
    }
    return node;
  };

  // Brings `node` and its subtree up to date. A child whose value, index and
  // reach didn't change is skipped with everything below it, so a write only
  // visits nodes it can have changed.
  const update = (node: Node, renamed: boolean) => {
    const { value, index, blocked } = node;
    place(node);
    const moved = renamed || node.index !== index;
    if (!moved && node.blocked === blocked && Object.is(node.value, value)) return;
    if (moved) node.name = nameOf(node);
    syncKeys(node);
    rebuild(node);
    if (node.children) for (const child of node.children.values()) update(child, moved);
  };

  // Updates `node` and its ancestors, root first, without visiting their other children.
  const refreshDown = (node: Node): void => {
    if (node.parent) refreshDown(node.parent);
    place(node);
    syncKeys(node);
    rebuild(node);
  };

  const flush = () => {
    if (pending.size === 0) return;
    const nodes = [...pending];
    pending.clear();
    let failed = false;
    let error: unknown;
    for (const node of nodes) {
      node.before = undefined;
      if (!node.subscriptions) continue;
      // A Set skips entries deleted during the loop. One added during the loop
      // has already seen the current snapshot, so the check below skips it.
      for (const subscription of node.subscriptions) {
        if (!subscription.active || subscription.seen === node.snapshot) continue;
        subscription.seen = node.snapshot;
        try {
          subscription.listener();
        } catch (caught) {
          if (!failed) {
            failed = true;
            error = caught;
          }
        }
      }
    }
    if (failed) throw error;
  };

  // Makes `next` the value, updates the written node's ancestors and subtree,
  // then runs listeners unless a batch is open.
  const commit = (next: unknown, target: Node) => {
    // Written values are frozen in development. This stops at frozen nodes,
    // so it freezes the new copies on the written path and the written value.
    current = dev ? deepFreeze(next) : next;
    writes++;
    if (target.parent) refreshDown(target.parent);
    update(target, false);
    if (batchDepth === 0) flush();
  };

  const valuePathOf = (node: Node): PathSegment[] => {
    const path: PathSegment[] = [];
    for (let n = node; n.parent; n = n.parent) path.unshift(n.index >= 0 ? n.index : n.seg);
    return path;
  };

  const writeAt = (node: Node, value: unknown) => commit(setAt(current, valuePathOf(node), value), node);

  // The array node at `path` when it can take an array write: an array, or missing.
  const arrayAt = (path: Path): { node: Node; items: readonly unknown[] } | undefined => {
    const node = nodeAt(path);
    if (node.dead || node.blocked) return undefined;
    if (Array.isArray(node.value)) return { node, items: node.value };
    if (node.value === undefined || node.value === null) return { node, items: [] };
    return undefined;
  };

  // Where `node` sat in the initial value, using the positional keys every
  // key list starts with.
  const initialPlace = (node: Node): { value: unknown; name: string; blocked: boolean } => {
    if (!node.parent) return { value: initial, name: "", blocked: false };
    const parent = initialPlace(node.parent);
    const join = (segment: string) => (parent.name === "" ? segment : `${parent.name}.${segment}`);
    const holder = parent.value;
    if (parent.blocked) return { value: undefined, name: join(node.seg), blocked: true };
    if (Array.isArray(holder)) {
      const index = initialIndex(node.seg, holder.length);
      if (index < 0) return { value: undefined, name: join(node.seg), blocked: true };
      const item: unknown = holder[index];
      return { value: item, name: join(String(index)), blocked: false };
    }
    if (isPlainObject(holder)) return { value: childOf(holder, node.seg), name: join(node.seg), blocked: false };
    return { value: undefined, name: join(node.seg), blocked: holder !== undefined && holder !== null };
  };

  // The snapshot `node` had at creation, built from the initial value.
  const serverOf = (node: Node): Snapshot => {
    if (node.server) return node.server;
    const { value, name } = initialPlace(node);
    const keys = Array.isArray(value) ? initialKeys(value.length) : undefined;
    node.server = settle(entries(value, name, keys && dev ? Object.freeze(keys) : keys), undefined, undefined);
    return node.server;
  };

  return {
    id,
    subscribe(path, listener) {
      const node = nodeAt(path);
      const subscription: Subscription = { listener, seen: node.snapshot, active: true };
      (node.subscriptions ??= new Set()).add(subscription);
      return () => {
        if (!subscription.active) return;
        subscription.active = false;
        node.subscriptions?.delete(subscription);
        // The set and the pending entry only serve subscribers, so they go with the last one.
        if (node.subscriptions?.size === 0) {
          node.subscriptions = undefined;
          node.before = undefined;
          pending.delete(node);
        }
      };
    },
    getSnapshot: (path) => nodeAt(path).snapshot,
    getServerSnapshot: (path) => serverOf(nodeAt(path)),
    batch(fn) {
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) flush();
      }
    },
    set(path, value) {
      const node = nodeAt(path);
      if (node.dead || node.blocked || Object.is(node.value, value)) return false;
      writeAt(node, value);
      return true;
    },
    insert(path, index, item) {
      const target = arrayAt(path);
      if (!target || !Number.isInteger(index)) return undefined;
      const { node, items } = target;
      const at = clamp(index, items.length);
      const key = insertKey((node.list ??= createKeyList(0)), at);
      writeAt(node, [...items.slice(0, at), item, ...items.slice(at)]);
      return key;
    },
    remove(path, index) {
      const target = arrayAt(path);
      if (!target || !target.node.list || !Number.isInteger(index)) return undefined;
      const { node, items } = target;
      if (index < 0 || index >= items.length) return undefined;
      const key = removeKey(target.node.list, index);
      if (key !== undefined) kill(node, key);
      writeAt(node, [...items.slice(0, index), ...items.slice(index + 1)]);
      return key;
    },
    move(path, from, to) {
      const target = arrayAt(path);
      if (!target || !target.node.list || !Number.isInteger(from) || !Number.isInteger(to)) return false;
      const { node, items } = target;
      if (from < 0 || from >= items.length) return false;
      const at = clamp(to, items.length - 1);
      if (at === from) return false;
      moveKey(target.node.list, from, at);
      const next = [...items];
      next.splice(at, 0, ...next.splice(from, 1));
      writeAt(node, next);
      return true;
    },
    stats() {
      let nodes = 0;
      let subscribed = 0;
      const count = (node: Node) => {
        nodes++;
        if (node.subscriptions) subscribed++;
        if (node.children) for (const child of node.children.values()) count(child);
        if (node.removed) for (const child of node.removed.values()) count(child);
      };
      if (root) count(root);
      return { nodes, subscribed };
    },
  };
}
