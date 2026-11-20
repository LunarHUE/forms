/**
 * Where the adapters report the elements their refs get. Empty until
 * `trackElements` sets `record`, so an app that never calls it pays one
 * optional call per ref. In a module of its own so the adapters import the
 * slot without `trackElements`. Internal.
 */
export const tracking: {
  /**
   * Called by an adapter's ref when `element` is recorded for `key`
   * (`added` true) or forgotten (`added` false). `key` is a field handle for
   * a field's elements and the store for its `<form>` element. `adapter`
   * names the adapter, as `"react"` or `"solid"`.
   */
  record?(element: object, key: object, added: boolean, adapter: string): void;
} = {};
