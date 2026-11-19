import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createForms, type FormOf, useForm } from "./index.js";
import { dirty } from "./plugins.js";
import { type Commits, settle, useCommits } from "./test/helpers.js";

const commits: Commits = new Map();
beforeEach(() => commits.clear());

// Lets a test hold a submit open, so `submitting` stays true until it calls `release`.
const gate: { release?: () => void } = {};
const post = createForms({ plugins: [dirty()] }).define({
  defaultValues: { title: "", body: "" },
  onSubmit: async (value) => {
    await new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    return value.title.length;
  },
});
type PostForm = FormOf<typeof post>;
const holder: { form?: PostForm } = {};
const current = (): PostForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

// Shows a value and counts its own commits under `name`.
function Shown(props: { readonly name: string; readonly text: string }) {
  useCommits(commits, props.name);
  return <p data-testid={props.name}>{props.text}</p>;
}

function SavePage() {
  const form = useForm(post);
  useEffect(() => {
    holder.form = form;
  });
  useCommits(commits, "page");
  return (
    <form.State select={(snapshot) => snapshot.submission.status === "submitting"}>
      {(submitting, owner) => <Shown name="state" text={`${String(submitting)} ${String(owner === form)}`} />}
    </form.State>
  );
}

function CountPage() {
  const form = useForm(post);
  useEffect(() => {
    holder.form = form;
  });
  useCommits(commits, "page");
  return (
    <form.Form>
      <form.State select={(snapshot) => snapshot.submitCount} isEqual={(a, b) => (a > 0) === (b > 0)}>
        {(count) => <Shown name="count" text={String(count)} />}
      </form.State>
    </form.Form>
  );
}

/** A submit held at the gate. */
interface Held {
  readonly running: Promise<unknown>;
}

/** Starts a submit and waits until it is held at the gate. */
async function startSubmit(): Promise<Held> {
  let running: Promise<unknown> = Promise.resolve();
  await act(async () => {
    running = current().submit();
    await settle();
  });
  return { running };
}

/** Lets a held submit finish. */
async function finishSubmit(held: Held): Promise<void> {
  await act(async () => {
    gate.release?.();
    await held.running;
  });
}

async function submitAndRelease(): Promise<void> {
  await finishSubmit(await startSubmit());
}

describe("form.State", () => {
  it("re-renders its children when the selected value changes, and nothing else", async () => {
    render(<SavePage />);
    expect(screen.getByTestId("state").textContent).toBe("false true");
    const root = current().root;

    commits.clear();
    act(() => root.at("title").setValue("Hello"));
    act(() => root.at("title").handleBlur());
    act(() => root.at("body").setValue("Text"));
    expect(current().store.getFormSnapshot().dirty).toBe(true);
    expect(Object.fromEntries(commits)).toEqual({});

    const held = await startSubmit();
    expect(screen.getByTestId("state").textContent).toBe("true true");
    expect(Object.fromEntries(commits)).toEqual({ state: 1 });

    commits.clear();
    await finishSubmit(held);
    expect(screen.getByTestId("state").textContent).toBe("false true");
    expect(Object.fromEntries(commits)).toEqual({ state: 1 });
  });

  it("keeps the last value while isEqual says it is the same, inside form.Form too", async () => {
    render(<CountPage />);
    expect(screen.getByTestId("count").textContent).toBe("0");

    commits.clear();
    await submitAndRelease();
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(Object.fromEntries(commits)).toEqual({ count: 1 });

    commits.clear();
    await submitAndRelease();
    expect(current().store.getFormSnapshot().submitCount).toBe(2);
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(Object.fromEntries(commits)).toEqual({});
  });

  it("keeps its identity for the life of the form", () => {
    const { rerender } = render(<SavePage />);
    const first = current().State;
    rerender(<SavePage />);
    expect(current().State).toBe(first);
  });
});
