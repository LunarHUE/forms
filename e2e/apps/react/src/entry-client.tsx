import { appElementId } from "@lunarhue/forms-e2e/contract";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app.js";

const container = document.getElementById(appElementId);
if (container === null) throw new Error(`No #${appElementId} element.`);
hydrateRoot(container, <App path={location.pathname} />);
