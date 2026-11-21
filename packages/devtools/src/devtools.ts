import { type NamedAnyFieldHandle, type AnyFormStore, type Plugin, trackElements } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { type FormEntry, type Hook, hookKey, logCap, ring } from "./hook.js";

/** What `devtools()` takes. */
export interface DevtoolsOptions {
  /**
   * Whether the panel shows for this form. A function is read when the
   * form mounts, after each write and on `syncDevtools()`. The panel shows
   * while any form's reads true. Defaults to true. The plugin never reads
   * `NODE_ENV`: to leave it out of production, write `dev && devtools()`.
   */
  readonly enabled?: boolean | (() => boolean);
  /** Shows "Turn off devtools" in the panel, which calls this. Set what `enabled` reads to false here. */
  readonly onDisable?: () => void;
}

/** `globalThis`, with the hook's slot typed. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const page = globalThis as { [hookKey]?: Hook };

// What the element listener saw, kept from the first `devtools()` call on,
// before the hook exists.
const elements = new WeakMap<object, Set<Element>>();
const keys = new WeakMap<Element, object>();
/** The adapter of each store, from its first element event. */
const adapters = new WeakMap<object, string>();
/** The registered entry of each store. */
const entries = new WeakMap<object, FormEntry>();

/** The panel module, imported the first time a hook turns on. */
let panel: Promise<typeof import("./panel.js")> | undefined;
/** The last form id handed out. */
let count = 0;

/** The `trackElements` listener. It keeps both directions of the element map and each store's adapter. */
function listen(element: object, key: object, added: boolean, adapter: string): void {
  // Adapters only report elements.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const node = element as Element;
  let set = elements.get(key);
  if (added) {
    if (!set) elements.set(key, (set = new Set()));
    set.add(node);
    keys.set(node, key);
  } else {
    set?.delete(node);
    if (keys.get(node) === key) keys.delete(node);
  }
  // A handle has a path and its store. A key without one is the store.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const store = "path" in key ? (key as NamedAnyFieldHandle<unknown>).store : key;
  if (adapters.has(store)) return;
  adapters.set(store, adapter);
  const entry = entries.get(store);
  if (entry) entry.adapter ??= adapter;
}

function createHook(): Hook {
  const listeners = new Set<() => void>();
  // The ids seen by the last `sync`, so it can tell listeners a form came or
  // went. Registering calls `sync`, so the hook needs no other entry point,
  // and a second copy of this package on the page still notifies.
  let seen: number[] = [];
  let unmount: (() => void) | undefined;
  const hook: Hook = {
    version: 1,
    forms: new Map(),
    on: false,
    sync() {
      let on = false;
      // Every entry is read, not just up to the first true one.
      for (const entry of hook.forms.values()) if (entry.enabled()) on = true;
      const ids = [...hook.forms.keys()];
      const changed = ids.length !== seen.length || ids.some((id, index) => id !== seen[index]);
      seen = ids;
      if (on !== hook.on) {
        hook.on = on;
        if (on) {
          panel ??= import("./panel.js");
          void panel.then((module) => {
            if (hook.on && !unmount) unmount = module.mount(hook);
          });
        } else {
          unmount?.();
          unmount = undefined;
          for (const entry of hook.forms.values()) {
            entry.writes.clear();
            entry.lastWrite.clear();
            entry.submissions.clear();
          }
        }
      } else if (!changed) return;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    elementsOf: (key) => [...(elements.get(key) ?? [])].filter((element) => element.isConnected),
    keyOf: (element) => keys.get(element),
  };
  return hook;
}

/** The page's hook, made on first use. */
function hookNow(): Hook {
  return (page[hookKey] ??= createHook());
}

/**
 * The forms devtools collector. Install it on the forms to inspect,
 * usually through `createForms({ plugins: [devtools()] })`. Each form
 * registers with the page's devtools while it is mounted, and the panel
 * loads as a chunk of its own the first time a form's `enabled` reads true.
 *
 * Calling it starts `trackElements()`, so `fieldOf` works in production
 * from then on. `dev && devtools()` leaves all of it out.
 */
export function devtools(options: DevtoolsOptions = {}): Plugin<undefined, "devtools"> {
  trackElements(listen);
  const { enabled = true, onDisable } = options;
  const read = typeof enabled === "function" ? enabled : () => enabled;
  return definePlugin({
    name: "devtools",
    // It runs on the server too, so it only builds the entry. `onActive` touches the page.
    setup(ctx) {
      const store: AnyFormStore<unknown> = ctx.store;
      const entry: FormEntry = {
        store,
        ctx,
        enabled: read,
        onDisable,
        adapter: undefined,
        writes: ring(logCap),
        lastWrite: new Map(),
        submissions: ring(logCap),
      };
      let seq = 0;
      let hook: Hook | undefined;
      return {
        when: "sync",
        onActive() {
          const active = hookNow();
          hook = active;
          entry.adapter = adapters.get(store);
          while (active.forms.has(++count));
          const id = count;
          active.forms.set(id, entry);
          entries.set(store, entry);
          active.sync();
          return () => {
            hook = undefined;
            active.forms.delete(id);
            entries.delete(store);
            active.sync();
          };
        },
        onWrite(records) {
          if (!hook) return;
          hook.sync();
          if (!hook.on) return;
          for (const record of records) {
            seq++;
            entry.writes.push({ seq, at: Date.now(), record });
            entry.lastWrite.set(JSON.stringify(record.path), seq);
          }
        },
        beforeSubmit() {
          if (hook?.on) entry.submissions.push({ seq: ++seq, status: "open" });
          return undefined;
        },
        onSubmitted(submission) {
          const { items } = entry.submissions;
          // The newest open one. `findLast` is past the ES2020 the package targets.
          for (let index = items.length - 1; index >= 0; index--) {
            const logged = items[index];
            if (logged?.status === "open") {
              logged.status = submission.status;
              return;
            }
          }
        },
        onReset(path) {
          if (path.length > 0) return;
          for (const logged of entry.submissions.items) if (logged.status === "open") logged.status = "aborted";
        },
      };
    },
  })();
}

/** Reads every installed form's `enabled` now and shows or hides the panel to match. */
export function syncDevtools(): void {
  page[hookKey]?.sync();
}
