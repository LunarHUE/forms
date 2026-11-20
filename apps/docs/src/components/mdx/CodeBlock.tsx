import { cn } from "cn";
import type { ReactNode } from "react";

export interface CodeBlockProps {
  /** Markup from `highlight()` in `lib/highlight.ts`: a Shiki `<pre>`. */
  html: string;
  /** Language, written to `data-lang`. */
  lang?: string;
  /** Filename or label. With a title the block gets a header bar. */
  title?: ReactNode;
  /** Number the lines. Default false. */
  lineNumbers?: boolean;
  /**
   * Buttons for the top-right corner, usually a hydrated `CopyButton`. From
   * Astro, pass them as `slot="actions"` children so they stay islands while
   * the block itself ships no JS.
   */
  actions?: ReactNode;
  className?: string;
}

/**
 * Shiki marks each token with `--shiki-light` and `--shiki-dark` and sets no
 * colour itself (`defaultColor: false`). Pick the palette by `.dark` on `<html>`.
 */
const tokens = cn(
  "[&_.shiki_span]:text-(--shiki-light) [&_.shiki_span]:[font-style:var(--shiki-light-font-style)]",
  "dark:[&_.shiki_span]:text-(--shiki-dark) dark:[&_.shiki_span]:[font-style:var(--shiki-dark-font-style)]",
);

/** The `<pre>` scrolls sideways; long lines don't wrap. */
const pre = cn(
  "[&_pre]:overflow-x-auto [&_pre]:px-5 [&_pre]:py-4 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-[22px]",
  "[&_pre]:outline-none [&_pre]:focus-visible:ring-2 [&_pre]:focus-visible:ring-ring/50 [&_pre]:focus-visible:ring-inset",
);

/** CSS counters number the lines, so copied or selected text has no numbers in it. */
const numbered = cn(
  "[&_code]:[counter-reset:line] [&_pre]:pl-3",
  "[&_.line]:before:mr-5 [&_.line]:before:inline-block [&_.line]:before:w-6 [&_.line]:before:text-right",
  "[&_.line]:before:text-muted-foreground/70 [&_.line]:before:content-[counter(line)] [&_.line]:before:[counter-increment:line]",
);

/**
 * A highlighted code block: rounded panel, optional header with the title,
 * actions in the corner and sideways scroll for long lines. Renders on the
 * server only. The highlighting is done before it gets here.
 */
export function CodeBlock({ html, lang, title, lineNumbers = false, actions, className }: CodeBlockProps) {
  return (
    <figure
      data-slot="code-block"
      data-lang={lang}
      className={cn(
        "group/code-block relative my-6 min-w-0 overflow-hidden rounded-lg border bg-muted text-foreground",
        className,
      )}
    >
      {title !== undefined && (
        <figcaption className="flex h-10 items-center gap-2 border-b pr-2 pl-5">
          <span className="me-auto truncate font-mono text-xs text-muted-foreground">{title}</span>
          {actions}
        </figcaption>
      )}
      <div
        data-slot="code-block-content"
        className={cn(tokens, pre, lineNumbers && numbered)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {title === undefined && actions && (
        // Without a header the actions float over the code, shown on hover or
        // focus, and always on touch screens where there is no hover.
        <div className="absolute top-2 right-2 rounded-md bg-muted opacity-0 transition-opacity group-hover/code-block:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          {actions}
        </div>
      )}
    </figure>
  );
}
