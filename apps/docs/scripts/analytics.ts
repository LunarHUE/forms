/**
 * Prints a report of the docs' analytics from Workers Analytics Engine (see
 * functions/_analytics.ts for what is recorded).
 *
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... bun run analytics --days 30
 *
 * Flags: --days <1-90> (7), --channel <release|next|all> (release),
 * --dataset <name> (lunarhue_forms_docs). The token needs the
 * Account > Account Analytics > Read permission.
 *
 * Analytics Engine may sample busy datasets, and each row then stands for
 * `_sample_interval` events, so every count here is SUM(_sample_interval).
 */

import process from "node:process";

const USAGE = `Usage: bun run analytics [--days <1-90>] [--channel <release|next|all>] [--dataset <name>]

Needs two environment variables:
  CLOUDFLARE_ACCOUNT_ID  the account that owns the Pages project
  CLOUDFLARE_API_TOKEN   an API token with the Account > Account Analytics > Read permission`;

type ChannelFilter = "release" | "next" | "all";

interface Options {
  readonly days: number;
  readonly channel: ChannelFilter;
  readonly dataset: string;
}

/** One result row. Analytics Engine's JSON quotes 64-bit integers, so counts may be strings. */
type Row = Readonly<Record<string, unknown>>;

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

function exit(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseArgs(args: readonly string[]): Options {
  let days = 7;
  let channel: ChannelFilter = "release";
  let dataset = "lunarhue_forms_docs";
  const queue = [...args];
  while (queue.length > 0) {
    const [flag = "", inline] = (queue.shift() ?? "").split("=", 2);
    if (flag === "--help" || flag === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
    const value = inline ?? queue.shift();
    if (value === undefined) exit(`${flag} needs a value.`);
    if (flag === "--days") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) exit(`--days takes a number, not "${value}".`);
      days = Math.min(90, Math.max(1, parsed));
    } else if (flag === "--channel") {
      if (value !== "release" && value !== "next" && value !== "all") exit(`Unknown channel "${value}".`);
      channel = value;
    } else if (flag === "--dataset") {
      // It goes into the SQL as a table name.
      if (!/^\w+$/.test(value)) exit(`"${value}" isn't a dataset name.`);
      dataset = value;
    } else {
      exit(`Unknown flag ${flag}.`);
    }
  }
  return { days, channel, dataset };
}

const options = parseArgs(process.argv.slice(2));
const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
if (!accountId || !apiToken) exit("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set.");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

async function query(sql: string): Promise<Row[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}` },
    body: `${sql} FORMAT JSON`,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Analytics Engine answered ${response.status}: ${text.trim()}`);
  const result: unknown = JSON.parse(text);
  if (!isRow(result) || !Array.isArray(result["data"])) throw new Error(`Unexpected answer: ${text.slice(0, 200)}`);
  const data: unknown[] = result["data"];
  return data.filter(isRow);
}

/** The rows in range and on the channel, with extra conditions. */
function where(...conditions: string[]): string {
  const scope = [`timestamp > NOW() - INTERVAL '${options.days}' DAY`];
  if (options.channel !== "all") scope.push(`index1 = '${options.channel}'`);
  return [...scope, ...conditions].join(" AND ");
}

const pageviews = "blob1 = 'pageview'";
const agentFetches = "blob1 = 'agent_fetch'";

/** Counts per value of `column`, biggest first. */
const top = (column: string, filter: string, limit: number): string =>
  `SELECT ${column} AS value, SUM(_sample_interval) AS n FROM ${options.dataset} WHERE ${filter} GROUP BY value ORDER BY n DESC LIMIT ${limit}`;

const day = "toStartOfInterval(timestamp, INTERVAL '1' DAY)";

const [daily, pages, frameworks, referrers, countries, missing, agentPaths, agentClients] = await Promise.all([
  query(
    `SELECT ${day} AS day, blob1 AS event, SUM(_sample_interval) AS n FROM ${options.dataset} WHERE ${where()} GROUP BY day, event ORDER BY day`,
  ),
  query(top("blob2", where(pageviews, "double1 = 200"), 20)),
  query(top("blob3", where(pageviews, "double1 = 200"), 10)),
  query(top("blob4", where(pageviews, "blob4 != ''"), 15)),
  query(top("blob5", where(pageviews, "blob5 != ''"), 15)),
  query(top("blob2", where(pageviews, "double1 = 404"), 20)),
  query(top("blob2", where(agentFetches), 20)),
  query(top("blob6", where(agentFetches), 15)),
]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function field(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

const count = (row: Row): number => Number(field(row, "n")) || 0;
const total = (rows: readonly Row[]): number => rows.reduce((sum, row) => sum + count(row), 0);

function table(title: string, rows: readonly Row[], label: (value: string) => string = (value) => value): void {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  (none)");
    return;
  }
  const sum = total(rows);
  const labels = rows.map((row) => label(field(row, "value")));
  const width = Math.max(...labels.map((text) => text.length));
  rows.forEach((row, index) => {
    const n = count(row);
    const share = sum > 0 ? `${Math.round((n / sum) * 100)}%`.padStart(5) : "";
    console.log(`  ${(labels[index] ?? "").padEnd(width)}  ${String(n).padStart(7)} ${share}`);
  });
}

function dailyTable(rows: readonly Row[]): void {
  console.log("\nDaily");
  const days = new Map<string, { pageview: number; agent_fetch: number }>();
  for (const row of rows) {
    const date = field(row, "day").slice(0, 10);
    const event = field(row, "event");
    const entry = days.get(date) ?? { pageview: 0, agent_fetch: 0 };
    if (event === "pageview" || event === "agent_fetch") entry[event] += count(row);
    days.set(date, entry);
  }
  console.log(`  ${"day".padEnd(10)}  ${"pageviews".padStart(9)}  ${"agent fetches".padStart(13)}`);
  for (const [date, entry] of days) {
    console.log(`  ${date}  ${String(entry.pageview).padStart(9)}  ${String(entry.agent_fetch).padStart(13)}`);
  }
  if (days.size === 0) console.log("  (none)");
}

console.log(
  `LunarHUE Forms docs, last ${options.days} day${options.days === 1 ? "" : "s"}, channel ${options.channel} (${options.dataset})`,
);
dailyTable(daily);
table("Top pages", pages);
table("Frameworks", frameworks, (value) => value || "(none)");
table("Referrers", referrers);
table("Countries", countries);
if (missing.length > 0) table("404s", missing);
table("Agent files", agentPaths);
table("Agent clients", agentClients);
