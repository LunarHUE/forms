import type { Many } from "../errors.js";
import type { AnyFieldHandle as Loose, HandleBase, ResetOptions, ValueOf, WriteOptions } from "../handle.js";
import type { Path, PathSegment } from "../path.js";
import type { AnyFormStore } from "../store.js";
import type { ValidatorInput } from "../validator.js";
import type { StoreCore } from "./core.js";
import { freeze } from "./freeze.js";
import { fieldId } from "./ids.js";
import { isPlainObject, merge } from "./tree.js";
import type { Validation } from "./runner.js";

/** A handle as core makes it. Its snapshots have `dirty` with or without `dirty()`. */
export type Handle<E> = Loose<E, "dirty">;

/** An item's handle at runtime. */
export type AnyItemHandle<E> = Handle<E> & { readonly key: string };

/** What handles need from the form store. */
export interface HandleDeps<E, I, R> {
  readonly core: StoreCore<E, I, R>;
  /** The public store. Handles are only made once it exists. */
  readonly store: () => AnyFormStore<E>;
  readonly validation: Validation<E>;
  /** Resets the subtree at a live path. */
  readonly reset: (path: Path, options?: ResetOptions) => void;
  /** The item `push` and `insert` add when called without one. Gets the array's stable path. */
  readonly itemValue: (path: Path) => unknown;
}

/** The handle tree of one store. */
export interface Handles<E> {
  /** The root handle, made on first call. */
  root(): Handle<E>;
  /** The handle at `path`, or undefined when the path can't name a field. */
  fieldAt(this: void, path: Path): Handle<E> | undefined;
}

const isList = <E>(errors: Many<E>): errors is readonly E[] => Array.isArray(errors);

/** One error or a list of them, as a list. */
export const errorList = <E>(errors: Many<E>): readonly E[] => (isList(errors) ? errors : [errors]);

const noop = () => {};

// A function argument to `setValue` is an updater. A function-typed value is written through one.
const isUpdater = (value: unknown): value is (previous: unknown) => unknown => typeof value === "function";

/**
 * Makes the handle tree. Handles are cached by stable path and hold nothing
 * that changes, and making one touches nothing in the store.
 */
export function createHandles<E, I, R>(deps: HandleDeps<E, I, R>): Handles<E> {
  const { core, validation } = deps;

  // Every write is a user edit unless `edited: false`. A user edit that
  // changed the value also marks the field edited, clears the user errors at
  // and below it, and tells validation, all in one batch so listeners run once.
  // A write with `edited: false` that changed the value only tells validation,
  // so validators that already run there see the new value.
  // Core doesn't block writes to a disabled or read-only field. The adapter
  // reads both from the snapshot and decides what the input allows.
  const write = (path: Path, options: WriteOptions | undefined, run: () => boolean) => {
    if (!core.isLive(path)) return;
    core.batch(() => {
      if (!run()) return;
      if (options?.edited === false) {
        validation.changed([path]);
        return;
      }
      core.markEdited(path);
      core.clearUserErrors(path);
      validation.written(path);
    });
  };

  // An undefined item counts as no item, so `push(undefined, options)` adds the default item.
  const insertAt = (path: Path, index: number, item: unknown, options: WriteOptions | undefined) =>
    write(path, options, () => core.insert(path, index, item === undefined ? deps.itemValue(path) : item) !== undefined);

  function make(path: Path, key: string): AnyItemHandle<E>;
  function make(path: Path, key: undefined): Handle<E>;
  function make(path: Path, key: string | undefined): Handle<E> {
    // The child caches. Object children and array items are cached apart,
    // since only an item handle has `key`.
    let children: Map<string, Handle<E>> | undefined;
    let items: Map<string, AnyItemHandle<E>> | undefined;
    const below = (seg: string): Path => Object.freeze([...path, seg]);

    const handle: Handle<E> = {
      id: fieldId(core.id, path),
      path,
      store: deps.store(),
      ...(key === undefined ? {} : { key }),
      peek: () => core.getSnapshot(path),
      handleBlur() {
        if (!core.isLive(path)) return;
        core.batch(() => {
          core.setTouched(path, true);
          validation.blurred(path);
        });
      },
      setTouched(touched = true) {
        core.setTouched(path, touched);
      },
      setErrors(errors) {
        core.setUserErrors(path, errorList(errors));
      },
      validate: () => (core.isLive(path) ? validation.validate(path) : Promise.resolve(true)),
      registerValidator<H extends HandleBase<unknown, E>>(this: H, validator: ValidatorInput<ValueOf<H>, E>) {
        if (!core.isLive(path)) return noop;
        // Validation runs a validator on this field's value, which is the type it was written for.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return validation.register(path, validator as ValidatorInput<unknown, E>);
      },
      reset(options) {
        if (core.isLive(path)) deps.reset(path, options);
      },
      setDisabled(on) {
        core.setDisabled(path, on);
      },
      setReadOnly(on) {
        core.setReadOnly(path, on);
      },
      setValue(value, options) {
        write(path, options, () => {
          const previous = core.getSnapshot(path).value;
          let next = isUpdater(value) ? value(previous) : value;
          // Merge into a plain object or a missing one, else replace.
          const mergeable = isPlainObject(previous) || previous === undefined || previous === null;
          if (options?.replace !== true && isPlainObject(next) && mergeable) next = merge(previous, next);
          return core.set(path, next);
        });
      },
      at(segment: PathSegment) {
        const seg = String(segment);
        let child = children?.get(seg);
        if (!child) (children ??= new Map()).set(seg, (child = make(below(seg), undefined)));
        return child;
      },
      item(itemKey) {
        let child = items?.get(itemKey);
        if (!child) (items ??= new Map()).set(itemKey, (child = make(below(itemKey), itemKey)));
        return child;
      },
      push(item, options) {
        insertAt(path, Number.MAX_SAFE_INTEGER, item, options);
      },
      insert(index, item, options) {
        insertAt(path, index, item, options);
      },
      remove(index, options) {
        write(path, options, () => core.remove(path, index) !== undefined);
      },
      move(from, to, options) {
        write(path, options, () => core.move(path, from, to));
      },
    };
    return freeze(handle);
  }

  let root: Handle<E> | undefined;
  const rootHandle = () => (root ??= make(Object.freeze([]), undefined));

  return {
    root: rootHandle,
    fieldAt(path) {
      const steps = core.itemSteps(path);
      if (!steps) return undefined;
      let handle = rootHandle();
      for (const [i, segment] of path.entries()) handle = steps[i] === true ? handle.item(String(segment)) : handle.at(segment);
      return handle;
    },
  };
}
