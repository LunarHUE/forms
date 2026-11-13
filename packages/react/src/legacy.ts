// The entry for React 16.8 and 17: the main entry with fallbacks for the
// hooks React 18 added. It swaps them in when it loads, which is why
// package.json lists this file under `sideEffects`.
import { hooks } from "./compat.js";
import { fallbacks } from "./fallback.js";

Object.assign(hooks, fallbacks);

export * from "./index.js";
