// A fake order server. Everything here is plain code that runs the same in a
// browser and in Node: timers and AbortSignal only, no DOM and no Node APIs.
import type { ErrorMap, FormError } from "@lunarhue/forms-core";
import * as v from "valibot";
import { discountErrors } from "./rules.js";
import { type Order, OrderSchema } from "./schema.js";

/** The server delay when the network is normal, in milliseconds. */
export const normalDelayMs = 300;
/** The server delay when the inspector's "slow network" is on, in milliseconds. */
export const slowDelayMs = 2000;

/** How the fake server behaves. The inspector's controls write it and the apps read it. */
export interface ServerSettingsState {
  /** How long every server call waits before it answers, in milliseconds. */
  readonly delayMs: number;
  /** True makes the next `submitOrder` fail with server errors. `submitOrder` turns it off again. */
  readonly reject: boolean;
}

/** A small observable holding `ServerSettingsState`. */
export interface ServerSettings {
  /** Returns the current state. The same object until `set` changes something. */
  get(): ServerSettingsState;
  /** Merges `patch` into the state and calls every listener when anything changed. */
  set(patch: Partial<ServerSettingsState>): void;
  /** Calls `listener` after every change. Returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

/** Makes a settings object, starting from a normal network that accepts saves. */
export function createServerSettings(initial: Partial<ServerSettingsState> = {}): ServerSettings {
  let state: ServerSettingsState = { delayMs: normalDelayMs, reject: false, ...initial };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      if (next.delayMs === state.delayMs && next.reject === state.reject) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The settings every app on the page shares. The shared validators and
 * `orderOnSubmit` read it. It lives for the life of the module, so on a
 * server it is shared across requests, which is fine for a demo toggle.
 */
export const serverSettings: ServerSettings = createServerSettings();

/** Options every fake server call takes. */
export interface CallOptions {
  /** How long to wait before answering. Defaults to `normalDelayMs`. */
  readonly delayMs?: number;
  /** Aborts the call: the promise rejects with the signal's reason. */
  readonly signal?: AbortSignal;
}

/** Waits `ms` milliseconds, or rejects with the signal's reason when it aborts first. */
function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** The address the fake server reports as taken. */
export const takenEmail = "taken@example.com";

/** What `checkEmail` resolves to. */
export interface EmailCheck {
  /** False when another customer already uses the address. */
  readonly available: boolean;
}

/** Asks the server whether an email address is free. Only `taken@example.com` is taken, in any case. */
export async function checkEmail(email: string, options: CallOptions = {}): Promise<EmailCheck> {
  await wait(options.delayMs ?? normalDelayMs, options.signal);
  return { available: email.trim().toLowerCase() !== takenEmail };
}

/** An order as the server stored it before this session. It passes `OrderSchema`. */
export function loadOrder(): Order {
  return {
    customer: { name: "Ada Lovelace", email: "ada@example.com" },
    delivery: "express",
    notifications: ["email"],
    lineItems: [
      { description: "Analytical engine manual", quantity: 1, unitPrice: 42 },
      { description: "Punched cards (box of 100)", quantity: 3, unitPrice: 7.5 },
    ],
    discount: 5,
    billing: { street: "12 St James's Square", city: "London", postcode: "SW1Y 4JH", country: "GB" },
    shipping: { street: "12 St James's Square", city: "London", postcode: "SW1Y 4JH", country: "GB" },
    sameAsBilling: true,
  };
}

/** Options for `saveOrder`. */
export interface SaveOptions extends CallOptions {
  /** True makes the save fail with a field error on `customer.email` and a form error. */
  readonly reject?: boolean;
}

/**
 * What `saveOrder` resolves to. On failure `errors` is core's `ErrorMap`,
 * keyed by dotted field name, ready for `store.setErrors`.
 */
export type SaveResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly errors: ErrorMap<FormError> };

let nextId = 1001;

/** Turns valibot issues into an `ErrorMap`. An issue with no path goes on the form. */
function issueErrors(issues: readonly v.BaseIssue<unknown>[]): ErrorMap<FormError> {
  const form: FormError[] = [];
  const fields: Record<string, FormError[]> = {};
  for (const issue of issues) {
    const name = v.getDotPath(issue);
    const error = { message: issue.message };
    if (name === null) form.push(error);
    else (fields[name] ??= []).push(error);
  }
  return form.length > 0 ? { form, fields } : { fields };
}

/**
 * Saves an order. It checks the value with `OrderSchema` and the discount
 * rule, as a real server would, and resolves `{ ok: false, errors }` when
 * either fails. With `reject: true` it fails with server errors instead.
 * Otherwise it resolves `{ ok: true, id }`. It rejects only when `signal`
 * aborts.
 */
export async function saveOrder(order: unknown, options: SaveOptions = {}): Promise<SaveResult> {
  await wait(options.delayMs ?? normalDelayMs, options.signal);
  if (options.reject) {
    return {
      ok: false,
      errors: {
        form: { message: "The server refused the order. Try again." },
        fields: { "customer.email": { message: "This customer's account is on hold." } },
      },
    };
  }
  const parsed = v.safeParse(OrderSchema, order);
  if (!parsed.success) return { ok: false, errors: issueErrors(parsed.issues) };
  const discount = discountErrors(parsed.output);
  if (discount) return { ok: false, errors: discount };
  return { ok: true, id: `ORD-${nextId++}` };
}

/** The part of the server settings a save needs, as plain data, so a server action can take it. */
export interface SaveRequest {
  /** How long the save waits before it answers, in milliseconds. */
  readonly delayMs: number;
  /** True makes the save fail with server errors. */
  readonly reject: boolean;
}

/**
 * Something that saves an order: `saveOrder` itself, or a function that
 * sends the order to a server that calls it, such as a Next.js server
 * action. The arguments are plain data, so they cross a network boundary.
 */
export type SaveOrder = (order: Order, request: SaveRequest) => Promise<SaveResult>;

/** Options for `submitOrder`. */
export interface SubmitOptions {
  /**
   * Aborts the save. Only the default `saveOrder` call takes it: a custom
   * `save` gets plain data only, so it can't be aborted.
   */
  readonly signal?: AbortSignal;
  /** The settings to read. Defaults to the shared `serverSettings`. */
  readonly settings?: ServerSettings;
  /** Where to send the order. Defaults to calling `saveOrder` in this process. */
  readonly save?: SaveOrder;
}

/**
 * Saves with the current server settings: their delay, and their `reject`
 * flag, which it turns off again so only the next save fails.
 */
export function submitOrder(order: Order, options: SubmitOptions = {}): Promise<SaveResult> {
  const settings = options.settings ?? serverSettings;
  const { delayMs, reject } = settings.get();
  if (reject) settings.set({ reject: false });
  if (options.save) return options.save(order, { delayMs, reject });
  return saveOrder(order, { delayMs, reject, ...(options.signal ? { signal: options.signal } : {}) });
}
