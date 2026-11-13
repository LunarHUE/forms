import { type RenderPage, statusFor } from "@lunarhue/forms-e2e/contract";
import { renderToString } from "react-dom/server";
import { App } from "./app.js";

export const render: RenderPage = (path) => ({
  status: statusFor(path),
  head: "",
  body: renderToString(<App path={path} />),
});
