import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { appConfig, pinFramework } from "../../vite.base.ts";

// React 16.8 ships no JSX runtime, so the JSX Vite compiles calls this one.
const jsxRuntime = fileURLToPath(new URL("src/jsx-runtime.ts", import.meta.url));

export default defineConfig(({ isSsrBuild }) =>
  appConfig(
    [
      pinFramework(["react", "react-dom"], {
        "react/jsx-runtime": jsxRuntime,
        "react/jsx-dev-runtime": jsxRuntime,
      }),
    ],
    isSsrBuild === true,
  ),
);
