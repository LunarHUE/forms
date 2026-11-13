import { splitPath, type PathSegment } from "@lunarhue/forms-core";

export type { PathSegment } from "@lunarhue/forms-core";

/** Placeholder: the issue path a schema error would report for a field. */
export function issuePath(field: string): readonly PathSegment[] {
  return splitPath(field);
}
