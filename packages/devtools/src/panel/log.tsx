import type { WriteRecord } from "@lunarhue/forms-core";
import { h, type JSX } from "preact";
import type { FormEntry, LoggedSubmission, LoggedWrite } from "../hook.js";
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

/** The Log tab: the form's writes and submissions, newest first, with each write's cause. */
export function Log({ entry }: { readonly entry: FormEntry }): JSX.Element {
  const items = logItems(entry);
  // Writes push onto the ring, and a submission's status changes in place.
  useFrame(() => [entry.writes.items.length, entry.writes.items[entry.writes.items.length - 1], ...entry.submissions.items.map((logged) => logged.status)]);
  if (items.length === 0) return h("p", { class: "empty" }, "No writes or submissions yet. The log starts when the panel turns on.");
  return h(
    "ol",
    { class: "log scroll", "aria-label": "Log" },
    items.map((item) => {
      if (item.kind === "submission") {
        const { seq, status } = item.logged;
        const failed = status === "invalid" || status === "failed" || status === "aborted";
        return h(
          "li",
          { key: seq, class: "log-item", "data-seq": seq },
          h("span", { class: "muted" }, `#${seq}`),
          h("span", null, "submit ", h("span", { class: failed ? "error" : status === "succeeded" ? "" : "muted" }, status)),
          h("span", { class: "muted" }, status === "aborted" ? "reset during submit" : ""),
        );
      }
      const { seq, at, record } = item.logged;
      const name = entry.store.getSnapshot(record.path).name;
      return h(
        "li",
        { key: seq, class: "log-item", "data-seq": seq, title: clock(at) },
        h("span", { class: "muted" }, `#${seq}`),
        h(
          "span",
          { class: "log-main" },
          h("span", null, name === "" ? "(form)" : name),
          h("span", { class: "muted truncate" }, writeSummary(record)),
        ),
        h("span", { class: "muted" }, causeText(record.cause)),
      );
    }),
  );
}
