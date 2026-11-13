import * as v from "valibot";
import { scenario } from "../scenario.js";

const Team = v.object({
  members: v.array(v.object({ name: v.pipe(v.string(), v.nonEmpty("Enter a name.")) })),
});

const member = (index: number): string => `Member ${index + 1}`;

/** A list of rows: push, insert, remove and move, with each row's DOM, focus and errors kept. */
export const arraysScenario = {
  ...scenario("arrays", "Arrays", {
    values: { [member(0)]: "Charles Babbage", [member(1)]: "Mary Somerville" },
  }),
  labels: {
    member,
    add: "Add member",
    insertAbove: (index: number) => `Insert above member ${index + 1}`,
    moveUp: (index: number) => `Move member ${index + 1} up`,
    moveDown: (index: number) => `Move member ${index + 1} down`,
    remove: (index: number) => `Remove member ${index + 1}`,
  },
  errors: { name: "Enter a name." },
  submit: { idle: "Save team", busy: "Saving..." },
  /** The row that push and insert add. */
  emptyMember: (): { name: string } => ({ name: "" }),
  definition: {
    schema: Team,
    defaultValues: { members: [{ name: "Charles Babbage" }, { name: "Mary Somerville" }] },
    onSubmit: (value: v.InferOutput<typeof Team>) => `Saved ${value.members.length} members.`,
  },
};
