import { App } from "@lunarhue/forms-e2e-react/app";
import { appElementId } from "@lunarhue/forms-e2e/contract";
import { hydrateRoot } from "react-dom/client";

const container = document.getElementById(appElementId);
if (container === null) throw new Error(`No #${appElementId} element.`);
hydrateRoot(container, <App path={location.pathname} />);
