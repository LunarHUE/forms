import type { HookPlugin, PluginContext, WriteRecord } from "../plugin.js";
import { definePlugin } from "../plugins.js";

/** The API of `history`, as `form.plugins.history`. */
export interface HistoryApi {
  /** Takes back the latest step. False when there is none. */
  undo(): boolean;
  /** Writes the latest undone step again. False when there is none. */
  redo(): boolean;
}

/**
 * The meta `history` keeps on the form. Read it from the form snapshot with
 * the plugin's reader, as `undoHistory.formMeta(snapshot).canUndo`. Before
 * the first step both flags are false.
 */
export interface HistoryMeta {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** A record a step keeps. Flag changes aren't edits. */
type Edit = Exclude<WriteRecord, { readonly type: "touched" | "disabled" | "readOnly" }>;

type Step = readonly Edit[];

const start: HistoryMeta = { canUndo: false, canRedo: false };

const edits = new Set<WriteRecord["type"]>(["value", "insert", "remove", "move"]);

/**
 * Undo and redo for the user's value and array writes. Its API is
 * `form.plugins.history`, a `HistoryApi`, and it keeps `HistoryMeta` on the
 * form so an undo button can re-render.
 *
 * A step is one delivery of `deferred` records: everything written in one
 * task, such as one keystroke or one batch. It keeps the latest `limit`
 * steps. Its own writes, resets and rebases aren't recorded, and a reset
 * clears both stacks. Array steps are replayed as array commands, so the
 * items that stay keep their keys and their per-field state.
 *
 * The meta changes in the same notification as an undo, a redo or a reset.
 * After an edit it changes a microtask later, when the step is recorded.
 */
export function history(limit = 100): HookPlugin<HistoryApi, "history", never, HistoryMeta, undefined, never> {
  return definePlugin({
    name: "history",
    initialFormMeta: start,
    setup(ctx: PluginContext<never, HistoryMeta>) {
      const { store } = ctx;
      const done: Step[] = [];
      const undone: Step[] = [];
      let meta = start;

      // Sets the form meta when a flag changed.
      const show = () => {
        const canUndo = done.length > 0;
        const canRedo = undone.length > 0;
        if (canUndo !== meta.canUndo || canRedo !== meta.canRedo) ctx.setFormMeta((meta = { canUndo, canRedo }));
      };

      // Moves a step from one stack to the other and replays it through the
      // handles, so validation sees it. Going back writes each record's
      // inverse, newest first.
      const step = (from: Step[], to: Step[], back: boolean): boolean => {
        // Records still waiting for delivery belong to the step before this one.
        ctx.flush();
        const next = from.pop();
        if (!next) return false;
        to.push(next);
        // The lib is ES2020, which has no `toReversed`. The spread keeps the step as it is.
        // oxlint-disable-next-line unicorn/no-array-reverse
        const list = back ? [...next].reverse() : next;
        ctx.write(() => {
          for (const record of list) {
            const field = store.fieldAt(record.path);
            if (!field) continue;
            if (record.type === "value") field.setValue(back ? record.before : record.after, { replace: true });
            else if (record.type === "move") field.move(back ? record.to : record.from, back ? record.from : record.to);
            // Undoing an insert and redoing a remove both take the item out.
            else if ((record.type === "insert") === back) field.remove(record.index);
            else field.insert(record.index, record.item);
          }
          // Inside the write's batch, so the flags land with the values.
          show();
        });
        return true;
      };

      return {
        when: "deferred",
        onWrite(records) {
          const mine = records.filter((record): record is Edit => record.cause === "user" && edits.has(record.type));
          if (mine.length === 0) return;
          done.push(mine);
          if (done.length > limit) done.shift();
          undone.length = 0;
          show();
        },
        onReset() {
          done.length = 0;
          undone.length = 0;
          show();
        },
        api: {
          undo: () => step(done, undone, true),
          redo: () => step(undone, done, false),
        },
      };
    },
  });
}
