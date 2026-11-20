/** @jsxImportSource preact */
import type { WriteRecord } from "@lunarhue/forms-core";
import type { JSX } from "preact";
import type { FormEntry, LoggedSubmission, LoggedWrite } from "../hook.js";
import { empty, scroll } from "./classes.js";
import { useFrame } from "./frame.js";
import { causeText, clock, preview } from "./values.js";

/** A write or a submission, as the Log lists them. */
type Item = { readonly kind: "write"; readonly logged: LoggedWrite } | { readonly kind: "submission"; readonly logged: LoggedSubmission };

/** The form's writes and submissions in one list, newest first. They share the form's `seq` counter. */
export function logItems(entry: FormEntry): Item[] {
  const items: Item[] = [
    ...entry.writes.items.map((logged) => ({ kind: "write" as const, logged })),
    ...entry.submissions.items.map((logged) => ({ kind: "submission" as const, logged })),
  ];
  // A copy, sorted in place: `toSorted` is past the ES2020 the package targets.
  // oxlint-disable-next-line unicorn/no-array-sort
  return items.sort((a, b) => b.logged.seq - a.logged.seq);
}

/** What a write did, in a few words. */
export function writeSummary(record: WriteRecord): string {
  switch (record.type) {
    case "value":
      return record.before === undefined ? preview(record.after) : `${preview(record.before)} → ${preview(record.after)}`;
    case "insert":
      return `row ${record.index} added`;
    case "remove":
      return `row ${record.index} removed`;
    case "move":
      return `row ${record.from} moved to ${record.to}`;
    default:
      return `${record.type} ${record.before} → ${record.after}`;
  }
}

const logItem = "log-item grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3 py-1 px-4";

/** The sequence number and the cause on either side of an item. */
const side = "font-sans text-xs/5 text-muted";

export interface LogProps {
  readonly entry: FormEntry;
}

/** The Log tab: the form's writes and submissions, newest first, with each write's cause. */
export function Log({ entry }: LogProps): JSX.Element {
  const items = logItems(entry);
  // Writes push onto the ring, and a submission's status changes in place.
  useFrame(() => [entry.writes.items.length, entry.writes.items[entry.writes.items.length - 1], ...entry.submissions.items.map((logged) => logged.status)]);
  if (items.length === 0) return <p class={empty}>No writes or submissions yet. The log starts when the panel turns on.</p>;
  return (
    <ol class={`${scroll} m-0 py-2 px-0 list-none`} aria-label="Log">
      {items.map((item) => {
        if (item.kind === "submission") {
          const { seq, status } = item.logged;
          const failed = status === "invalid" || status === "failed" || status === "aborted";
          return (
            <li key={seq} class={logItem} data-seq={seq}>
              <span class={side}>{`#${seq}`}</span>
              <span>
                submit <span class={failed ? "text-error" : status === "succeeded" ? "" : "text-muted"}>{status}</span>
              </span>
              <span class={side}>{status === "aborted" ? "reset during submit" : ""}</span>
            </li>
          );
        }
        const { seq, at, record } = item.logged;
        const name = entry.store.getSnapshot(record.path).name;
        return (
          <li key={seq} class={logItem} data-seq={seq} title={clock(at)}>
            <span class={side}>{`#${seq}`}</span>
            <span class="flex flex-col min-w-0">
              <span>{name === "" ? "(form)" : name}</span>
              <span class="text-muted truncate">{writeSummary(record)}</span>
            </span>
            <span class={side}>{causeText(record.cause)}</span>
          </li>
        );
      })}
    </ol>
  );
}
