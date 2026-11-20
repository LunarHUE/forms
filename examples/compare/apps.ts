// The apps in this package and the libraries each is built with. The Vite
// config, the Playwright config and scripts/size-compare.ts all read this.

export const libraries = [
  { name: "lunarhue", title: "@lunarhue/forms" },
  { name: "tanstack", title: "TanStack Form" },
] as const;

export type LibraryName = (typeof libraries)[number]["name"];

interface App {
  readonly name: string;
  readonly title: string;
  /** The libraries the app is built with so far, when not all of them. */
  readonly only?: readonly LibraryName[];
}

export const apps = [
  { name: "signup", title: "Sign-up" },
  { name: "profile", title: "Profile settings" },
  { name: "backoffice", title: "Back office" },
] as const satisfies readonly App[];

export type AppName = (typeof apps)[number]["name"];

/** The libraries `app` is built with. */
export function librariesOf(app: App): readonly (typeof libraries)[number][] {
  return libraries.filter((library) => app.only === undefined || app.only.includes(library.name));
}
