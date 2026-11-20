// A fake server that lives in the page. Every call waits like a network
// request and honours an AbortSignal, so both builds of an app see the same
// latency and the same answers.
import type { Company, Customer, Invite, Order } from "../backoffice/schemas.ts";


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

// Profile settings

export const timezones = ["Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"] as const;

export interface Profile {
  readonly name: string;
  readonly email: string;
  readonly bio: string;
  readonly timezone: (typeof timezones)[number];
  readonly notifications: {
    readonly product: boolean;
    readonly security: boolean;
    readonly digest: "daily" | "weekly" | "never";
  };
}

let storedProfile: Profile = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  bio: "Writes programs for engines that don't exist yet.",
  timezone: "Europe/London",
  notifications: { product: true, security: true, digest: "weekly" },
};

/** The server's copy of the profile. */
export async function getProfile(): Promise<Profile> {
  await wait(200);
  return storedProfile;
}

/** Saves the profile and returns what the server stored. Slow on purpose. */
export async function saveProfile(profile: Profile): Promise<Profile> {
  await wait(800);
  storedProfile = profile;
  return storedProfile;
}

/** Someone else changes the name and the bio on the server. */
export function editProfileElsewhere(): void {
  storedProfile = { ...storedProfile, name: "Ada King", bio: "Countess of Lovelace." };
}

// Back office

/** Either saved, or refused with a message for each field the server rejects. */
export type SaveResponse = { readonly ok: true } | { readonly ok: false; readonly errors: Readonly<Record<string, string>> };

/**
 * A record the server keeps, with a delay on every call and a way for
 * "someone else" to change it. `refuse` returns the errors for a value the
 * server won't store.
 */
function record<T>(initial: T, elsewhere: (current: T) => T, refuse?: (value: T) => Readonly<Record<string, string>> | undefined) {
  let stored = initial;
  // Arrow functions, so the app can pass them around unbound.
  return {
    get: async (): Promise<T> => {
      await wait(200);
      return stored;
    },
    save: async (value: T): Promise<SaveResponse> => {
      await wait(600);
      const errors = refuse?.(value);
      if (errors !== undefined) return { ok: false, errors };
      stored = value;
      return { ok: true };
    },
    editElsewhere: (): void => {
      stored = elsewhere(stored);
    },
  };
}

export const customers = record<Customer>(
  {
    name: "Grace Hopper",
    email: "grace@example.com",
    phone: "2025550143",
    billing: { street: "1 Navy Way", city: "Arlington", region: "VA", postcode: "22202", country: "US" },
    sameAsBilling: true,
    shipping: { street: "", city: "", region: "", postcode: "", country: "US" },
  },
  (customer) => ({ ...customer, email: "admiral@example.com", billing: { ...customer.billing, city: "Washington", region: "DC" } }),
);

export const orders = record<Order>(
  {
    reference: "PO-1001",
    lines: [
      { sku: "COBOL-1", quantity: "2", price: "49.5" },
      { sku: "UNIVAC-PUNCH", quantity: "1", price: "1200" },
    ],
    gift: false,
    giftMessage: "",
  },
  (order) => ({ ...order, reference: "PO-1001-B" }),
);

export const companies = record<Company>(
  {
    name: "Analytical Engines Ltd",
    phone: "2075550198",
    taxId: "123456789",
    address: { street: "12 Dorset Street", city: "London", region: "", postcode: "W1U 4EH", country: "GB" },
  },
  (company) => ({ ...company, name: "Analytical Engines plc", phone: "2075550100" }),
  // The tax registry knows no company with this number.
  (company) => (company.taxId === "000000000" ? { taxId: "No company has this tax ID." } : undefined),
);

/** Sends an invitation. */
export async function sendInvite(invite: Invite): Promise<string> {
  await wait(400);
  return `Invitation sent to ${invite.email}.`;
}
