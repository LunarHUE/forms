import type { Baseline } from "../baseline.js";
import type { StoreCore } from "../core.js";
import type { PluginHost } from "../plugins.js";
import type { Validation } from "../runner.js";

/** The parts of a form store that commands outside the main entry need. */
export interface StoreParts {
  readonly core: StoreCore<unknown, unknown>;
  readonly baseline: Baseline;
  readonly validation: Validation<unknown>;
  /** The plugin host, when the store has plugins. */
  readonly host: PluginHost | undefined;
}

// The build keeps one output file per source file, so the main entry and the
// subpath entries share this map.
const parts = new WeakMap<object, StoreParts>();

/** Records the parts behind `store`. The form store calls it once, when it is made. */
export function registerStore(store: object, storeParts: StoreParts): void {
  parts.set(store, storeParts);
}

/** The parts behind `store`, or undefined when no form store was made with it. */
export function partsOf(store: object): StoreParts | undefined {
  return parts.get(store);
}
