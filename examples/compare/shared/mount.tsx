import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

/** Renders an app into the page's `#root`. */
export function mount(App: ComponentType) {
  const root = document.getElementById("root");
  if (root === null) throw new Error("The page has no #root element.");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
