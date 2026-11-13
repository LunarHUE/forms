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

/** True when `T` has more than one member. */
type IsUnion<T, All = T> = T extends unknown ? ([All] extends [T] ? false : true) : never;

/** True when every member of `T` is a plain object: not a leaf and not an array. */
type IsPlainObjects<T> = [T] extends [object] ? ([Extract<T, LeafValue | readonly unknown[]>] extends [never] ? true : false) : false;

/**
 * True when a union has no empty value for an adapter to start from: two or
 * more members besides `null` and `undefined`, where `boolean` counts as one
 * member. A union of plain objects doesn't count, since it is read as a
 * discriminated union.
 */
type IsPlainUnion<T, N = NonNullable<T>, R = Exclude<N, boolean>> = [R] extends [never]
  ? false
  : [Extract<N, boolean>] extends [never]
    ? IsPlainObjects<R> extends true
      ? false
      : true extends IsUnion<R>
        ? true
        : false
    : true;

/** True for a string, number or bigint literal, or a boolean. False for a wide `string`, `number` or `bigint` and for anything else. */
type IsLiteral<T> = T extends string
  ? string extends T
    ? false
    : true
  : T extends number
    ? number extends T
      ? false
      : true
    : T extends bigint
      ? bigint extends T
        ? false
        : true
      : T extends boolean
        ? true
        : false;

/**
 * True when `T` is a union of literals, such as a picklist's value: two or
 * more members besides `null` and `undefined`, each a literal or `boolean`.
 * A plain `boolean` doesn't count.
 */
export type IsLiteralUnion<T> = IsPlainUnion<T> extends true ? (false extends IsLiteral<NonNullable<T>> ? false : true) : false;

/**
 * `Draft` of an array item. A union of literals stays as it is: in an array
 * of picked options a missing option is a missing item, not an empty one.
 */
type DraftItem<T> = unknown extends T ? T : IsLiteralUnion<T> extends true ? T : Draft<T>;

/** `Draft` of one union member. */
type DraftMember<T> = T extends string | boolean | null | undefined
  ? T
  : T extends number | bigint
    ? number extends T
      ? T | undefined
      : bigint extends T
        ? T | undefined
        : T
    : T extends LeafValue
      ? T | undefined
      : T extends readonly unknown[]
        ? number extends T["length"]
          ? { [K in keyof T]: DraftItem<T[K]> }
          : { [K in keyof T]: Draft<T[K]> } | undefined
        : { [K in keyof T]: Draft<T[K]> };

/**
 * The value a form holds before the user fills it in, when a schema adapter
 * builds its defaults. Strings and booleans stay as they are, since they
 * start at `""` and `false`. A single string, number or bigint literal stays
 * as it is, since it starts at its value. Arrays become arrays of drafts,
 * except that an array of a union of literals keeps its items as they are:
 * a checkbox group leaves an unpicked option out instead of holding an
 * empty item. Tuples become tuples of drafts or `undefined`. Plain objects
 * get a draft of each property and keep their modifiers. A union of plain objects is
 * read as a discriminated union and gets a draft of each member. Every other
 * value, including `number`, `Date` and unions of literals, may also be
 * `undefined`. A class instance other than the leaves in `LeafValue` can't be
 * told apart from a plain object, so it is drafted as one. `unknown` and
 * `any` stay as they are.
 */
export type Draft<T> = unknown extends T ? T : IsPlainUnion<T> extends true ? DraftMember<T> | undefined : DraftMember<T>;
