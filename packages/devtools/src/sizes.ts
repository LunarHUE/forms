/**
 * What a bundler plugin measures in an app's production build. The panel's
 * Bundle tab fetches it from the URL the plugin defines as
 * `__LUNARHUE_FORMS_SIZES__`.
 */
export interface SizeReport {
  readonly version: 1;
  /** The bundler that measured the build, such as `"vite"`. */
  readonly bundler: string;
  /** When the build ran, as an ISO 8601 time. */
  readonly builtAt: string;
  /** The whole app's JavaScript. Compressed sizes don't add up across parts, so only the total has one. */
  readonly total: { readonly minified: number; readonly gzip: number };
  readonly parts: readonly SizePart[];
}

/**
 * The bytes one part of the forms packages adds to the build. The panel finds
 * a part by `kind` and `name`: `"core"` is named `"@lunarhue/forms-core"`, an
 * adapter by the name it reports to the devtools (`"react"`, `"solid"`), a
 * plugin by its `name`, and `"devtools"` is this package.
 */
export interface SizePart {
  readonly kind: "core" | "adapter" | "plugin" | "devtools";
  readonly name: string;
  /** Minified bytes. */
  readonly minified: number;
  /** The output chunks the part's code ended up in. */
  readonly chunks: readonly string[];
}

// The bundler plugin's define names this global, so it keeps its underscores.
/* oxlint-disable no-underscore-dangle */
/** Set by a bundler plugin to the URL of the build's size report. */
declare const __LUNARHUE_FORMS_SIZES__: string | undefined;

/** The size report's URL, when a bundler plugin defined one. */
export const sizesUrl = (): string | undefined =>
  typeof __LUNARHUE_FORMS_SIZES__ === "string" ? __LUNARHUE_FORMS_SIZES__ : undefined;
/* oxlint-enable no-underscore-dangle */
