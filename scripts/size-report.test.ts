import { describe, expect, it } from "vitest";
import {
  type Change,
  delta,
  diff,
  diffCompare,
  type LimitSize,
  marker,
  notable,
  parseFormsTable,
  raisedLimits,
  report,
  type Snapshot,
} from "./size-report.js";

const columns = ["React prod", "React dev", "Solid prod", "Solid dev"];

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    forms: {
      columns,
      rows: [
        { name: "Bare form", sizes: { "React prod": 4000, "React dev": 6000, "Solid prod": 3800, "Solid dev": 5600 } },
        { name: "Everything on", sizes: { "React prod": 9000, "React dev": 14000, "Solid prod": 8800, "Solid dev": 13500 } },
      ],
    },
    limits: [
      { package: "@lunarhue/forms-core", name: ".", size: 9000, limit: 9450 },
      { package: "@lunarhue/forms-react", name: "react, everything on", size: 18000 },
    ],
    compare: null,
    ...overrides,
  };
}

const limit = (name: string, size: number, ceiling?: number): LimitSize => ({
  package: "@lunarhue/forms-core",
  name,
  size,
  ...(ceiling === undefined ? {} : { limit: ceiling }),
});

const change = (overrides: Partial<Change>): Change => ({
  source: "size-limit",
  group: "core",
  entry: ".",
  base: 1000,
  head: 1000,
  baseLimit: undefined,
  headLimit: undefined,
  ...overrides,
});

const options = { base: "main", sha: "0123456789abcdef" };

const apps = (brotli: number) => ({ signup: { lunarhue: { forms: { brotli } }, tanstack: { forms: { brotli: 16816 } } } });

describe("parseFormsTable", () => {
  it("reads the table an older size:forms prints", () => {
    const markdown = [
      "Minified, brotli. React, Solid and Valibot are external.",
      "",
      "| Form | React prod | Solid prod |",
      "| --- | ---: | ---: |",
      "| Bare form, one field bound by hand | 4,012 B | 3,890 B |",
      "| + a field validator | 4,180 B | 4,001 B |",
    ].join("\n");
    expect(parseFormsTable(markdown)).toEqual({
      columns: ["React prod", "Solid prod"],
      rows: [
        { name: "Bare form, one field bound by hand", sizes: { "React prod": 4012, "Solid prod": 3890 } },
        { name: "+ a field validator", sizes: { "React prod": 4180, "Solid prod": 4001 } },
      ],
    });
  });

  it("fails without a table", () => expect(() => parseFormsTable("nothing")).toThrow("printed no table"));
});

describe("diff", () => {
  it("pairs every form cell and size-limit entry", () => {
    const changes = diff(snapshot(), snapshot());
    expect(changes.filter((item) => item.source === "size:forms")).toHaveLength(8);
    expect(changes.filter((item) => item.source === "size-limit")).toHaveLength(2);
    expect(changes.every((item) => item.base === item.head)).toBe(true);
  });

  it("names packages without the scope", () => {
    expect(diff(null, snapshot()).find((item) => item.source === "size-limit")?.group).toBe("core");
  });

  it("keeps entries only one side has", () => {
    const base = snapshot({ limits: [limit("gone", 500)] });
    const head = snapshot({ limits: [limit("new", 700, 800)] });
    const limits = diff(base, head).filter((item) => item.source === "size-limit");
    expect(limits).toEqual([
      change({ entry: "new", base: undefined, head: 700, headLimit: 800 }),
      change({ entry: "gone", base: 500, head: undefined }),
    ]);
  });
});

describe("notable", () => {
  it("skips a move under the threshold", () => expect(notable(change({ base: 1000, head: 1009 }))).toBe(false));
  it("counts a move at the threshold", () => expect(notable(change({ base: 1000, head: 1010 }))).toBe(true));
  it("counts a shrink", () => expect(notable(change({ base: 1000, head: 980 }))).toBe(true));
  it("counts a new entry", () => expect(notable(change({ base: undefined }))).toBe(true));
  it("counts a removed entry", () => expect(notable(change({ head: undefined }))).toBe(true));

  it("counts a raised limit with no size change", () => {
    expect(notable(change({ baseLimit: 1200, headLimit: 1300 }))).toBe(true);
  });

  it("counts an entry that crosses close to its limit", () => {
    expect(notable(change({ base: 975, head: 981, baseLimit: 1000, headLimit: 1000 }))).toBe(true);
  });

  it("skips an entry that was already close to its limit", () => {
    expect(notable(change({ base: 985, head: 986, baseLimit: 1000, headLimit: 1000 }))).toBe(false);
  });

  it("counts an entry over its limit", () => {
    expect(notable(change({ base: 1001, head: 1002, baseLimit: 1000, headLimit: 1000 }))).toBe(true);
  });
});

describe("raisedLimits", () => {
  it("finds limits that went up, and only those", () => {
    const raised = change({ entry: "raised", baseLimit: 1000, headLimit: 1100 });
    const changes = [
      raised,
      change({ entry: "lowered", baseLimit: 1000, headLimit: 900 }),
      change({ entry: "set", headLimit: 1000 }),
      change({ entry: "same", baseLimit: 1000, headLimit: 1000 }),
    ];
    expect(raisedLimits(changes)).toEqual([raised]);
  });
});

describe("delta", () => {
  it("signs growth", () => expect(delta(10538, 10600)).toBe("+62 B / +0.6%"));
  it("signs a shrink", () => expect(delta(2000, 1500)).toBe("-500 B / -25.0%"));
  it("prints no change", () => expect(delta(1000, 1000)).toBe("0 B / 0.0%"));
  it("drops the percentage from zero", () => expect(delta(0, 120)).toBe("+120 B"));
});

describe("diffCompare", () => {
  it("lists the brotli sizes that changed", () => {
    expect(diffCompare(snapshot({ compare: apps(12267) }), snapshot({ compare: apps(12300) }))).toEqual([
      { app: "signup", library: "lunarhue", build: "forms", base: 12267, head: 12300 },
    ]);
  });

  it("lists nothing when the file is the same", () => {
    expect(diffCompare(snapshot({ compare: apps(12267) }), snapshot({ compare: apps(12267) }))).toEqual([]);
  });
});

describe("report", () => {
  it("says so in one line when nothing moved", () => {
    const text = report(snapshot(), snapshot(), options);
    expect(text.startsWith(`${marker}\n`)).toBe(true);
    expect(text).toContain("`0123456` vs `main`");
    expect(text).toContain("No significant bundle size changes vs `main`.");
    expect(text).not.toContain("Changed sizes");
    expect(text).toContain("<details>");
  });

  it("calls a move under the threshold no change", () => {
    const head = snapshot({ limits: [{ package: "@lunarhue/forms-core", name: ".", size: 9005, limit: 9450 }] });
    const base = snapshot({ limits: [{ package: "@lunarhue/forms-core", name: ".", size: 9000, limit: 9450 }] });
    expect(report(base, head, options)).toContain("No significant bundle size changes");
  });

  it("tables what moved, with the full tables folded away", () => {
    const head = snapshot({
      limits: [
        { package: "@lunarhue/forms-core", name: ".", size: 9062, limit: 9450 },
        { package: "@lunarhue/forms-react", name: "react, everything on", size: 18000 },
      ],
    });
    expect(report(snapshot(), head, options)).toMatchInlineSnapshot(`
      "<!-- size-report -->

      ### Bundle size

      \`0123456\` vs \`main\`

      **Changed sizes**

      | Check | Entry | Base → PR | Δ |
      | --- | --- | ---: | ---: |
      | \`size-limit\` | core: . | 9,000 B → 9,062 B | +62 B / +0.7% |

      Bytes, brotli unless the entry says otherwise. Moves under 10 B are only in the full tables below.

      <details>
      <summary>All form sizes (<code>size:forms</code>)</summary>

      Minified, brotli. React, Solid and Valibot are external.

      | Form | React prod | React dev | Solid prod | Solid dev |
      | --- | ---: | ---: | ---: | ---: |
      | Bare form | 4,000 B | 6,000 B | 3,800 B | 5,600 B |
      | Everything on | 9,000 B | 14,000 B | 8,800 B | 13,500 B |

      </details>

      <details>
      <summary>All size-limit entries</summary>

      | Package | Entry | Size | Δ | Limit | Headroom |
      | --- | --- | ---: | ---: | ---: | ---: |
      | core | . | 9,062 B | +62 B / +0.7% | 9,450 B | 388 B (4.1%) |
      | react | react, everything on | 18,000 B | 0 B / 0.0% | none |  |

      </details>
      "
    `);
  });

  it("shows form deltas in the full table", () => {
    const base = snapshot();
    const head = snapshot({
      forms: { columns, rows: [{ name: "Bare form", sizes: { "React prod": 4040, "React dev": 6000, "Solid prod": 3800, "Solid dev": 5600 } }] },
    });
    const text = report(base, head, options);
    expect(text).toContain("| `size:forms` | Bare form (React prod) | 4,000 B → 4,040 B | +40 B / +1.0% |");
    expect(text).toContain("| Bare form | 4,040 B (+40 B) | 6,000 B | 3,800 B | 5,600 B |");
    expect(text).toContain("| `size:forms` | Everything on (React prod) | 9,000 B → none | removed |");
    expect(text).toContain("| Everything on | removed | removed | removed | removed |");
  });

  it("marks new and removed entries", () => {
    const base = snapshot({ limits: [limit("gone", 500, 600)] });
    const head = snapshot({ limits: [limit("new", 700)] });
    const text = report(base, head, options);
    expect(text).toContain("| `size-limit` | core: new | none → 700 B | new |");
    expect(text).toContain("| `size-limit` | core: gone | 500 B → none | removed |");
    expect(text).toContain("| core | gone | removed | removed |  |  |");
    expect(text).not.toContain("limit removed");
  });

  it("lists a raised limit and notes it in the table", () => {
    const base = snapshot({ limits: [limit(".", 9000, 9450)] });
    const head = snapshot({ limits: [limit(".", 9000, 9600)] });
    const text = report(base, head, options);
    expect(text).toContain("| Check | Entry | Base → PR | Δ | Note |\n| --- | --- | ---: | ---: | --- |");
    expect(text).toContain("| core: . | 9,000 B → 9,000 B | 0 B / 0.0% | limit raised to 9,600 B |");
    expect(text).toContain("**Raised limits.**");
    expect(text).toContain("- core: ., 9,450 B → 9,600 B (+150 B)");
    expect(text).toContain("| core | . | 9,000 B | 0 B / 0.0% | 9,450 B → 9,600 B | 600 B (6.3%) |");
  });

  it("notes an entry over its limit", () => {
    const base = snapshot({ limits: [limit(".", 9400, 9450)] });
    const head = snapshot({ limits: [limit(".", 9500, 9450)] });
    const text = report(base, head, options);
    expect(text).toContain("over the 9,450 B limit");
    expect(text).toContain("over by 50 B");
  });

  it("adds the comparison apps when sizes.json changed", () => {
    const base = snapshot({ compare: { signup: { lunarhue: { forms: { brotli: 12267 } } } } });
    const head = snapshot({ compare: { signup: { lunarhue: { forms: { brotli: 12300 } } } } });
    expect(report(base, head, options)).toContain(
      "| signup | lunarhue | Forms + app | 12,267 B → 12,300 B | +33 B / +0.3% |",
    );
    expect(report(base, base, options)).not.toContain("Comparison apps");
  });

  it("compares no form sizes with a base that has no size:forms", () => {
    const text = report(snapshot({ forms: null }), snapshot(), options);
    expect(text).toContain("No significant bundle size changes");
    expect(text).toContain("The base has no `size:forms`");
    expect(text).toContain("| Bare form | 4,000 B | 6,000 B | 3,800 B | 5,600 B |");
  });

  it("prints the head alone without a base", () => {
    const text = report(null, snapshot(), options);
    expect(text).toContain("nothing to compare with");
    expect(text).not.toContain("Changed sizes");
    expect(text).toContain("| core | . | 9,000 B |  | 9,450 B | 450 B (4.8%) |");
  });
});
