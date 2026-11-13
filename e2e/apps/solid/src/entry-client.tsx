import { appElementId } from "@lunarhue/forms-e2e/contract";
import { hydrate } from "@solidjs/web";
import { App } from "./app.js";

const container = document.getElementById(appElementId);
if (container === null) throw new Error(`No #${appElementId} element.`);
hydrate(() => <App path={location.pathname} />, container);
