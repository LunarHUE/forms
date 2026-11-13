// Type helpers that describe the shape of a form value. Core compiles without
// the DOM lib, so the platform types below come from the consumer's globals.

/** The minimum core relies on in an abort signal. Used only where the environment declares no `AbortSignal`. */
export interface AbortSignalLike {
  /** True once the signal has aborted. */
  readonly aborted: boolean;
  /** The value passed to `abort()`, or undefined before it aborts. */
  readonly reason: unknown;
  /** Throws `reason` when the signal has aborted. */
  throwIfAborted(): void;
}

/**
 * The environment's `AbortSignal`. It is the global `AbortSignal` type when
 * the DOM lib or Node's types declare one, so it can be passed to `fetch`.
 * Without one it is `AbortSignalLike`.
 */
export type PlatformAbortSignal = typeof globalThis extends { readonly AbortSignal: { readonly prototype: infer S } }
  ? S
  : AbortSignalLike;

/** The environment's `Blob` type, or `never` when the environment declares none. */
export type PlatformBlob = typeof globalThis extends { readonly Blob: { readonly prototype: infer B } } ? B : never;

/** The environment's `File` type, or `never` when the environment declares none. */
export type PlatformFile = typeof globalThis extends { readonly File: { readonly prototype: infer F } } ? F : never;

/**
 * Values a form treats as a single leaf: primitives, `Date`, `Blob` and
 * `File`, `Map`, `Set` and functions. A leaf gets a leaf handle, has no child
 * handles, and is never made readonly or partial by the helpers here.
 */
export type LeafValue =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  | Date
  // `File` extends `Blob`, so this covers files. It is `never` without a DOM or Node lib.
  // oxlint-disable-next-line typescript/no-redundant-type-constituents
  | PlatformBlob
  | ReadonlyMap<unknown, unknown>
  | ReadonlySet<unknown>
  | ((...args: never[]) => unknown);

/**
 * `T` made readonly at every depth. Objects get readonly properties, arrays
 * become readonly arrays, and leaves (see `LeafValue`) stay as they are.
 * `unknown` and `any` stay as they are.
 */
// The check type is T itself, so TypeScript measures snapshots as covariant in T.
export type DeepReadonly<T> = T extends LeafValue
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * `T` with every object key optional, at every depth. Arrays and leaves are
 * taken whole. A key set to undefined counts as missing.
 */
export type DeepPartial<T> = unknown extends T
  ? T
  : T extends LeafValue | readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> | undefined }
      : T;

/**
 * The child keys of an object value. For a union of objects it is every key
 * of every member. `null` and `undefined` in `V` add no keys.
 */
export type KeysOf<V> = V extends object ? Extract<keyof V, string | number> : never;

/**
 * The value at key `K` of `V`. For a union it is the union of that key's type
 * across members, with `undefined` for members that lack the key and for
 * `null` or `undefined` members.
 */
export type ChildValue<V, K extends PropertyKey> = V extends object ? (K extends keyof V ? V[K] : undefined) : undefined;

/** The item type of an array value. `null` and `undefined` in `V` are ignored. */
export type ItemOf<V> = NonNullable<V> extends readonly (infer I)[] ? I : never;

/** True when `V` is `unknown` or `any`. */
export type IsUnknown<V> = unknown extends V ? true : false;

/**
 * Which handle a value gets. `null` and `undefined` don't count, so
 * `Address | undefined` is an object. A union that mixes leaves with objects
 * or arrays is a leaf. `unknown` and `any` are `"any"`.
 */
export type ShapeOf<V> =
  IsUnknown<V> extends true
    ? "any"
    : [NonNullable<V>] extends [LeafValue]
      ? "leaf"
      : [NonNullable<V>] extends [readonly unknown[]]
        ? "array"
        : [NonNullable<V>] extends [object]
          ? "object"
          : "leaf";
