import type { PackageManager } from "@/lib/store";

const ADD: Record<PackageManager, string> = {
  bun: "bun add",
  npm: "npm install",
  pnpm: "pnpm add",
  yarn: "yarn add",
};

/** The command that installs `packages` with `pm`. */
export const installCommand = (pm: PackageManager, packages: readonly string[]): string =>
  `${ADD[pm]} ${packages.join(" ")}`;
