import { scenario } from "../scenario.js";

export interface Line {
  description: string;
  quantity: number;
  price: number;
}

export interface Order {
  customer: { name: string; email: string };
  lines: Line[];
}

/** Formats an amount of money. */
const money = (amount: number): string => amount.toFixed(2);

/** One line's total. */
const lineTotal = (line: Readonly<Line>): number => line.quantity * line.price;

/** The order's total. */
const orderTotal = (lines: readonly Readonly<Line>[]): number => lines.reduce((sum, line) => sum + lineTotal(line), 0);

const labels = {
  name: "Customer name",
  email: "Customer email",
  description: (index: number) => `Item ${index + 1} description`,
  quantity: (index: number) => `Item ${index + 1} quantity`,
  price: (index: number) => `Item ${index + 1} price`,
};

/**
 * An order with line items, where every field and part has a render counter.
 * Typing in one field must not rerender another, and a new quantity must
 * rerender that field and the totals, never the row.
 */
export const rendersScenario = {
  ...scenario("renders", "Render isolation", {
    values: {
      [labels.name]: "Ada Lovelace",
      [labels.description(0)]: "Analytical engine manual",
      [labels.quantity(0)]: "1",
      [labels.quantity(1)]: "3",
    },
  }),
  labels,
  money,
  lineTotal,
  orderTotal,
  /** Ids of the render counters that aren't a field's. A field's counter id is its name. */
  counters: {
    page: "page",
    row: (index: number) => `row-${index}`,
    lineTotal: (index: number) => `line-total-${index}`,
    orderTotal: "order-total",
  },
  /** Test ids of the totals' text. */
  totals: {
    line: (index: number) => `line-total-text-${index}`,
    order: "order-total-text",
  },
  submit: { idle: "Place order", busy: "Placing..." },
  definition: {
    defaultValues: {
      customer: { name: "Ada Lovelace", email: "ada@example.com" },
      lines: [
        { description: "Analytical engine manual", quantity: 1, price: 12.5 },
        { description: "Punched cards", quantity: 3, price: 2 },
      ],
    },
    onSubmit: (value: Order) => `Ordered ${value.lines.length} lines.`,
  },
};
