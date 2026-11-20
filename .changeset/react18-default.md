---
"@lunarhue/forms-react": minor
---

React 18 is now the default build. It calls React's own `useSyncExternalStore` and `useId` and leaves out the fallbacks for React 16.8 and 17, which saves about 200 B brotli. The fallbacks moved to a legacy build that an app picks with the `@lunarhue/react-legacy` resolve condition. On React 16.8 or 17 without it, a development build throws `react:legacy` when the adapter loads.

Apps on React 18 or 19 change nothing. Apps on React 16.8 or 17 add the condition to their bundler:

```ts
// Vite
resolve: { conditions: ["@lunarhue/react-legacy", ...defaultClientConditions] },
ssr: {
  resolve: {
    conditions: ["@lunarhue/react-legacy", ...defaultServerConditions],
    externalConditions: ["@lunarhue/react-legacy"],
  },
},

// webpack or Rspack
resolve: { conditionNames: ["@lunarhue/react-legacy", "..."] }

// esbuild. Custom conditions drop the default `module`, so list it again.
conditions: ["@lunarhue/react-legacy", "module"]

// Next with webpack
webpack(config) {
  config.resolve.conditionNames = ["@lunarhue/react-legacy", ...(config.resolve.conditionNames ?? ["..."])];
  return config;
}

// Next with Turbopack, which has no conditions setting
turbopack: { resolveAlias: { "#lunarhue/react": "@lunarhue/forms-react/legacy" } }
```

A server that loads the adapter from `node_modules` without bundling it runs Node with `NODE_OPTIONS=--conditions=@lunarhue/react-legacy`.
