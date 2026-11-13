import type { HookPlugin, WriteRecord } from "../plugin.js";
import { definePlugin } from "../plugins.js";

/** The API of `history`, as `form.plugins.history`. */
export interface HistoryApi {
  /** Takes back the latest step. False when there is none. */
  undo(): boolean;
  /** Writes the latest undone step again. False when there is none. */
  redo(): boolean;
  /** True when there is a step to undo. */
  readonly canUndo: boolean;
  /** True when there is an undone step to write again. */
  readonly canRedo: boolean;
}

type Step = readonly WriteRecord[];

/** The record types a step keeps. Flag changes aren't edits. */
const edits = new Set<WriteRecord["type"]>(["value", "insert", "remove", "move"]);

/**
 * Undo and redo for the user's value and array writes. Its API is
 * `form.plugins.history`, a `HistoryApi`.
 *
 * A step is one delivery of `deferred` records: everything written in one
 * task, such as one keystroke or one batch. It keeps the latest `limit`
 * steps. Its own writes, resets and rebases aren't recorded, and a reset
 * clears both stacks. Array steps are replayed as array commands, so the
 * items that stay keep their keys and their per-field state.
 */
export function history(limit = 100): HookPlugin<HistoryApi, "history"> {
  return definePlugin({
    name: "history",
    setup(ctx) {
      const { store } = ctx;
      const done: Step[] = [];
      const undone: Step[] = [];

      // Replays a step through the handles, so validation sees it. Going back
      // writes each record's inverse, newest first.
      const replay = (step: Step, back: boolean) => {
        // The lib is ES2020, which has no `toReversed`. The spread keeps the step as it is.
        // oxlint-disable-next-line unicorn/no-array-reverse
        const list = back ? [...step].reverse() : step;
        ctx.write(() => {
          for (const record of list) {
            const field = store.fieldAt(record.path);
            if (!field) continue;
            if (record.type === "value") field.setValue(back ? record.before : record.after, { replace: true });
            else if (record.type === "insert") {
              if (back) field.remove(record.index);
              else field.insert(record.index, record.item);
            } else if (record.type === "remove") {
              if (back) field.insert(record.index, record.item);
              else field.remove(record.index);
            } else if (record.type === "move") {
              if (back) field.move(record.to, record.from);
              else field.move(record.from, record.to);
            }
          }
        });
      };

      const step = (from: Step[], to: Step[], back: boolean): boolean => {
        // Records still waiting for delivery belong to the step before this one.
        ctx.flush();
        const next = from.pop();
        if (!next) return false;
        to.push(next);
        replay(next, back);
        return true;
      };

      return {
        when: "deferred",
        onWrite(records) {
          const mine = records.filter((record) => record.cause === "user" && edits.has(record.type));
          if (mine.length === 0) return;
          done.push(mine);
          if (done.length > limit) done.shift();
          undone.length = 0;
        },
        onReset() {
          done.length = 0;
          undone.length = 0;
        },
        api: {
          undo: () => step(done, undone, true),
          redo: () => step(undone, done, false),
          get canUndo() {
            return done.length > 0;
          },
          get canRedo() {
            return undone.length > 0;
          },
        },
      };
    },
  });
}
