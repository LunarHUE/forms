import { appElementId } from "@lunarhue/forms-e2e/contract";
import { hydrate } from "solid-js/web";
import { App } from "@lunarhue/forms-e2e-solid-shared/app";

const container = document.getElementById(appElementId);
if (container === null) throw new Error(`No #${appElementId} element.`);
hydrate(() => <App path={location.pathname} />, container);
