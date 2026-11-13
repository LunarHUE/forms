import type { FormError, Show } from "../errors.js";
import type { Path, PathSegment } from "../path.js";
import type { FormSnapshot, Submission } from "../snapshot.js";
import { blank, entries, idle, listOf, none, sameList, settle, type Snapshot } from "./entries.js";
import { deepFreeze, dev, freezePath } from "./freeze.js";
import {
  createKeyList,
  hadKey,
  indexOfKey,
  initialIndex,
  initialKeys,
  insertKey,
  keyAt,
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
  /**
   * Fields that start disabled, as a `Flags<V>` declaration: a boolean for a
   * subtree, a record at an object, a one-element tuple at an array. It is
   * read a level at a time as nodes are made.
   */
  readonly disabled?: unknown;
  /** Fields that start read-only, declared the same way as `disabled`. */
  readonly readOnly?: unknown;
  /** When validation errors show. Defaults to `"touched-or-submitted"`. User errors always show. */
  readonly show?: Show;
  /**
   * Computes `dirty` for the field at stable path `path` holding `value`.
   * The store calls it when a field's value changes and after `recheckDirty`.
   * The form's `dirty` is its answer for the root. Without it nothing is dirty.
   */
  readonly dirty?: (path: Path, value: unknown) => boolean;
}

/**
 * The value store under a form store: the value tree, item keys, per-field
 * state, field and form snapshots, and listeners. Every path here is a
 * stable path.
 *
 * Every command updates the snapshots it changes, then runs listeners before
 * it returns unless a batch is open. One that changes nothing wakes nobody.
 * Commands that set state return false and do nothing at a path that names
 * no field or whose item was removed.
 */
export interface StoreCore<E = FormError, I = undefined, R = unknown> {
  /** The store id. */
  readonly id: string;
  /** Calls `listener` after a write that changes the snapshot at `path`. Returns the function that unsubscribes. */
  subscribe(path: Path, listener: () => void): () => void;
  /** The snapshot at `path`, the identical object until one of its members changes. */
  getSnapshot(path: Path): Snapshot<E>;
  /** The snapshot `path` had when the store was created. */
  getServerSnapshot(path: Path): Snapshot<E>;
  /** Calls `listener` after a write that changes the form snapshot. Returns the function that unsubscribes. */
  subscribeForm(listener: () => void): () => void;
  /** The form snapshot, the identical object until one of its members changes. Built on first read. */
  getFormSnapshot(): FormSnapshot<I, R>;
  /** The form snapshot the store started with, the identical object on every call. */
  getServerFormSnapshot(): FormSnapshot<I, R>;
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

  /** Sets the field's own touched flag. */
  setTouched(path: Path, touched: boolean): boolean;
  /** Marks the field edited. It stays edited, and so does every field above it, until `clearState` reaches it. */
  markEdited(path: Path): boolean;
  /** Sets the field's own disabled flag. The field and everything below it are disabled while it or a flag above is set. */
  setDisabled(path: Path, disabled: boolean): boolean;
  /** Sets the field's own read-only flag, inherited the same way as disabled. */
  setReadOnly(path: Path, readOnly: boolean): boolean;
  /**
   * Gives `owner` its place in the order validation errors are joined in.
   * Owners added earlier come first. A command for an owner the store hasn't
   * seen adds it, so a validator registration should call this first.
   */
  addOwner(owner: string): void;
  /** Says whether `owner` is validating the field. The field is validating while any owner says so. */
  setValidating(owner: string, path: Path, validating: boolean): boolean;
  /** Replaces `owner`'s validation errors on the field. The list is copied. */
  setValidationErrors(owner: string, path: Path, errors: readonly E[]): boolean;
  /** Replaces the field's user errors. The list is copied. */
  setUserErrors(path: Path, errors: readonly E[]): boolean;
  /** Clears user errors at and below `path`. Touched, edited and validation errors stay. */
  clearUserErrors(path: Path): boolean;
  /**
   * Clears touched, edited and user errors at and below `path`, and
   * validation errors too with `validation: true`. Flags and validating stay.
   */
  clearState(path: Path, options?: { readonly validation?: boolean }): boolean;
  /** Drops every validating mark and validation error `owner` set, and its place in the order. */
  removeOwner(owner: string): boolean;
  /** Sets the form's submission. */
  setSubmission(submission: Submission<I, R>): boolean;
  /** Sets the form's submit count. */
  setSubmitCount(count: number): boolean;
  /** Asks the `dirty` option again for every field and the form, after the baseline changed. */
  recheckDirty(): void;
  /**
   * The stable path of the field with dotted name `name` (`rows.0.title`),
   * or undefined when an index is out of range or a step goes into a leaf.
   */
  pathOf(name: string): Path | undefined;
  /** True when state can be set at `path`: it names a field and its item wasn't removed. */
  isLive(path: Path): boolean;
  /**
   * Says, for each segment of `path`, whether it names an array item.
   * Undefined when the path can't name a field: a step goes into a leaf, or
   * names an item key its array never had. A removed item's key counts as
   * had. Makes no nodes.
   */
  itemSteps(path: Path): readonly boolean[] | undefined;
  /** True when the field at `path` or one below it has a validation error. Makes no nodes. */
  invalidAt(path: Path): boolean;
  /** The stable path of the first enabled field, in value order, with a validation error. */
  firstInvalid(): Path | undefined;

  /** How many paths have a node, and how many of those hold subscriber state. For tests and leak checks. */
  stats(): { readonly nodes: number; readonly subscribed: number };
}

interface Subscription {
  readonly listener: () => void;
  /** The snapshot this listener last saw. It isn't called again until the snapshot differs. */
  seen: unknown;
  active: boolean;
}

/** Something listeners watch: a field node or the form. */
interface Cell<S> {
  snapshot: S;
  /** The snapshot from before the first change since listeners last ran. Set only while the cell waits to wake them. */
  before: S | undefined;
  subscriptions: Set<Subscription> | undefined;
}

/** A disabled or read-only flag on one node. */
interface Flag {
  /** The part of the `Flags` declaration at this node. */
  readonly decl: unknown;
  /** The node's own flag. */
  own: boolean;
  /** The own flag or the parent's `on`: what the snapshot shows. */
  on: boolean;
}

type FlagKind = "disabled" | "readOnly";

/** Counts of nodes at and below a node that are edited, invalid or validating. */
type Count = "editedCount" | "invalidCount" | "validatingCount";

/**
 * One stable path the store knows about. A node exists once something read,
 * subscribed or wrote at its path or below it. Every live node is brought up
 * to date on each write that reaches it, so reads only look nodes up. Field
 * state lives here, so it follows an item when the item moves.
 */
interface Node<E> extends Cell<Snapshot<E>> {
  readonly parent: Node<E> | undefined;
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
  server: Snapshot<E> | undefined;
  /** The item keys, once the value here has been an array. */
  list: KeyList | undefined;
  /** Live child nodes by stable segment. */
  children: Map<string, Node<E>> | undefined;
  /** Dead child nodes by item key, kept so their last snapshot stays readable. */
  removed: Map<string, Node<E>> | undefined;

  touched: boolean;
  /** This node's own edited mark. */
  marked: boolean;
  editedCount: number;
  invalidCount: number;
  validatingCount: number;
  disabled: Flag;
  readOnly: Flag;
  /** The owners validating this field. Undefined when none is. */
  validating: Set<string> | undefined;
  /** Validation errors by owner. */
  byOwner: Map<string, readonly E[]> | undefined;
  /** Every owner's validation errors, joined in owner order. */
  validation: readonly E[];
  user: readonly E[];
  /** `validation` then `user`. */
  errors: readonly E[];
  dirty: boolean;
  /** The value `dirty` was computed for. */
  dirtyFor: unknown;
}

/** A node's live children in value order: items by index, object keys in key order, then keys the value lacks. */
function inValueOrder<E>(node: Node<E>): Node<E>[] {
  const { children, value } = node;
  if (!children) return [];
  const order = Array.isArray(value) && node.list ? node.list.keys : isPlainObject(value) ? Object.keys(value) : [];
  const ordered: Node<E>[] = [];
  for (const seg of order) {
    const child = children.get(seg);
    if (child) ordered.push(child);
  }
  if (ordered.length < children.size) for (const child of children.values()) if (!ordered.includes(child)) ordered.push(child);
  return ordered;
}

const clamp = (index: number, max: number) => Math.max(0, Math.min(index, max));

/** A value no field holds, so `dirty` is computed again. */
const stale: unknown = Symbol("stale");

const freeze = <T extends object>(value: T): T => (dev ? Object.freeze(value) : value);

const idleSubmission: Submission<never, never> = freeze({ status: "idle" });

// The part of a `Flags` declaration under one child. A tuple's entry applies to every item.
const declUnder = (decl: unknown, seg: string): unknown =>
  Array.isArray(decl) ? decl[0] : isPlainObject(decl) ? childOf(decl, seg) : undefined;

const flagFrom = (decl: unknown, parent: Flag | undefined): Flag => {
  const own = decl === true;
  return { decl, own, on: own || (parent?.on ?? false) };
};

/** Makes a value store. It does nothing until something reads, subscribes or writes. */
export function createStoreCore<E = FormError, I = undefined, R = unknown>(options: StoreCoreOptions): StoreCore<E, I, R> {
  const { id, initial } = options;
  const show = options.show ?? "touched-or-submitted";
  const dirtyHook = options.dirty;
  let current = initial;
  let root: Node<E> | undefined;
  // How many commands have changed something. While it is 0 the current snapshot is the server snapshot.
  let changes = 0;
  let batchDepth = 0;
  // Cells whose snapshot changed and whose listeners haven't run yet.
  const pending = new Set<Cell<unknown>>();
  // Each owner's place in the error order.
  const ownerRank = new Map<string, number>();
  let nextRank = 0;
  // The live nodes where each owner is validating or has errors.
  const ownerNodes = new Map<string, Set<Node<E>>>();
  // Live nodes with validation errors, the only ones whose shown errors depend on the submit count.
  const withErrors = new Set<Node<E>>();

  let submission: Submission<I, R> = idleSubmission;
  let submitCount = 0;
  let formCell: Cell<FormSnapshot<I, R>> | undefined;
  let serverForm: FormSnapshot<I, R> | undefined;
  let formDirty = false;
  let formDirtyFor: unknown = stale;

  // Where `node` sits now, from its parent's value and key list.
  const place = (node: Node<E>) => {
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

  const nameOf = (node: Node<E>) => {
    const parent = node.parent;
    if (!parent) return "";
    const segment = node.index >= 0 ? String(node.index) : node.seg;
    return parent.name === "" ? segment : `${parent.name}.${segment}`;
  };

  const stablePathOf = (node: Node<E>): Path => {
    const path: string[] = [];
    for (let n = node; n.parent; n = n.parent) path.unshift(n.seg);
    return path;
  };

  const dirtyOf = (node: Node<E>): boolean => {
    if (!dirtyHook) return false;
    if (!Object.is(node.dirtyFor, node.value)) {
      node.dirty = dirtyHook(stablePathOf(node), node.value);
      node.dirtyFor = node.value;
    }
    return node.dirty;
  };

  // True when `show` lets the node's validation errors through.
  const showsValidation = (node: Node<E>, dirty: boolean): boolean => {
    const touched = node.touched;
    const submitted = submitCount > 0;
    if (typeof show === "function") return show({ touched, edited: node.editedCount > 0, dirty, submitCount });
    if (show === "always") return true;
    if (show === "touched") return touched;
    if (show === "submitted") return submitted;
    return touched || submitted;
  };

  const build = (node: Node<E>): Snapshot<E> => {
    const dirty = dirtyOf(node);
    const invalid = node.validation.length > 0;
    // User errors always show: something set them on purpose.
    const shownErrors = invalid && showsValidation(node, dirty) ? node.errors : node.user;
    return entries(node.value, node.name, Array.isArray(node.value) && node.list ? keysView(node.list) : undefined, {
      errors: node.errors,
      shownErrors,
      invalid,
      touched: node.touched,
      edited: node.editedCount > 0,
      dirty,
      validating: node.validating !== undefined,
      disabled: node.disabled.on,
      readOnly: node.readOnly.on,
    });
  };

  // Gives `cell` its new snapshot and queues its listeners.
  const replace = <S>(cell: Cell<S>, next: S) => {
    const previous = cell.snapshot;
    if (next === previous) return;
    cell.snapshot = next;
    if (cell.subscriptions && !pending.has(cell)) {
      cell.before = previous;
      pending.add(cell);
    }
  };

  const rebuild = (node: Node<E>) => replace(node, settle(build(node), node.snapshot, node.before));

  const buildForm = (): FormSnapshot<I, R> => {
    if (dirtyHook && !Object.is(formDirtyFor, current)) {
      formDirty = dirtyHook([], current);
      formDirtyFor = current;
    }
    return {
      valid: (root?.invalidCount ?? 0) === 0,
      validating: (root?.validatingCount ?? 0) > 0,
      dirty: formDirty,
      submitting: submission.status === "submitting",
      submission,
      submitCount,
    };
  };

  const serverFormSnapshot = (): FormSnapshot<I, R> =>
    (serverForm ??= freeze({
      valid: true,
      validating: false,
      dirty: false,
      submitting: false,
      submission: idleSubmission,
      submitCount: 0,
    }));

  // The form snapshot is only kept up to date once something has read it.
  const refreshForm = () => {
    if (formCell) replace(formCell, settle(buildForm(), formCell.snapshot, formCell.before));
  };

  // Adds `delta` to `count` on `from` and every node above it. A node whose
  // edited state flips gets a new snapshot. The other counts only show on the form.
  const bump = (from: Node<E> | undefined, count: Count, delta: number) => {
    if (delta === 0) return;
    for (let n = from; n; n = n.parent) {
      const was = n[count] > 0;
      n[count] += delta;
      if (count === "editedCount" && was !== n[count] > 0) rebuild(n);
    }
  };

  const track = (owner: string, node: Node<E>) => {
    let nodes = ownerNodes.get(owner);
    if (!nodes) ownerNodes.set(owner, (nodes = new Set()));
    nodes.add(node);
  };

  const untrack = (owner: string, node: Node<E>) => {
    if (node.validating?.has(owner) || node.byOwner?.has(owner)) return;
    ownerNodes.get(owner)?.delete(node);
  };

  const rankOf = (owner: string): number => {
    let rank = ownerRank.get(owner);
    if (rank === undefined) ownerRank.set(owner, (rank = nextRank++));
    return rank;
  };

  // Joins the owners' lists in owner order, keeping the current list when nothing in it changed.
  const joinValidation = (node: Node<E>): readonly E[] => {
    const byOwner = node.byOwner;
    if (!byOwner || byOwner.size === 0) return none;
    if (byOwner.size === 1) for (const list of byOwner.values()) return list;
    // Few owners share a field, so an insertion sort is enough.
    const ordered: { rank: number; list: readonly E[] }[] = [];
    for (const [owner, list] of byOwner) {
      const rank = rankOf(owner);
      let at = ordered.length;
      while (at > 0 && (ordered[at - 1]?.rank ?? -1) > rank) at--;
      ordered.splice(at, 0, { rank, list });
    }
    const joined = ordered.flatMap((entry) => entry.list);
    return sameList(joined, node.validation) ? node.validation : freeze(joined);
  };

  // Recomputes the node's error lists and counts from `byOwner` and `user`, then its snapshot.
  const refreshErrors = (node: Node<E>) => {
    const validation = joinValidation(node);
    const was = node.validation.length > 0;
    const is = validation.length > 0;
    node.validation = validation;
    if (was !== is) {
      bump(node, "invalidCount", is ? 1 : -1);
      if (is) withErrors.add(node);
      else withErrors.delete(node);
    }
    const { user } = node;
    if (validation.length === 0) node.errors = user;
    else if (user.length === 0) node.errors = validation;
    else {
      const joined = [...validation, ...user];
      if (!sameList(joined, node.errors)) node.errors = freeze(joined);
    }
    rebuild(node);
  };

  // Marks `node` and its subtree dead and drops them from the store-wide indexes.
  const bury = (node: Node<E>) => {
    node.dead = true;
    withErrors.delete(node);
    if (node.validating) for (const owner of node.validating) ownerNodes.get(owner)?.delete(node);
    if (node.byOwner) for (const owner of node.byOwner.keys()) ownerNodes.get(owner)?.delete(node);
    if (node.children) for (const child of node.children.values()) bury(child);
  };

  // Moves the child at item key `key` to `removed`, takes its state out of the
  // counts above it and marks its subtree dead. Its snapshots are current as
  // of the last change, so they stay the last ones.
  const kill = (node: Node<E>, key: string) => {
    const child = node.children?.get(key);
    if (!child) return;
    node.children?.delete(key);
    (node.removed ??= new Map()).set(key, child);
    bump(node, "editedCount", -child.editedCount);
    bump(node, "invalidCount", -child.invalidCount);
    bump(node, "validatingCount", -child.validatingCount);
    bury(child);
  };

  // Fits the key list to the value. Keys are made here the first time the value is an array.
  const syncKeys = (node: Node<E>) => {
    const length = Array.isArray(node.value) ? node.value.length : 0;
    if (!node.list) {
      if (Array.isArray(node.value)) node.list = createKeyList(length);
      return;
    }
    for (const key of resizeKeys(node.list, length)) kill(node, key);
  };

  const createNode = (parent: Node<E> | undefined, seg: string): Node<E> => {
    const node: Node<E> = {
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
      touched: false,
      marked: false,
      editedCount: 0,
      invalidCount: 0,
      validatingCount: 0,
      disabled: parent ? flagFrom(declUnder(parent.disabled.decl, seg), parent.disabled) : flagFrom(options.disabled, undefined),
      readOnly: parent ? flagFrom(declUnder(parent.readOnly.decl, seg), parent.readOnly) : flagFrom(options.readOnly, undefined),
      validating: undefined,
      byOwner: undefined,
      validation: none,
      user: none,
      errors: none,
      dirty: false,
      dirtyFor: stale,
    };
    place(node);
    node.name = nameOf(node);
    syncKeys(node);
    node.snapshot = settle(build(node), undefined, undefined);
    if (changes === 0) node.server = node.snapshot;
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

  const nodeAt = (path: Path): Node<E> => {
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

  // The node at `path` when it exists, without making any.
  const findNode = (path: Path): Node<E> | undefined => {
    let node = root;
    for (const segment of path) {
      if (!node) return undefined;
      const seg = String(segment);
      node = node.children?.get(seg) ?? node.removed?.get(seg);
    }
    return node;
  };

  // The node at `path` when state can be set there.
  const fieldAt = (path: Path): Node<E> | undefined => {
    const node = nodeAt(path);
    return node.dead || node.blocked ? undefined : node;
  };

  // Brings `node` and its subtree up to date. A child whose value, index and
  // reach didn't change is skipped with everything below it, so a write only
  // visits nodes it can have changed.
  const update = (node: Node<E>, renamed: boolean) => {
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
  const refreshDown = (node: Node<E>): void => {
    if (node.parent) refreshDown(node.parent);
    place(node);
    syncKeys(node);
    rebuild(node);
  };

  const flush = () => {
    if (pending.size === 0) return;
    const cells = [...pending];
    pending.clear();
    let failed = false;
    let error: unknown;
    for (const cell of cells) {
      cell.before = undefined;
      if (!cell.subscriptions) continue;
      // A Set skips entries deleted during the loop. One added during the loop
      // has already seen the current snapshot, so the check below skips it.
      for (const subscription of cell.subscriptions) {
        if (!subscription.active || subscription.seen === cell.snapshot) continue;
        subscription.seen = cell.snapshot;
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

  // Ends a command: brings the form snapshot up to date and runs listeners unless a batch is open.
  const finish = (changed: boolean): boolean => {
    if (!changed) return false;
    changes++;
    refreshForm();
    if (batchDepth === 0) flush();
    return true;
  };

  // Makes `next` the value, updates the written node's ancestors and subtree,
  // then runs listeners unless a batch is open.
  const commit = (next: unknown, target: Node<E>) => {
    current = next;
    if (target.parent) refreshDown(target.parent);
    update(target, false);
    finish(true);
  };

  const valuePathOf = (node: Node<E>): PathSegment[] => {
    const path: PathSegment[] = [];
    for (let n = node; n.parent; n = n.parent) path.unshift(n.index >= 0 ? n.index : n.seg);
    return path;
  };

  // Written values are frozen in development, along with the copies `setAt`
  // made on the written path. Everything else is shared and already frozen.
  const writeAt = (node: Node<E>, value: unknown) => {
    const path = valuePathOf(node);
    const next = setAt(current, path, value);
    commit(dev ? freezePath(next, path) : next, node);
  };

  // The array node at `path` when it can take an array write: an array, or missing.
  const arrayAt = (path: Path): { node: Node<E>; items: readonly unknown[] } | undefined => {
    const node = nodeAt(path);
    if (node.dead || node.blocked) return undefined;
    if (Array.isArray(node.value)) return { node, items: node.value };
    if (node.value === undefined || node.value === null) return { node, items: [] };
    return undefined;
  };

  interface InitialPlace {
    readonly value: unknown;
    readonly name: string;
    readonly blocked: boolean;
    readonly disabled: Flag;
    readonly readOnly: Flag;
  }

  // Where `node` sat in the initial value, using the positional keys every
  // key list starts with, and the flags it started with.
  const initialPlace = (node: Node<E>): InitialPlace => {
    if (!node.parent) {
      const disabled = flagFrom(options.disabled, undefined);
      const readOnly = flagFrom(options.readOnly, undefined);
      return { value: initial, name: "", blocked: false, disabled, readOnly };
    }
    const parent = initialPlace(node.parent);
    const disabled = flagFrom(declUnder(parent.disabled.decl, node.seg), parent.disabled);
    const readOnly = flagFrom(declUnder(parent.readOnly.decl, node.seg), parent.readOnly);
    const at = (value: unknown, segment: string, blocked: boolean): InitialPlace => ({
      value,
      name: parent.name === "" ? segment : `${parent.name}.${segment}`,
      blocked,
      disabled,
      readOnly,
    });
    const holder = parent.value;
    if (parent.blocked) return at(undefined, node.seg, true);
    if (Array.isArray(holder)) {
      const index = initialIndex(node.seg, holder.length);
      if (index < 0) return at(undefined, node.seg, true);
      const item: unknown = holder[index];
      return at(item, String(index), false);
    }
    if (isPlainObject(holder)) return at(childOf(holder, node.seg), node.seg, false);
    return at(undefined, node.seg, holder !== undefined && holder !== null);
  };

  // The snapshot `node` had at creation, built from the initial value and flags.
  const serverOf = (node: Node<E>): Snapshot<E> => {
    if (node.server) return node.server;
    const { value, name, disabled, readOnly } = initialPlace(node);
    const keys = Array.isArray(value) ? initialKeys(value.length) : undefined;
    const state = { ...idle, disabled: disabled.on, readOnly: readOnly.on };
    node.server = settle(entries(value, name, keys && dev ? Object.freeze(keys) : keys, state), undefined, undefined);
    return node.server;
  };

  // Sets the own flag and brings the existing nodes below up to date. A node
  // made later reads its parent's flag when it is made.
  const setFlag = (kind: FlagKind, path: Path, on: boolean): boolean => {
    const node = fieldAt(path);
    if (!node || node[kind].own === on) return false;
    node[kind].own = on;
    const inherit = (n: Node<E>) => {
      const flag = n[kind];
      const next = flag.own || (n.parent?.[kind].on ?? false);
      if (next === flag.on) return;
      flag.on = next;
      rebuild(n);
      if (n.children) for (const child of n.children.values()) inherit(child);
    };
    inherit(node);
    return finish(true);
  };

  const listen = <S>(cell: Cell<S>, listener: () => void): (() => void) => {
    const subscription: Subscription = { listener, seen: cell.snapshot, active: true };
    (cell.subscriptions ??= new Set()).add(subscription);
    return () => {
      if (!subscription.active) return;
      subscription.active = false;
      cell.subscriptions?.delete(subscription);
      // The set and the pending entry only serve subscribers, so they go with the last one.
      if (cell.subscriptions?.size === 0) {
        cell.subscriptions = undefined;
        cell.before = undefined;
        pending.delete(cell);
      }
    };
  };

  const form = (): Cell<FormSnapshot<I, R>> =>
    (formCell ??= {
      snapshot: settle(buildForm(), serverFormSnapshot(), undefined),
      before: undefined,
      subscriptions: undefined,
    });

  return {
    id,
    subscribe: (path, listener) => listen(nodeAt(path), listener),
    getSnapshot: (path) => nodeAt(path).snapshot,
    getServerSnapshot: (path) => serverOf(nodeAt(path)),
    subscribeForm: (listener) => listen(form(), listener),
    getFormSnapshot: () => form().snapshot,
    getServerFormSnapshot: serverFormSnapshot,
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
      // Spread then splice, since `slice` is slow on the frozen arrays of development.
      const next = [...items];
      next.splice(at, 0, item);
      writeAt(node, next);
      return key;
    },
    remove(path, index) {
      const target = arrayAt(path);
      if (!target || !target.node.list || !Number.isInteger(index)) return undefined;
      const { node, items } = target;
      if (index < 0 || index >= items.length) return undefined;
      const key = removeKey(target.node.list, index);
      if (key !== undefined) kill(node, key);
      const next = [...items];
      next.splice(index, 1);
      writeAt(node, next);
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

    setTouched(path, touched) {
      const node = fieldAt(path);
      if (!node || node.touched === touched) return false;
      node.touched = touched;
      rebuild(node);
      return finish(true);
    },
    markEdited(path) {
      const node = fieldAt(path);
      if (!node || node.marked) return false;
      node.marked = true;
      bump(node, "editedCount", 1);
      return finish(true);
    },
    setDisabled: (path, disabled) => setFlag("disabled", path, disabled),
    setReadOnly: (path, readOnly) => setFlag("readOnly", path, readOnly),
    addOwner(owner) {
      rankOf(owner);
    },
    setValidating(owner, path, validating) {
      const node = fieldAt(path);
      if (!node) return false;
      rankOf(owner);
      const was = node.validating !== undefined;
      if ((node.validating?.has(owner) ?? false) === validating) return false;
      if (validating) {
        (node.validating ??= new Set()).add(owner);
        track(owner, node);
      } else {
        node.validating?.delete(owner);
        if (node.validating?.size === 0) node.validating = undefined;
        untrack(owner, node);
      }
      const is = node.validating !== undefined;
      if (was !== is) {
        bump(node, "validatingCount", is ? 1 : -1);
        rebuild(node);
      }
      return finish(true);
    },
    setValidationErrors(owner, path, errors) {
      const node = fieldAt(path);
      if (!node) return false;
      rankOf(owner);
      if (sameList(node.byOwner?.get(owner) ?? none, errors)) return false;
      if (errors.length === 0) {
        node.byOwner?.delete(owner);
        untrack(owner, node);
      } else {
        (node.byOwner ??= new Map()).set(owner, listOf(errors));
        track(owner, node);
      }
      refreshErrors(node);
      return finish(true);
    },
    setUserErrors(path, errors) {
      const node = fieldAt(path);
      if (!node || sameList(node.user, errors)) return false;
      node.user = listOf(errors);
      refreshErrors(node);
      return finish(true);
    },
    clearUserErrors(path) {
      const start = findNode(path);
      if (!start || start.dead) return false;
      let changed = false;
      const visit = (node: Node<E>) => {
        if (node.user.length > 0) {
          node.user = none;
          changed = true;
          refreshErrors(node);
        }
        if (node.children) for (const child of node.children.values()) visit(child);
      };
      visit(start);
      return finish(changed);
    },
    clearState(path, clearOptions) {
      const start = findNode(path);
      if (!start || start.dead) return false;
      const validation = clearOptions?.validation === true;
      let changed = false;
      const visit = (node: Node<E>) => {
        let dirty = false;
        if (node.touched) {
          node.touched = false;
          dirty = true;
        }
        if (node.marked) {
          node.marked = false;
          changed = true;
          // Rebuilds this node and those above it whose edited state flips.
          bump(node, "editedCount", -1);
        }
        if (node.user.length > 0) {
          node.user = none;
          dirty = true;
        }
        if (validation && node.byOwner && node.byOwner.size > 0) {
          const owners = [...node.byOwner.keys()];
          node.byOwner = undefined;
          for (const owner of owners) untrack(owner, node);
          dirty = true;
        }
        if (dirty) {
          changed = true;
          refreshErrors(node);
        }
        if (node.children) for (const child of node.children.values()) visit(child);
      };
      visit(start);
      return finish(changed);
    },
    removeOwner(owner) {
      ownerRank.delete(owner);
      const nodes = ownerNodes.get(owner);
      ownerNodes.delete(owner);
      if (!nodes || nodes.size === 0) return false;
      for (const node of nodes) {
        if (node.validating?.delete(owner)) {
          if (node.validating.size === 0) {
            node.validating = undefined;
            bump(node, "validatingCount", -1);
          }
        }
        node.byOwner?.delete(owner);
        refreshErrors(node);
      }
      return finish(true);
    },
    setSubmission(next) {
      if (Object.is(next, submission)) return false;
      submission = freeze(next);
      return finish(true);
    },
    setSubmitCount(count) {
      if (count === submitCount) return false;
      const was = submitCount;
      submitCount = count;
      // Only fields with validation errors can show something different.
      const matters = typeof show === "function" || ((show === "submitted" || show === "touched-or-submitted") && was > 0 !== count > 0);
      if (matters) for (const node of withErrors) rebuild(node);
      return finish(true);
    },
    recheckDirty() {
      if (!dirtyHook) return;
      formDirtyFor = stale;
      const visit = (node: Node<E>) => {
        node.dirtyFor = stale;
        rebuild(node);
        if (node.children) for (const child of node.children.values()) visit(child);
      };
      if (root) visit(root);
      finish(true);
    },
    pathOf(name) {
      // A property name that contains a dot can't be told apart from two
      // steps, so such a field resolves to the wrong path or to none.
      if (name === "") return [];
      const path: string[] = [];
      let value = current;
      let node = root;
      for (const part of name.split(".")) {
        let seg: string | undefined;
        if (Array.isArray(value)) {
          if (!/^(0|[1-9]\d*)$/.test(part)) return undefined;
          const at = Number(part);
          if (at >= value.length) return undefined;
          seg = keyAt(node?.list, at);
          value = value[at];
        } else if (isPlainObject(value)) {
          seg = part;
          value = childOf(value, part);
        } else if (value === undefined || value === null) {
          // A missing object's fields are still fields, as reads and writes treat them.
          seg = part;
        } else return undefined;
        if (seg === undefined) return undefined;
        path.push(seg);
        node = node?.children?.get(seg);
      }
      return path;
    },
    isLive: (path) => fieldAt(path) !== undefined,
    itemSteps(path) {
      const steps: boolean[] = [];
      let value = current;
      let node = root;
      // False once the walk passes a removed item it has no node for, so the values below are unknown.
      let known = true;
      for (const segment of path) {
        const seg = String(segment);
        const child = node?.children?.get(seg) ?? node?.removed?.get(seg);
        if (!known) steps.push(false);
        else if (Array.isArray(value)) {
          if (!hadKey(node?.list, seg, value.length)) return undefined;
          steps.push(true);
          const index = node?.list ? indexOfKey(node.list, seg) : initialIndex(seg, value.length);
          if (index >= 0) value = value[index];
          else if (child) value = child.value;
          else known = false;
        } else if (isPlainObject(value)) {
          steps.push(false);
          value = childOf(value, seg);
        } else if (value === undefined || value === null) steps.push(false);
        else return undefined;
        node = child;
      }
      return steps;
    },
    invalidAt(path) {
      const node = findNode(path);
      return node !== undefined && !node.dead && node.invalidCount > 0;
    },
    firstInvalid() {
      const visit = (node: Node<E>): Node<E> | undefined => {
        // A disabled node's subtree is disabled too, so it is skipped whole.
        if (node.invalidCount === 0 || node.disabled.on) return undefined;
        if (node.validation.length > 0) return node;
        for (const child of inValueOrder(node)) {
          const found = visit(child);
          if (found) return found;
        }
        return undefined;
      };
      const found = root && visit(root);
      return found && stablePathOf(found);
    },

    stats() {
      let nodes = 0;
      let subscribed = 0;
      const count = (node: Node<E>) => {
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
