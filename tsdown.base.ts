import type { UserConfig } from "tsdown";

// Shared JS build for every package. Each package's tsdown.config.ts is
// `export default libraryBuild()`. Declarations come from tsc, not tsdown.
//
// Output is unbundled ESM in dist/esm and CJS in dist/cjs, both with plain .js
// extensions. dist/cjs gets a package.json marking it CommonJS, so the nearest
// package.json decides the format and one set of tsc .d.ts files works in both trees.

const shared: UserConfig = {
  // Tests, benchmarks and their fixtures under src/bench never ship.
  entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.test-d.ts", "!src/**/*.bench.ts", "!src/bench/**"],
  root: "src",
  unbundle: true,
  target: "es2020",
  platform: "neutral",
  // The typecheck tsconfig sets the @lunarhue/source condition; builds must not.
  tsconfig: "tsconfig.build.json",
  // tsdown turns dts on when package.json has `types`; tsc writes declarations.
  dts: false,
  hash: false,
  cjsDefault: false,
  // Never inline anything from node_modules, devDependencies included.
  deps: { neverBundle: true },
  outExtensions: () => ({ js: ".js" }),
  failOnWarn: true,
};

export function libraryBuild(): UserConfig[] {
  return [
    { ...shared, format: "esm", outDir: "dist/esm" },
    {
      ...shared,
      format: "cjs",
      outDir: "dist/cjs",
      plugins: [
        {
          name: "lunarhue:cjs-package-json",
          generateBundle() {
            this.emitFile({
              type: "asset",
              fileName: "package.json",
              source: `${JSON.stringify({ type: "commonjs" })}\n`,
            });
          },
        },
      ],
    },
  ];
}
