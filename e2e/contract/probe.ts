import type { AnyFormStore, Path } from "@lunarhue/forms-core";

/** Anything else a page wants in its probe, such as the fake server's log or an outside store. */
export interface ProbeSource {
  get(): unknown;
  subscribe(listener: () => void): () => void;
}

/** One field's state in the probe. Messages stand for errors. */
export interface ProbeField {
  readonly errors: readonly string[];
  readonly shown: readonly string[];
  readonly touched: boolean;
  readonly edited: boolean;
  readonly dirty: boolean;
  readonly validating: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
}

/** What the probe element holds, as JSON. */
export interface ProbeState {
  readonly form: {
    readonly valid: boolean;
    readonly validating: boolean;
    readonly dirty: boolean;
    readonly submitting: boolean;
    readonly submitCount: number;
    readonly submission: { readonly status: string; readonly result?: unknown; readonly error?: string };
  };
  readonly value: unknown;
  /** Every field by its dotted name, with the root at "". */
  readonly fields: Readonly<Record<string, ProbeField>>;
  /** The item keys of every array, by its dotted name. */
  readonly keys: Readonly<Record<string, readonly string[]>>;
  /** What each extra source holds. */
  readonly sources: Readonly<Record<string, unknown>>;
}

type Sources = Readonly<Record<string, ProbeSource>>;

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads `dirty`, which the types give only to forms with `dirty()`. Pages
 * without it still report one, and it is `false` there at runtime.
 */
const dirtyOf = (snapshot: object): boolean => "dirty" in snapshot && snapshot.dirty === true;

const messages = (errors: readonly { readonly message: string }[]): string[] => errors.map((error) => error.message);

/** Reads the whole form, and returns the stable path of every field it visited. */
export function readProbe(store: AnyFormStore, sources: Sources = {}): { state: ProbeState; paths: Path[] } {
  const fields: Record<string, ProbeField> = {};
  const keys: Record<string, readonly string[]> = {};
  const paths: Path[] = [];

  const visit = (path: Path): void => {
    paths.push(path);
    const snapshot = store.getSnapshot(path);
    fields[snapshot.name] = {
      errors: messages(snapshot.errors),
      shown: messages(snapshot.shownErrors),
      touched: snapshot.touched,
      edited: snapshot.edited,
      dirty: dirtyOf(snapshot),
      validating: snapshot.validating,
      disabled: snapshot.disabled,
      readOnly: snapshot.readOnly,
    };
    if (Array.isArray(snapshot.value)) {
      const itemKeys = snapshot.keys ?? [];
      keys[snapshot.name] = itemKeys;
      for (const key of itemKeys) visit([...path, key]);
    } else if (isObject(snapshot.value)) {
      for (const key of Object.keys(snapshot.value)) visit([...path, key]);
    }
  };
  visit([]);

  const form = store.getFormSnapshot();
  const { submission } = form;
  const state: ProbeState = {
    form: {
      valid: form.valid,
      validating: form.validating,
      dirty: dirtyOf(form),
      submitting: form.submitting,
      submitCount: form.submitCount,
      submission:
        submission.status === "succeeded"
          ? { status: submission.status, result: submission.result }
          : submission.status === "failed"
            ? { status: submission.status, error: String(submission.error) }
            : { status: submission.status },
    },
    value: store.getSnapshot([]).value,
    fields,
    keys,
    sources: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, source.get()])),
  };
  return { state, paths };
}

/**
 * Writes the form's state into `element` as JSON, now and after every
 * change, until the returned function is called. Every app mounts it the
 * same way after hydration, so the probe is empty in the server HTML and
 * filled once the page is live. It listens to every field, and follows
 * array items as they come and go.
 */
export function startProbe(element: Element, store: AnyFormStore, sources: Sources = {}): () => void {
  const fieldListeners = new Map<string, () => void>();
  let queued = false;

  const write = (): void => {
    queued = false;
    const { state, paths } = readProbe(store, sources);
    element.textContent = JSON.stringify(state, null, 2);
    const seen = new Set<string>();
    for (const path of paths) {
      const key = JSON.stringify(path);
      seen.add(key);
      if (!fieldListeners.has(key)) fieldListeners.set(key, store.subscribe(path, schedule));
    }
    for (const [key, stop] of fieldListeners) {
      if (seen.has(key)) continue;
      stop();
      fieldListeners.delete(key);
    }
  };

  // A write wakes many listeners at once, so they share one rewrite.
  function schedule(): void {
    if (queued) return;
    queued = true;
    queueMicrotask(write);
  }

  const stops = [store.subscribeForm(schedule), ...Object.values(sources).map((source) => source.subscribe(schedule))];
  write();
  return () => {
    for (const stop of stops) stop();
    for (const stop of fieldListeners.values()) stop();
    fieldListeners.clear();
  };
}
