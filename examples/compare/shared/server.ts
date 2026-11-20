// A fake server that lives in the page. Every call waits like a network
// request and honours an AbortSignal, so both builds of an app see the same
// latency and the same answers.

/** Resolves after `ms`, or rejects with the signal's reason when it aborts. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

// Sign-up

const takenNames = new Set(["ada", "grace", "admin"]);

/** True when an account already has this username. */
export async function isUsernameTaken(name: string, signal?: AbortSignal): Promise<boolean> {
  await wait(300, signal);
  return takenNames.has(name.toLowerCase());
}

export interface SignUpRequest {
  readonly email: string;
  readonly username: string;
  readonly password: string;
}

export type SignUpResponse = { readonly ok: true } | { readonly ok: false; readonly errors: Readonly<Record<string, string>> };

/** Creates the account, or says which fields the server refused. */
export async function signUp(request: SignUpRequest): Promise<SignUpResponse> {
  await wait(400);
  if (request.email.toLowerCase() === "taken@example.com") {
    return { ok: false, errors: { email: "That email already has an account." } };
  }
  takenNames.add(request.username.toLowerCase());
  return { ok: true };
}
