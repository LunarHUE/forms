import type { FormError, Show } from "../errors.js";
import type { Path, PathSegment } from "../path.js";
import { problem } from "../problem.js";
import type { FormSnapshot, Submission } from "../snapshot.js";
import { blank, entries, idle, listOf, none, sameList, settle, type Snapshot } from "./entries.js";
import { deepFreeze, freeze, freezePath } from "./freeze.js";
import { hadKey, indexOfKey, initialIndex, initialKeys, keyAt, keysView, type KeyList } from "./keys.js";
import { childOf, hasOwn, isPlainObject, setAt } from "./tree.js";

export type { Snapshot } from "./entries.js";

// Core has no node or DOM types, so this declares the globals the development check uses.
declare const process: { readonly env: { readonly NODE_ENV?: string } };
declare const console: { warn(message: string): void };

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
  readonly show?: Show | undefined;
  /**
   * Computes `dirty` for the field at stable path `path` holding `value`.
   * The store calls it when a field's value changes and after `recheckDirty`.
   * The form's `dirty` is its answer for the root. Without it nothing is dirty.
   */
  readonly dirty?: ((path: Path, value: unknown) => boolean) | undefined;
  /**
   * The array code, from `arrays()`. Without it every array has the
   * positional keys `k0`, `k1`, ..., and `insert`, `remove` and `move` do
   * nothing.
   */
  readonly arrays?: CreateArrays | undefined;
}

/**
 * The array code: what fits a node's key list to its value, then the
 * `insert`, `remove` and `move` commands. A tuple, so the names minify.
 */
export type ArrayKit<E> = readonly [sync: (node: Node<E>) => void, insert: StoreCore<E>["insert"], remove: StoreCore<E>["remove"], move: StoreCore<E>["move"]];

/** Makes the array code of one store core. */
export type CreateArrays = <E>(
  fieldAt: (path: Path) => Node<E> | undefined,
  writeAt: (node: Node<E>, value: unknown) => void,
  bump: (from: Node<E> | undefined, count: Count, delta: number) => void,
  withErrors: Set<Node<E>>,
  ownerNodes: Map<string, Set<Node<E>>>,
) => ArrayKit<E>;

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
  subscribe(this: void, path: Path, listener: () => void): () => void;
  /** The snapshot at `path`, the identical object until one of its members changes. */
  getSnapshot(this: void, path: Path): Snapshot<E>;
  /** The snapshot `path` had when the store was created. */
  getServerSnapshot(this: void, path: Path): Snapshot<E>;
  /** Calls `listener` after a write that changes the form snapshot. Returns the function that unsubscribes. */
  subscribeForm(this: void, listener: () => void): () => void;
  /** The form snapshot, the identical object until one of its members changes. Built on first read. */
  getFormSnapshot(this: void): FormSnapshot<I, R, "dirty">;
  /** The form snapshot the store started with, the identical object on every call. */
  getServerFormSnapshot(this: void): FormSnapshot<I, R, "dirty">;
  /** Runs `fn`, holding listeners until the outermost batch returns. */
  batch<T>(this: void, fn: () => T): T;
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
  /**
   * Sets slot `slot` of the meta on the field at `path`, or on the form
   * without a path. The meta object is replaced, so the snapshot changes.
   */
  setMeta(slot: string, value: unknown, path?: Path): boolean;
  /** Asks the `dirty` option again for every field and the form, after the baseline changed. */
  recheckDirty(): void;
  /**
   * Makes the state now the starting state: the server snapshots show it
   * from here on. The plugin host calls it after plugin setup, so what setup
   * wrote renders on the server too.
   */
  started(): void;
  /**
   * The stable path of the field with dotted name `name` (`rows.0.title`),
   * or undefined when an index is out of range or a step goes into a leaf.
   * With `strict`, also undefined when a step names a key its object lacks,
   * unless something subscribes to or validates the field there or below.
   */
  pathOf(name: string, strict?: boolean): Path | undefined;
  /** True when state can be set at `path`: it names a field and its item wasn't removed. */
  isLive(path: Path): boolean;
  /**
   * Says, for each segment of `path`, whether it names an array item.
   * Undefined when the path can't name a field: a step goes into a leaf, or
   * names an item key its array never had. A removed item's key counts as
   * had. With `strict`, also undefined where `pathOf` would be. Makes no nodes.
   */
  itemSteps(path: Path, strict?: boolean): readonly boolean[] | undefined;
  /** True when the field at `path` or one below it has a validation error. Makes no nodes. */
  invalidAt(path: Path): boolean;
  /** The stable paths of the fields with an error of either kind, in value order. Makes no nodes. */
  invalid(): Path[];
  /**
   * Calls `listener` after a write that changes which fields have errors,
   * one of their error lists or one of their names. Returns the function
   * that unsubscribes.
   */
  subscribeInvalid(this: void, listener: () => void): () => void;

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

/**
 * Counts of nodes at and below a node that are edited, have a validation
 * error, have an error of either kind, or are validating.
 */
export type Count = "editedCount" | "invalidCount" | "errorCount" | "validatingCount";

/**
 * One stable path the store knows about. A node exists once something read,
 * subscribed or wrote at its path or below it. Every live node is brought up
 * to date on each write that reaches it, so reads only look nodes up. Field
 * state lives here, so it follows an item when the item moves.
 */
export interface Node<E> extends Cell<Snapshot<E>> {
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
  errorCount: number;
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
  /** Plugin meta by plugin name. Undefined until a plugin sets some, and the snapshot has it only then. */
  meta: Meta;
}

/** Plugin meta by plugin name, or undefined while no plugin has set any. */
type Meta = Readonly<Record<string, unknown>> | undefined;

/** A node's live children in value order: items by index, object keys in key order, then keys the value lacks. */
function inValueOrder<E>(node: Node<E>): Node<E>[] {
  const { children, value } = node;
  if (!children) return [];
  const order = Array.isArray(value) ? (node.snapshot.keys ?? []) : isPlainObject(value) ? Object.keys(value) : [];
  const ordered: Node<E>[] = [];
  for (const seg of order) {
    const child = children.get(seg);
    if (child) ordered.push(child);
  }
  if (ordered.length < children.size) for (const child of children.values()) if (!ordered.includes(child)) ordered.push(child);
  return ordered;
}

// An array command on a store without `arrays()`. The types don't catch it, so production does nothing.
const missing = (): undefined => {
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") throw new Error(problem("arrays:missing"));
  return undefined;
};

// The positional key lists, by length, shared by every array without `arrays()`.
const positional: (readonly string[])[] = [];
const positionalKeys = (length: number): readonly string[] => (positional[length] ??= freeze(initialKeys(length)));

/** A value no field holds, so `dirty` is computed again. */
const stale: unknown = Symbol("stale");

const idleSubmission: Submission<never, never> = freeze({ status: "idle" });

const flagFrom = (decl: unknown, inherited: boolean): Flag => {
  const own = decl === true;
  return { decl, own, on: own || inherited };
};

// The flag of the child at `seg`. A tuple's entry in the declaration applies to every item.
const flagUnder = ({ decl, on }: Flag, seg: string): Flag =>
  flagFrom(Array.isArray(decl) ? decl[0] : isPlainObject(decl) ? childOf(decl, seg) : undefined, on);

/** Makes a value store. It does nothing until something reads, subscribes or writes. */
export function createStoreCore<E = FormError, I = undefined, R = unknown>(options: StoreCoreOptions): StoreCore<E, I, R> {
  const { id } = options;
  const show = options.show ?? "touched-or-submitted";
  const dirtyHook = options.dirty;
  let current = options.initial;
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
  let formCell: Cell<FormSnapshot<I, R, "dirty">> | undefined;
  let serverForm: FormSnapshot<I, R, "dirty"> | undefined;
  let formDirty = false;
  let formDirtyFor: unknown = stale;
  // The form's plugin meta.
  let formMeta: Meta;
  // True once `submit:unseen` was logged for this store.
  let warnedUnseen = false;
  // Wakes `subscribeInvalid` listeners. Its snapshot is a counter, made on the first subscribe.
  let invalidCell: Cell<number> | undefined;
  const invalidChanged = () => {
    if (invalidCell) replace(invalidCell, invalidCell.snapshot + 1);
  };

  // The index of item key `seg` in the array at `node` of `length` items, or -1.
  const indexIn = (node: Node<E> | undefined, seg: string, length: number) =>
    node?.list ? indexOfKey(node.list, seg) : initialIndex(seg, length);

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
      const index = indexIn(parent, node.seg, holder.length);
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

  // The node's stable path, or its value path with `byValue`.
  const pathOf = (node: Node<E>, byValue: boolean): PathSegment[] => {
    const path: PathSegment[] = [];
    for (let n = node; n.parent; n = n.parent) path.unshift(byValue && n.index >= 0 ? n.index : n.seg);
    return path;
  };

  const dirtyOf = (node: Node<E>): boolean => {
    if (!dirtyHook) return false;
    if (!Object.is(node.dirtyFor, node.value)) {
      node.dirty = dirtyHook(pathOf(node, false), node.value);
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
    // User errors always show: something set them on purpose.
    const shownErrors = node.validation.length > 0 && showsValidation(node, dirty) ? node.errors : node.user;
    return entries(node.value, node.name, Array.isArray(node.value) ? (node.list ? keysView(node.list) : positionalKeys(node.value.length)) : undefined, {
      errors: node.errors,
      userErrors: node.user,
      shownErrors,
      invalid: node.errors.length > 0,
      touched: node.touched,
      edited: node.editedCount > 0,
      dirty,
      validating: node.validating !== undefined,
      disabled: node.disabled.on,
      readOnly: node.readOnly.on,
      ...(node.meta && { meta: node.meta }),
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

  const buildForm = (): FormSnapshot<I, R, "dirty"> => {
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
      ...(formMeta && { meta: formMeta }),
    };
  };

  const serverFormSnapshot = (): FormSnapshot<I, R, "dirty"> =>
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
    if (count === "errorCount") invalidChanged();
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
    const { user, errors } = node;
    if (validation.length === 0) node.errors = user;
    else if (user.length === 0) node.errors = validation;
    else {
      const joined = [...validation, ...user];
      if (!sameList(joined, node.errors)) node.errors = freeze(joined);
    }
    if (node.errors !== errors) {
      invalidChanged();
      bump(node, "errorCount", Number(node.errors.length > 0) - Number(errors.length > 0));
    }
    rebuild(node);
  };

  const syncKeys = (node: Node<E>) => kit?.[0](node);

  // True when something subscribes to or validates the field at `node` or
  // below it, so its name counts as known though the value lacks the key.
  const used = (node: Node<E> | undefined): boolean =>
    !!node && (!!node.subscriptions || !!node.validating || node.validation.length > 0 || [...(node.children?.values() ?? [])].some(used));

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
      errorCount: 0,
      validatingCount: 0,
      disabled: parent ? flagUnder(parent.disabled, seg) : flagFrom(options.disabled, false),
      readOnly: parent ? flagUnder(parent.readOnly, seg) : flagFrom(options.readOnly, false),
      validating: undefined,
      byOwner: undefined,
      validation: none,
      user: none,
      errors: none,
      dirty: false,
      dirtyFor: stale,
      meta: undefined,
    };
    place(node);
    node.name = nameOf(node);
    syncKeys(node);
    node.snapshot = freeze(build(node));
    // A root made after a change still shows the start, since only
    // form-level commands run without making it.
    if (changes === 0 || !parent) node.server = node.snapshot;
    return node;
  };

  const rootNode = () => {
    if (!root) {
      // The caller's initial value is frozen in development, here on first
      // use rather than at creation, so creating a store changes nothing.
      deepFreeze(current);
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
    if (moved) {
      node.name = nameOf(node);
      if (node.errors.length > 0) invalidChanged();
    }
    syncKeys(node);
    rebuild(node);
    node.children?.forEach((child) => update(child, moved));
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

  // Written values are frozen in development, along with the copies `setAt`
  // made on the written path. Everything else is shared and already frozen.
  const writeAt = (node: Node<E>, value: unknown) => {
    const path = pathOf(node, true);
    const next = setAt(current, path, value);
    commit(freezePath(next, path), node);
  };

  // The snapshot `node` had when the store started. The root and every node
  // made by then have theirs. A node made since gets one from its parent's:
  // the value under it, found by the parent's item keys then, and the flags
  // its declaration gives it under the parent's.
  const serverOf = (node: Node<E>): Snapshot<E> => {
    const parent = node.parent;
    if (node.server || !parent) return (node.server ??= node.snapshot);
    const above = serverOf(parent);
    const holder = above.value;
    let value: unknown;
    let step = node.seg;
    if (Array.isArray(holder)) {
      // Setup may have changed the parent's keys, which its start snapshot keeps.
      const index = above.keys?.indexOf(step) ?? -1;
      if (index >= 0) {
        value = holder[index];
        step = String(index);
      }
    } else if (isPlainObject(holder)) value = childOf(holder, step);
    const keys = Array.isArray(value) ? positionalKeys(value.length) : undefined;
    return (node.server = freeze(
      entries(value, above.name === "" ? step : `${above.name}.${step}`, keys, {
        ...idle,
        // Plugin setup may have written a value that differs from the baseline.
        dirty: !!dirtyHook?.(pathOf(node, false), value),
        disabled: node.disabled.decl === true || above.disabled,
        readOnly: node.readOnly.decl === true || above.readOnly,
      }),
    ));
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
      n.children?.forEach(inherit);
    };
    inherit(node);
    return finish(true);
  };

  // Clears user errors at and below `path`, plus touched and edited with
  // `state`, plus validation errors with `validation`.
  const clearBelow = (path: Path, state: boolean, validation: boolean): boolean => {
    const start = findNode(path);
    if (!start || start.dead) return false;
    let changed = false;
    const visit = (node: Node<E>) => {
      let dirty = false;
      if (state && node.touched) {
        node.touched = false;
        dirty = true;
      }
      if (state && node.marked) {
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
      node.children?.forEach(visit);
    };
    visit(start);
    return finish(changed);
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

  const kit = options.arrays?.<E>(fieldAt, writeAt, bump, withErrors, ownerNodes);

  const form = (): Cell<FormSnapshot<I, R, "dirty">> =>
    (formCell ??= {
      snapshot: settle(buildForm(), serverFormSnapshot()),
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
      const node = fieldAt(path);
      if (!node || Object.is(node.value, value)) return false;
      writeAt(node, value);
      return true;
    },
    insert: kit?.[1] ?? missing,
    remove: kit?.[2] ?? missing,
    move: kit?.[3] ?? (() => !!missing()),

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
    clearUserErrors: (path) => clearBelow(path, false, false),
    clearState: (path, clearOptions) => clearBelow(path, true, clearOptions?.validation === true),
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
      // Development only. Core can't see the page, so a subscription stands
      // in for "something renders these errors". Containers alone are named:
      // an unread leaf may be on a step the app shows after the submit.
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && next.status === "invalid" && !warnedUnseen) {
        const unseen: string[] = [];
        let read = false;
        for (const node of withErrors) {
          if (node.subscriptions) read = true;
          else if (!node.parent || node.children?.size) unseen.push(node.parent ? `\`${node.name}\`` : "the root");
        }
        if (!read && unseen.length > 0) {
          warnedUnseen = true;
          console.warn(problem("submit:unseen", unseen.join(", ")));
        }
      }
      return finish(true);
    },
    setSubmitCount(count) {
      if (count === submitCount) return false;
      submitCount = count;
      // Only fields with validation errors can show something different. A
      // rebuild that changes nothing keeps the snapshot.
      for (const node of withErrors) rebuild(node);
      return finish(true);
    },
    setMeta(slot, value, path) {
      if (!path) {
        if (Object.is(formMeta?.[slot], value)) return false;
        formMeta = freeze({ ...formMeta, [slot]: value });
        return finish(true);
      }
      const node = fieldAt(path);
      if (!node || Object.is(node.meta?.[slot], value)) return false;
      node.meta = freeze({ ...node.meta, [slot]: value });
      rebuild(node);
      return finish(true);
    },
    recheckDirty() {
      if (!dirtyHook) return;
      formDirtyFor = stale;
      const visit = (node: Node<E>) => {
        node.dirtyFor = stale;
        rebuild(node);
        node.children?.forEach(visit);
      };
      if (root) visit(root);
      finish(true);
    },
    started() {
      if (!changes) return;
      changes = 0;
      serverForm = form().snapshot;
      const visit = (node: Node<E>) => {
        node.server = node.snapshot;
        node.children?.forEach(visit);
      };
      if (root) visit(root);
    },
    pathOf(name, strict) {
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
          if (strict && !hasOwn(value, part) && !used(node?.children?.get(part))) return undefined;
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
    itemSteps(path, strict) {
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
          const index = indexIn(node, seg, value.length);
          if (index >= 0) value = value[index];
          else if (child) value = child.value;
          else known = false;
        } else if (isPlainObject(value)) {
          if (strict && !hasOwn(value, seg) && !used(child)) return undefined;
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
    invalid() {
      const paths: Path[] = [];
      const visit = (node: Node<E>) => {
        if (node.errorCount === 0) return;
        if (node.errors.length > 0) paths.push(pathOf(node, false));
        for (const child of inValueOrder(node)) visit(child);
      };
      if (root) visit(root);
      return paths;
    },
    subscribeInvalid: (listener) => listen((invalidCell ??= { snapshot: 0, before: undefined, subscriptions: undefined }), listener),

    stats() {
      let nodes = 0;
      let subscribed = 0;
      const count = (node: Node<E>) => {
        nodes++;
        if (node.subscriptions) subscribed++;
        node.children?.forEach(count);
        node.removed?.forEach(count);
      };
      if (root) count(root);
      return { nodes, subscribed };
    },
  };
}
