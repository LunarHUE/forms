export type Assistant = "claude" | "chatgpt" | "t3" | "cursor";

export interface AssistantLink {
  readonly id: Assistant;
  readonly label: string;
  readonly href: string;
}

/** What each assistant is asked, given the page's Markdown URL. */
export const assistantPrompt = (markdownUrl: string): string =>
  `Read ${markdownUrl} so I can ask questions about it.`;

/**
 * Links that open each assistant with the prompt filled in. Claude, ChatGPT
 * and T3 Chat take it as `q`; Cursor's web link opens the app with it as
 * `text` (cursor.com/docs/reference/deeplinks).
 */
export function assistantLinks(markdownUrl: string): AssistantLink[] {
  const q = encodeURIComponent(assistantPrompt(markdownUrl));
  return [
    { id: "claude", label: "Claude", href: `https://claude.ai/new?q=${q}` },
    { id: "chatgpt", label: "ChatGPT", href: `https://chatgpt.com/?hints=search&q=${q}` },
    { id: "t3", label: "T3 Chat", href: `https://t3.chat/new?q=${q}` },
    { id: "cursor", label: "Cursor", href: `https://cursor.com/link/prompt?text=${q}` },
  ];
}
