import type { Path } from "../path.js";
import type { ArrayKit, Count, Node } from "./core.js";
import { createKeyList, insertKey, moveKey, removeKey, resizeKeys } from "./keys.js";

const clamp = (index: number, max: number) => Math.max(0, Math.min(index, max));

/**
 * The array code of the store core: key lists that follow inserts, removes
 * and moves, and the commands that make them. In a module of its own so a
 * form without `arrays()` doesn't bring it. Without it every array has the
 * positional keys `k0`, `k1`, ... and the commands throw in development.
 */
export function createArrays<E>(
  fieldAt: (path: Path) => Node<E> | undefined,
  writeAt: (node: Node<E>, value: unknown) => void,
  bump: (from: Node<E> | undefined, count: Count, delta: number) => void,
  withErrors: Set<Node<E>>,
  ownerNodes: Map<string, Set<Node<E>>>,
): ArrayKit<E> {
  // Marks `node` and its subtree dead and drops them from the store-wide indexes.
  const bury = (node: Node<E>) => {
    node.dead = true;
    withErrors.delete(node);
    if (node.validating) for (const owner of node.validating) ownerNodes.get(owner)?.delete(node);
    if (node.byOwner) for (const owner of node.byOwner.keys()) ownerNodes.get(owner)?.delete(node);
    node.children?.forEach(bury);
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

  // The array node at `path` when it can take an array write: an array, or missing.
  const arrayAt = (path: Path): { node: Node<E>; items: readonly unknown[] } | undefined => {
    const node = fieldAt(path);
    if (!node) return undefined;
    if (Array.isArray(node.value)) return { node, items: node.value };
    if (node.value === undefined || node.value === null) return { node, items: [] };
    return undefined;
  };

  return [
    // Fits the key list to the value. Keys are made here the first time the value is an array.
    (node: Node<E>) => {
      const length = Array.isArray(node.value) ? node.value.length : 0;
      if (!node.list) {
        if (Array.isArray(node.value)) node.list = createKeyList(length);
        return;
      }
      for (const key of resizeKeys(node.list, length)) kill(node, key);
    },
    (path, index, item) => {
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
    (path, index) => {
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
    (path, from, to) => {
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
  ];
}
