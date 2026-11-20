import { devtools } from "@lunarhue/forms-devtools";

/** The query parameter that shows the devtools panel, as in `/basic?devtools`. */
export const devtoolsParam = "devtools";

// Read from the URL the first time a form asks, which is in the browser.
let on: boolean | undefined;

/**
 * The devtools every app installs. The apps build in production, so this is
 * the opt-in a production build gets: the panel shows only on pages opened
 * with `?devtools`, and its "Turn off devtools" hides it for the page.
 */
export const devtoolsPlugin = devtools({
  enabled: () => (on ??= typeof location !== "undefined" && new URLSearchParams(location.search).has(devtoolsParam)),
  onDisable: () => {
    on = false;
  },
});
