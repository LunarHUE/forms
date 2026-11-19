import Code from "./Code.astro";
import Demo from "./Demo.astro";
import Only from "./Only.astro";

/** Everything MDX pages can use without importing it. Pass to `<Content components>`. */
export const mdxComponents = { Code, Demo, Only };
