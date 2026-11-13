import { defineConfig } from "vite";
import { appConfig } from "../../vite.base.ts";

// Vite compiles the JSX itself, from the tsconfig's `react-jsx`.
export default defineConfig(({ isSsrBuild }) => appConfig([], isSsrBuild === true));
