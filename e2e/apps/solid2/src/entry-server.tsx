import { type RenderPage, statusFor } from "@lunarhue/forms-e2e/contract";
import { generateHydrationScript, renderToString } from "@solidjs/web";
import { App } from "@lunarhue/forms-e2e-solid/app";

export const render: RenderPage = (path) => ({
  status: statusFor(path),
  head: generateHydrationScript(),
  body: renderToString(() => <App path={path} />),
});
