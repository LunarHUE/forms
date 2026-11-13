import type { NextConfig } from "next";

const config: NextConfig = {
  // Runs the React Compiler over the app and the shared example packages, as
  // it runs over the adapter in this repo's tests.
  reactCompiler: true,
  // On by default in the App Router. Set here because the render badges
  // account for StrictMode's double mount in development.
  reactStrictMode: true,
  // The example packages ship TypeScript source, so Next compiles them like
  // app code. The library packages are built to `dist` and need nothing.
  transpilePackages: [
    "@lunarhue/forms-example-inspector",
    "@lunarhue/forms-example-order",
    "@lunarhue/forms-example-react",
  ],
};

export default config;
