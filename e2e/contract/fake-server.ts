/** One request the fake server got, as the state probe shows it. */
export interface ServerCall {
  readonly op: string;
  readonly input: unknown;
  readonly state: "pending" | "done";
}

/** How long each kind of answer takes, in milliseconds. */
export const delays = {
  /** Long enough for a spec to see a submit button in its busy state. */
  save: 300,
  check: 50,
  /** A username check for a name that starts with "slow". */
  slowCheck: 1200,
  load: 50,
} as const;

/** Usernames the fake server says are taken. */
export const takenNames: readonly string[] = ["ada", "slowtaken"];

// The log lives in the page, so each page load starts with an empty one.
// The server rendering an app never calls the fake server.
let calls: readonly ServerCall[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Logs a request, waits `ms`, marks it done and returns what `answer` gives. */
async function request<T>(op: string, input: unknown, ms: number, answer: () => T): Promise<T> {
  const index = calls.length;
  calls = [...calls, { op, input, state: "pending" }];
  notify();
  await new Promise((resolve) => setTimeout(resolve, ms));
  calls = calls.map((call, at) => (at === index ? { ...call, state: "done" } : call));
  notify();
  return answer();
}

/**
 * A stand-in for a backend, the same in every app. It never looks at an
 * abort signal, like a server that answers a request the page gave up on,
 * so a stale answer still arrives and the form must drop it.
 */
export const fakeServer = {
  /** Every request so far, in order. */
  get: (): readonly ServerCall[] => calls,
  /** Calls `listener` after each change to the log. Returns the function that stops it. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Saves `input` and answers with how many saves this page has made, this one included. */
  save: (input: unknown): Promise<number> =>
    request("save", input, delays.save, () => calls.filter((call) => call.op === "save").length),
  /** Answers true when `name` is taken. Names that start with "slow" take longer. */
  check: (name: string): Promise<boolean> =>
    request("check", name, name.startsWith("slow") ? delays.slowCheck : delays.check, () => takenNames.includes(name)),
  /** Answers with `fresh`, as a reload of a record someone else changed. */
  load: <T>(fresh: T): Promise<T> => request("load", undefined, delays.load, () => fresh),
};
