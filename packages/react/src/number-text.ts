import { cached, type Source } from "./select.js";

/**
 * What a number input showed after its last edit: the text and the value it
 * wrote. While the field still holds that value the input keeps the text,
 * so `1.` or `-` stays as typed instead of turning into `1` or nothing.
 */
export interface NumberText {
  readonly value: unknown;
  readonly text: string;
}

/** One field's recorded text and the components that show it. */
interface TextCell {
  text: NumberText | undefined;
  readonly listeners: Set<() => void>;
  readonly source: Source<NumberText | undefined>;
}

const cells = new WeakMap<object, TextCell>();

const cellOf = (handle: object): TextCell =>
  cached(cells, handle, () => {
    const cell: TextCell = {
      text: undefined,
      listeners: new Set(),
      source: {
        subscribe(listener) {
          cell.listeners.add(listener);
          return () => {
            cell.listeners.delete(listener);
          };
        },
        get: () => cell.text,
        server: () => undefined,
      },
    };
    return cell;
  });

/** The source of a field's recorded text, for `useSyncExternalStore`. */
export const numberTextSource = (handle: object): Source<NumberText | undefined> => cellOf(handle).source;

/** Records a field's text, or forgets it with undefined, and tells the components that show it. */
export function setNumberText(handle: object, text: NumberText | undefined): void {
  const cell = cells.get(handle);
  if (cell === undefined ? text === undefined : cell.text === text) return;
  const target = cell ?? cellOf(handle);
  target.text = text;
  for (const listener of target.listeners) listener();
}
