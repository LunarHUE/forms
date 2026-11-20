// How masked values are stored and shown. Both builds use these. What
// differs is how each library wires them to an input.

/** Keeps digits only, up to `max`. */
export const digitsOnly =
  (max: number) =>
  (text: string): string =>
    text.replace(/\D/g, "").slice(0, max);

/** "5551234567" shows as "(555) 123-4567". */
export function formatPhone(value: string): string {
  const area = value.slice(0, 3);
  const prefix = value.slice(3, 6);
  const line = value.slice(6, 10);
  if (value.length > 6) return `(${area}) ${prefix}-${line}`;
  if (value.length > 3) return `(${area}) ${prefix}`;
  return area;
}

/** "123456789" shows as "12-3456789". */
export function formatTaxId(value: string): string {
  return value.length > 2 ? `${value.slice(0, 2)}-${value.slice(2, 9)}` : value;
}

/** Keeps digits and one decimal point with at most two decimals: "1,234.5x" stores "1234.5". */
export function cleanMoney(text: string): string {
  const [whole = "", ...rest] = text.replace(/[^\d.]/g, "").split(".");
  const wholeDigits = whole.replace(/^0+(?=\d)/, "").slice(0, 9);
  return rest.length === 0 ? wholeDigits : `${wholeDigits}.${rest.join("").slice(0, 2)}`;
}

/** "1234.5" shows as "1,234.5". */
export function formatMoney(value: string): string {
  const [whole = "", decimals] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

/** The order total in dollars, from lines whose quantity and price may be partly typed. */
export function orderTotal(lines: readonly { readonly quantity: string; readonly price: string }[]): string {
  const cents = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * Math.round((Number(line.price) || 0) * 100), 0);
  return `$${formatMoney((cents / 100).toFixed(2))}`;
}
