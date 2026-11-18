import { isFramework, type Framework } from "./frameworks";
import { LATEST_VERSION } from "./versions";

// The only module that knows the URL scheme. Latest pages are
// `/<framework>/<slug>`, older ones `/<framework>/<version>/<slug>`, and the
// errors page sits outside both at `/errors`.

/** Every framework has this page. Its alternates and redirects fall back to it. */
export const INTRODUCTION_SLUG = "introduction";

export const ERRORS_HREF = "/errors";

/** The errors page, or one entry on it when `code` is given, as in `react:context:form`. */
export const errorsHref = (code?: string): string => (code ? `${ERRORS_HREF}#${code}` : ERRORS_HREF);

export interface DocLocation {
  readonly framework: Framework;
  /** Defaults to the latest version. */
  readonly version?: string;
  /** The entry id, as in `plugins/masks`. */
  readonly slug: string;
}

export function docHref({ framework, version = LATEST_VERSION, slug }: DocLocation): string {
  const segments = version === LATEST_VERSION ? [framework, slug] : [framework, version, slug];
  return `/${segments.join("/")}`;
}

/** A framework's landing page. */
export const frameworkHref = (framework: Framework, version?: string): string =>
  docHref({ framework, version, slug: INTRODUCTION_SLUG });

const VERSION_SEGMENT = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/**
 * The doc a pathname points at, or undefined for a path outside the docs, such
 * as `/` or `/errors`. A bare `/<framework>` reads as its Introduction. A
 * trailing slash and a `.html` suffix are ignored.
 */
export function parsePath(pathname: string): Required<DocLocation> | undefined {
  const segments = pathname
    .replace(/\.html$/, "")
    .split("/")
    .filter((segment) => segment !== "");
  const [framework, ...rest] = segments;
  if (framework === undefined || !isFramework(framework)) return undefined;
  const version = rest[0] !== undefined && VERSION_SEGMENT.test(rest[0]) ? rest.shift()! : LATEST_VERSION;
  return { framework, version, slug: rest.length > 0 ? rest.join("/") : INTRODUCTION_SLUG };
}
