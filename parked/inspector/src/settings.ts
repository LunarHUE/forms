// Settings for a fake server, for the inspector's "slow network" and
// "server rejects next save" toggles. The inspector writes them. The page
// that mounts it reads them in its own fake server.

/** The server delay when the network is normal, in milliseconds. */
export const normalDelayMs = 300;
/** The server delay when "slow network" is on, in milliseconds. */
export const slowDelayMs = 2000;

/** How the fake server behaves. */
export interface ServerSettingsState {
  /** How long every server call waits before it answers, in milliseconds. */
  readonly delayMs: number;
  /** True makes the next save fail. The page's server turns it off again. */
  readonly reject: boolean;
}

/** A small observable holding `ServerSettingsState`. */
export interface ServerSettings {
  /** Returns the current state. The same object until `set` changes something. */
  get(): ServerSettingsState;
  /** Merges `patch` into the state and calls every listener when anything changed. */
  set(patch: Partial<ServerSettingsState>): void;
  /** Calls `listener` after every change. Returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

/** Makes a settings object, starting from a normal network that accepts saves. */
export function createServerSettings(initial: Partial<ServerSettingsState> = {}): ServerSettings {
  let state: ServerSettingsState = { delayMs: normalDelayMs, reject: false, ...initial };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      if (next.delayMs === state.delayMs && next.reject === state.reject) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
