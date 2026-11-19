import type { Path } from "../path.js";
import type { Part } from "../plugin.js";

/** What `attach` and `flushPlugins` call on a store's plugin host. */
export interface HostLink {
  /** Attaches `parts` at `path`. See `attach`. */
  attach(path: Path, parts: readonly Part[]): void;
  /** Delivers waiting `deferred` and `idle` records now. */
  flush(): void;
}

/**
 * The host of each store with plugins, by store. In a module of its own so
 * `attach` and `flushPlugins` don't bring the host's code with them.
 */
export const hosts: WeakMap<object, HostLink> = new WeakMap();
