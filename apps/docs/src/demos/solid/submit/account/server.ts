// A pretend server: it takes a moment and refuses one email.
export async function saveAccount(value: { name: string; email: string }) {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (value.email === "taken@example.com") return { ok: false as const, error: "That email is taken." };
  return { ok: true as const };
}
