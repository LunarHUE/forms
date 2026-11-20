import type { MapError } from "../../errors.js";
import type { Path } from "../../path.js";
import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { ValidatorResult } from "../../validator.js";
import type { StoreCore } from "../core.js";
import { errorList } from "../handles.js";
import { addErrors, type Placed } from "../placed.js";
import type { Spec } from "./inputs.js";

export const listOf = <E>(errors: ValidatorResult<E>): readonly E[] =>
  errors === undefined || errors === null ? [] : errorList(errors);

const segmentOf = (seg: PropertyKey | StandardSchemaV1.PathSegment): string =>
  String(typeof seg === "object" ? seg.key : seg);

/**
 * The stable path an issue path points at, from the field at `base`. Array
 * indexes become item keys. Undefined when a step is out of range or goes
 * into a leaf.
 */
function resolve<E, I, R>(core: StoreCore<E, I, R>, base: Path, issue: StandardSchemaV1.Issue): Path | undefined {
  const path: string[] = base.map(String);
  for (const raw of issue.path ?? []) {
    const seg = segmentOf(raw);
    const snapshot = core.getSnapshot(path);
    if (Array.isArray(snapshot.value)) {
      const index = /^(0|[1-9]\d*)$/.test(seg) ? Number(seg) : -1;
      const key = snapshot.keys?.[index];
      if (key === undefined) return undefined;
      path.push(key);
    } else path.push(seg);
  }
  return core.isLive(path) ? path : undefined;
}

/** What a run returned, placed on fields. `base` is the path of the field the validator runs on. */
export function place<E, I, R>(
  core: StoreCore<E, I, R>,
  spec: Spec,
  base: Path,
  result: unknown,
  mapError: MapError<E>,
): Placed<E> {
  const placed: Placed<E> = new Map();
  if (result === undefined || result === null) return placed;
  if (spec.schema) {
    // An issue whose path resolves to no field lands on the validated field, so it still blocks submit.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    for (const issue of (result as StandardSchemaV1.Result<unknown>).issues ?? []) {
      const path = resolve(core, base, issue) ?? base;
      addErrors(placed, path, [mapError({ source: "schema", message: issue.message, path, issue })]);
    }
  } else if (spec.place) {
    // `place` was typed for the form's error type, which this runner leaves open.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    spec.place(placed as never, core as never, base, result);
  } else {
    // A validator's own errors are already the form's error type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    addErrors(placed, base, listOf(result as ValidatorResult<E>));
  }
  return placed;
}

/** The message of a thrown value: `message` of an `Error`, else the value as a string. */
export const thrownMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));
