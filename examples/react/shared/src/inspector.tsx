import { type InspectableStore, mountInspector } from "@lunarhue/forms-example-inspector";
import { invalidOrder, serverSettings } from "@lunarhue/forms-example-order";
import { useEffect, useRef } from "react";

/** Props for `Inspector`. */
export interface InspectorProps {
  /** The store to show, such as `form.store`. */
  readonly store: InspectableStore;
}

/**
 * The dev panel. It renders an empty container and mounts the plain-DOM
 * inspector into it after the first commit, so the server renders only the
 * container and hydration has nothing to match. The inspector subscribes to
 * the store itself, so this component never re-renders because of it.
 */
export function Inspector(props: InspectorProps) {
  const container = useRef<HTMLDivElement>(null);
  const { store } = props;
  useEffect(() => {
    const target = container.current;
    if (target === null) return undefined;
    return mountInspector(target, store, { settings: serverSettings, invalidValue: invalidOrder });
  }, [store]);
  return <div ref={container} />;
}
