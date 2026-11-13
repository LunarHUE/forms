import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import { appConfig } from "../../vite.base.ts";

// `ssr: true` compiles hydratable DOM code for the client and SSR code for the server.
export default defineConfig(({ isSsrBuild }) => appConfig([solid({ ssr: true })], isSsrBuild === true));
