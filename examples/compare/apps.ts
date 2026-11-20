// The apps in this package and the libraries each is built with. The Vite
// config, the Playwright config and scripts/size-compare.ts all read this.

export const apps = [
  { name: "signup", title: "Sign-up" },
  { name: "profile", title: "Profile settings" },
  { name: "backoffice", title: "Back office" },
] as const;

export const libraries = [
  { name: "lunarhue", title: "@lunarhue/forms" },
  { name: "tanstack", title: "TanStack Form" },
] as const;

export type AppName = (typeof apps)[number]["name"];
export type LibraryName = (typeof libraries)[number]["name"];
