/** One entry on the errors page: the package that raises it and its code. */
export interface ErrorAnchor {
  /** The anchor, `<package>:<code>`, as the packages link to it. */
  readonly id: string;
  /** The package name without its scope, such as `core`. */
  readonly package: string;
  /** The code, `area:name`. */
  readonly code: string;
}

/**
 * Every `<a id="...">` anchor in the errors page's MDX source, in page order.
 * The errors-doc test in core checks the same anchors against the codes in
 * the packages' source.
 */
export function errorAnchors(source: string): ErrorAnchor[] {
  return [...source.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => {
    const id = match[1] ?? "";
    const split = id.indexOf(":");
    if (split <= 0) throw new Error(`errors.mdx: anchor "${id}" has no package`);
    return { id, package: id.slice(0, split), code: id.slice(split + 1) };
  });
}
