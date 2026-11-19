import { App } from "@lunarhue/forms-e2e-react-shared/app";
import { type RenderPage, statusFor } from "@lunarhue/forms-e2e/contract";
import { renderToString } from "react-dom/server";

export const render: RenderPage = (path) => ({
  status: statusFor(path),
  head: "",
  body: renderToString(<App path={path} />),
});
