import { type InspectableStore, type InspectorOptions, mountInspector } from "@lunarhue/forms-example-inspector";
import { useEffect, useRef } from "react";

/** Props for `Inspector`. */
export interface InspectorProps {
  /** The store to show, such as `form.store`. */
  readonly store: InspectableStore;
  /** The fake server's settings, for the "slow network" and "server rejects next save" toggles. */
  readonly settings?: InspectorOptions["settings"];
  /** A value that breaks the form's rules, for the "fill with invalid data" button. */
  readonly invalidValue?: unknown;
}

/**
 * The dev panel. It renders an empty container and mounts the plain-DOM
 * inspector into it after the first commit, so the server renders only the
 * container and hydration has nothing to match. The inspector subscribes to
 * the store itself, so this component never re-renders because of it.
 * Without `settings` and `invalidValue` it leaves those controls out, so it
 * fits any form.
 */
export function Inspector({ store, settings, invalidValue }: InspectorProps) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = container.current;
    if (target === null) return undefined;
    return mountInspector(target, store, {
      ...(settings === undefined ? {} : { settings }),
      ...(invalidValue === undefined ? {} : { invalidValue }),
    });
  }, [store, settings, invalidValue]);
  return <div ref={container} />;
}
