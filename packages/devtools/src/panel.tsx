/** @jsxImportSource preact */
import { render } from "preact";
import type { Hook } from "./hook.js";
import { App } from "./panel/app.js";
import { css } from "./panel/styles.js";

/** The hook version this panel reads. */
const version = 1;

/**
 * Mounts the panel for `hook` and returns the function that unmounts it.
 * The panel renders into a shadow root on a host element at the end of
 * `document.body`, so the page's styles and the panel's stay apart. The
 * collector imports this module the first time the hook turns on, so the
 * panel and Preact are a chunk of their own.
 *
 * A hook of another version comes from another copy of the package. Its
 * members may mean something else, so the panel then says only that.
 */
export function mount(hook: Hook): () => void {
  const host = document.createElement("div");
  host.setAttribute("data-lunarhue-forms-devtools", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const container = document.createElement("div");
  shadow.append(style, container);
  document.body.append(host);
  // Another copy's hook can have any version, whatever its type says.
  const found: number = hook.version;
  render(
    found === version ? (
      <App hook={hook} host={host} />
    ) : (
      <div class="root">
        <div class="dock" data-corner="bottom-left">
          <p class="bar notice surface" role="status">
            {`Forms devtools: the page's devtools are version ${found} and this panel reads version ${version}. Install one version of @lunarhue/forms-devtools.`}
          </p>
        </div>
      </div>
    ),
    container,
  );
  return () => {
    render(null, container);
    host.remove();
  };
}
