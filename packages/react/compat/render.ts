import * as React from "react";
import { createElement, type ReactElement, StrictMode } from "react";
import * as ReactDOM from "react-dom";
import * as TestUtils from "react-dom/test-utils";

// A small stand-in for Testing Library's `render`, which needs React 18. It
// renders with `ReactDOM.render` on 16 and 17 and with `createRoot` on 18 and
// 19, always under <StrictMode>, into a container in the document.

/** The React version under test, as `[major, minor]`. */
export const version: readonly [number, number] = [
  Number(React.version.split(".")[0]),
  Number(React.version.split(".")[1]),
];

/** True on React 18 and later, which have `useId` and `useSyncExternalStore`. */
export const modern = version[0] >= 18;

/** The `react-dom` calls React 19 removed. */
interface LegacyDom {
  render(element: ReactElement, container: Element): void;
  hydrate(element: ReactElement, container: Element): void;
  unmountComponentAtNode(container: Element): boolean;
}

/** What the tests use from `react-dom/client`. */
interface Client {
  readonly createRoot: (container: Element) => { render(element: ReactElement): void; unmount(): void };
  readonly hydrateRoot: (
    container: Element,
    element: ReactElement,
    options: { onRecoverableError(error: unknown): void },
  ) => { unmount(): void };
}

// The types are React 19's, which lack the calls 16 and 17 have.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const legacy = ReactDOM as unknown as LegacyDom;

// React 18.3 and 19 have `act` on React itself and deprecate the one in test-utils.
const reactAct: Partial<Pick<typeof React, "act">> = React;
const baseAct = reactAct.act ?? TestUtils.act;

// `act` takes an async callback from React 16.9.
const asyncAct = version[0] > 16 || version[1] >= 9;

/**
 * Runs `work` inside `act` and waits for it. On React 16.8, whose `act` is
 * synchronous only, the part of `work` after its first `await` runs outside
 * `act`, where legacy rendering applies updates at once anyway.
 */
export async function act(work: () => unknown): Promise<void> {
  if (asyncAct) {
    await baseAct(async () => {
      await work();
    });
    return;
  }
  let result: unknown;
  baseAct(() => {
    result = work();
  });
  await result;
}

const client = async (): Promise<Client> => {
  // A variable keeps Vite from resolving the path on React 16 and 17, which lack it.
  const path = "react-dom/client";
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await import(/* @vite-ignore */ path)) as Client;
};

const unmounts = new Set<() => Promise<void>>();

/** A rendered tree. */
export interface Rendered {
  readonly container: HTMLElement;
  readonly unmount: () => Promise<void>;
}

function track(container: HTMLElement, stop: () => void): Rendered {
  const unmount = async () => {
    if (!unmounts.delete(unmount)) return;
    await act(stop);
    container.remove();
  };
  unmounts.add(unmount);
  return { container, unmount };
}

const strict = (element: ReactElement): ReactElement => createElement(StrictMode, null, element);

/** Renders `element` into a new container in the document. */
export async function render(element: ReactElement): Promise<Rendered> {
  const container = document.body.appendChild(document.createElement("div"));
  if (!modern) {
    await act(() => legacy.render(strict(element), container));
    return track(container, () => legacy.unmountComponentAtNode(container));
  }
  const root = (await client()).createRoot(container);
  await act(() => root.render(strict(element)));
  return track(container, () => root.unmount());
}

/**
 * Hydrates server HTML already in `container`. Errors React 18 and 19 recover
 * from go to `onRecoverableError`.
 */
export async function hydrate(container: HTMLElement, element: ReactElement, onRecoverableError: (error: unknown) => void): Promise<Rendered> {
  if (!modern) {
    await act(() => legacy.hydrate(strict(element), container));
    return track(container, () => legacy.unmountComponentAtNode(container));
  }
  const { hydrateRoot } = await client();
  let root: { unmount(): void } | undefined;
  await act(() => {
    root = hydrateRoot(container, strict(element), { onRecoverableError });
  });
  return track(container, () => root?.unmount());
}

/** Unmounts everything still rendered. */
export async function cleanup(): Promise<void> {
  for (const unmount of unmounts) await unmount();
}
