import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copies text to the clipboard and reports `copied` for `resetAfter` ms, for a
 * "Copied" tooltip or icon. A failed write (no permission, insecure context)
 * leaves `copied` false.
 */
export const useCopy = (resetAfter = 1500): { copied: boolean; copy: (text: string) => Promise<void> } => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return;
      }
      clearTimeout(timer.current);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), resetAfter);
    },
    [resetAfter],
  );

  return { copied, copy };
};
