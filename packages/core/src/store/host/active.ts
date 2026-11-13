import type { HostPart } from "../plugins.js";

/** The part behind `onActive`: it runs when the store gets its first listener, and its cleanup after the last goes. */
export const active: HostPart = (host) => {
  const { core } = host;
  let listeners = 0;
  const counted =
    <A extends unknown[]>(subscribe: (...args: A) => () => void) =>
    (...args: A) => {
      let off: (() => void) | undefined = subscribe(...args);
      if (listeners++ === 0) {
        for (const entry of host.entries) entry.off = host.call(entry, () => entry.hooks.onActive?.(), undefined);
        host.drain();
      }
      return () => {
        if (!off) return;
        off();
        off = undefined;
        if (--listeners === 0) for (const entry of host.entries) if (entry.off) host.call(entry, entry.off, undefined);
      };
    };
  core.subscribe = counted(core.subscribe);
  core.subscribeForm = counted(core.subscribeForm);
};
