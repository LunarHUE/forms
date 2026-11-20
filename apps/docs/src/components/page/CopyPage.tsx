import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileTextIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  SparklesIcon,
  SquareTerminalIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { assistantLinks, type Assistant } from "./assistants";

export interface CopyPageProps {
  /** Path of the page's Markdown copy, as in `/react/plugins/masks.md`. Copy and View fetch this. */
  markdownHref: string;
  /** The copy's production URL, which the assistants are asked to read. */
  markdownUrl: string;
}

/** How long the check mark and "Copied" stay up. */
const COPIED_MS = 1500;

const assistantIcons: Record<Assistant, LucideIcon> = {
  claude: SparklesIcon,
  chatgpt: MessageCircleIcon,
  t3: MessageSquareIcon,
  cursor: SquareTerminalIcon,
};

/**
 * Puts the Markdown on the clipboard. Safari drops the click's permission
 * once a fetch has run, so where it can the clipboard gets a promise of the
 * text and waits for the fetch itself.
 */
async function copyMarkdown(href: string): Promise<void> {
  const text = fetch(href).then((response) => {
    if (!response.ok) throw new Error(`${href}: ${response.status}`);
    return response.text();
  });
  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
    const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}

/**
 * "Copy page" with a menu beside it: view the page's Markdown, or open it in
 * an assistant with a prompt that points at the Markdown URL.
 */
export function CopyPage({ markdownHref, markdownUrl }: CopyPageProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await copyMarkdown(markdownHref);
    } catch {
      // No clipboard or the fetch failed: leave the button as it is.
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div data-pagefind-ignore className="inline-flex shrink-0 rounded-md shadow-xs">
      <Tooltip open={hovered || copied} onOpenChange={setHovered}>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="rounded-r-none border-r-0 text-muted-foreground hover:text-foreground"
              onClick={copy}
            />
          }
        >
          {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
          Copy page
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {copied ? "Copied" : "Copy this page as Markdown"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Hint label="More ways to use this page">
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-l-none text-muted-foreground hover:text-foreground"
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
        </Hint>
        <CopyPageMenu markdownHref={markdownHref} markdownUrl={markdownUrl} />
      </DropdownMenu>
    </div>
  );
}

interface CopyPageMenuProps {
  markdownHref: string;
  markdownUrl: string;
}

function CopyPageMenu({ markdownHref, markdownUrl }: CopyPageMenuProps) {
  return (
    <DropdownMenuContent align="end" className="w-56">
      <MenuLink href={markdownHref} Icon={FileTextIcon} label="View as Markdown" />
      <DropdownMenuSeparator />
      {assistantLinks(markdownUrl).map((link) => (
        <MenuLink key={link.id} href={link.href} Icon={assistantIcons[link.id]} label={`Open in ${link.label}`} />
      ))}
    </DropdownMenuContent>
  );
}

interface MenuLinkProps {
  href: string;
  Icon: LucideIcon;
  label: string;
}

function MenuLink({ href, Icon, label }: MenuLinkProps) {
  return (
    <DropdownMenuItem
      className="h-8 gap-2"
      render={<a href={href} target="_blank" rel="noopener noreferrer" data-astro-prefetch="false" />}
    >
      <Icon />
      {label}
      <ArrowUpRightIcon className="ml-auto text-muted-foreground" />
    </DropdownMenuItem>
  );
}
