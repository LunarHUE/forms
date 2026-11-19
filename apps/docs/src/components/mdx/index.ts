import Callout from "./Callout.astro";
import Code from "./Code.astro";
import Only from "./Only.astro";

/** Everything MDX pages can use without importing it. Pass to `<Content components>`. */
export const mdxComponents = { Callout, Code, Only };
