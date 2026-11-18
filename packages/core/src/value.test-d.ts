import { describe, expectTypeOf, it } from "vitest";
import type { Draft, Widened } from "./index.js";

class Point {
  x = 0;
}

interface Tree {
  label: string;
  weight: number;
  children: Tree[];
}

declare const tree: Draft<Tree>;

describe("Draft", () => {
  it("keeps strings and booleans, also with null or undefined", () => {
    expectTypeOf<Draft<string>>().toEqualTypeOf<string>();
    expectTypeOf<Draft<boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<Draft<string | undefined>>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Draft<string | null>>().toEqualTypeOf<string | null>();
    expectTypeOf<Draft<boolean | null | undefined>>().toEqualTypeOf<boolean | null | undefined>();
  });

  it("adds undefined to numbers, bigints, symbols, dates, maps, sets and functions", () => {
    expectTypeOf<Draft<number>>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Draft<bigint>>().toEqualTypeOf<bigint | undefined>();
    expectTypeOf<Draft<symbol>>().toEqualTypeOf<symbol | undefined>();
    expectTypeOf<Draft<Date>>().toEqualTypeOf<Date | undefined>();
    expectTypeOf<Draft<Map<string, number>>>().toEqualTypeOf<Map<string, number> | undefined>();
    expectTypeOf<Draft<Set<string>>>().toEqualTypeOf<Set<string> | undefined>();
    expectTypeOf<Draft<() => void>>().toEqualTypeOf<(() => void) | undefined>();
    expectTypeOf<Draft<number | null>>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<Draft<number | undefined>>().toEqualTypeOf<number | undefined>();
  });

  it("keeps a single literal and adds undefined to a union of literals", () => {
    expectTypeOf<Draft<"a">>().toEqualTypeOf<"a">();
    expectTypeOf<Draft<1>>().toEqualTypeOf<1>();
    expectTypeOf<Draft<1n>>().toEqualTypeOf<1n>();
    expectTypeOf<Draft<true>>().toEqualTypeOf<true>();
    expectTypeOf<Draft<"a" | undefined>>().toEqualTypeOf<"a" | undefined>();
    expectTypeOf<Draft<"a" | "b">>().toEqualTypeOf<"a" | "b" | undefined>();
    expectTypeOf<Draft<1 | 2>>().toEqualTypeOf<1 | 2 | undefined>();
    expectTypeOf<Draft<"a" | 1>>().toEqualTypeOf<"a" | 1 | undefined>();
    expectTypeOf<Draft<"a" | boolean>>().toEqualTypeOf<"a" | boolean | undefined>();
  });

  it("adds undefined to a plain union of other members", () => {
    expectTypeOf<Draft<string | number>>().toEqualTypeOf<string | number | undefined>();
    expectTypeOf<Draft<string | { a: string }>>().toEqualTypeOf<string | { a: string } | undefined>();
    expectTypeOf<Draft<string[] | number[]>>().toEqualTypeOf<string[] | (number | undefined)[] | undefined>();
  });

  it("drafts array items and keeps readonly arrays readonly", () => {
    expectTypeOf<Draft<string[]>>().toEqualTypeOf<string[]>();
    expectTypeOf<Draft<number[]>>().toEqualTypeOf<(number | undefined)[]>();
    expectTypeOf<Draft<readonly number[]>>().toEqualTypeOf<readonly (number | undefined)[]>();
    expectTypeOf<Draft<{ n: number }[]>>().toEqualTypeOf<{ n: number | undefined }[]>();
  });

  it("keeps array items that are a union of literals", () => {
    type Channel = "email" | "sms" | "push";
    expectTypeOf<Draft<Channel[]>>().toEqualTypeOf<Channel[]>();
    expectTypeOf<Draft<readonly Channel[]>>().toEqualTypeOf<readonly Channel[]>();
    expectTypeOf<Draft<(1 | 2)[]>>().toEqualTypeOf<(1 | 2)[]>();
    expectTypeOf<Draft<("a" | boolean)[]>>().toEqualTypeOf<("a" | boolean)[]>();
    expectTypeOf<Draft<(Channel | undefined)[]>>().toEqualTypeOf<(Channel | undefined)[]>();
    expectTypeOf<Draft<(Channel | null)[]>>().toEqualTypeOf<(Channel | null)[]>();
    expectTypeOf<Draft<Channel[][]>>().toEqualTypeOf<Channel[][]>();
    expectTypeOf<Draft<{ channels: Channel[] }>>().toEqualTypeOf<{ channels: Channel[] }>();
    expectTypeOf<Draft<Channel[] | undefined>>().toEqualTypeOf<Channel[] | undefined>();
  });

  it("still drafts other array items", () => {
    expectTypeOf<Draft<Date[]>>().toEqualTypeOf<(Date | undefined)[]>();
    expectTypeOf<Draft<bigint[]>>().toEqualTypeOf<(bigint | undefined)[]>();
    expectTypeOf<Draft<(number | null)[]>>().toEqualTypeOf<(number | null | undefined)[]>();
    expectTypeOf<Draft<(string | number)[]>>().toEqualTypeOf<(string | number | undefined)[]>();
    expectTypeOf<Draft<number[][]>>().toEqualTypeOf<(number | undefined)[][]>();
    expectTypeOf<Draft<{ sku: "a" | "b"; qty: number }[]>>().toEqualTypeOf<
      { sku: "a" | "b" | undefined; qty: number | undefined }[]
    >();
    type Line = { kind: "item"; qty: number; size: "s" | "m" } | { kind: "note"; text: string };
    expectTypeOf<Draft<Line[]>>().toEqualTypeOf<
      ({ kind: "item"; qty: number | undefined; size: "s" | "m" | undefined } | { kind: "note"; text: string })[]
    >();
  });

  it("drafts tuple elements and adds undefined to the tuple", () => {
    expectTypeOf<Draft<[string, number]>>().toEqualTypeOf<[string, number | undefined] | undefined>();
    expectTypeOf<Draft<readonly [boolean]>>().toEqualTypeOf<readonly [boolean] | undefined>();
    expectTypeOf<Draft<["a" | "b"]>>().toEqualTypeOf<["a" | "b" | undefined] | undefined>();
    expectTypeOf<Draft<["a" | "b"][]>>().toEqualTypeOf<(["a" | "b" | undefined] | undefined)[]>();
  });

  it("drafts each property of a plain object and keeps its modifiers", () => {
    expectTypeOf<Draft<{ name: string; age: number; readonly tags?: string[]; born?: Date | undefined }>>().toEqualTypeOf<{
      name: string;
      age: number | undefined;
      readonly tags?: string[];
      born?: Date | undefined;
    }>();
    expectTypeOf<Draft<{ address: { zip: number } | undefined }>>().toEqualTypeOf<{
      address: { zip: number | undefined } | undefined;
    }>();
  });

  it("drafts each member of a union of objects and keeps each discriminant", () => {
    type Shape = { kind: "circle"; radius: number } | { kind: "label"; text: string };
    expectTypeOf<Draft<Shape>>().toEqualTypeOf<
      { kind: "circle"; radius: number | undefined } | { kind: "label"; text: string }
    >();
    expectTypeOf<Draft<Shape | null>>().toEqualTypeOf<
      { kind: "circle"; radius: number | undefined } | { kind: "label"; text: string } | null
    >();
  });

  it("reads a class instance other than a leaf as a plain object", () => {
    expectTypeOf<Draft<Point>>().toEqualTypeOf<{ x: number | undefined }>();
  });

  it("keeps unknown, any and never", () => {
    expectTypeOf<Draft<unknown>>().toEqualTypeOf<unknown>();
    expectTypeOf<Draft<any>>().toBeAny();
    expectTypeOf<Draft<never>>().toBeNever();
    expectTypeOf<Draft<{ data: unknown }>>().toEqualTypeOf<{ data: unknown }>();
  });

  it("handles recursive types", () => {
    expectTypeOf(tree.label).toEqualTypeOf<string>();
    expectTypeOf(tree.weight).toEqualTypeOf<number | undefined>();
    expectTypeOf(tree.children).items.toEqualTypeOf<Draft<Tree>>();
    expectTypeOf(tree.children[0]!.children[0]!.weight).toEqualTypeOf<number | undefined>();
    expectTypeOf<Tree>().toExtend<Draft<Tree>>();
  });
});

describe("Widened", () => {
  it("keeps an object that holds itself", () => {
    interface Node {
      n: Node[];
    }
    interface Chain {
      label: string;
      next: Chain | null;
    }
    expectTypeOf<Widened<Node>>().toEqualTypeOf<Node>();
    expectTypeOf<Widened<Chain>>().toEqualTypeOf<Chain>();
    expectTypeOf<Widened<Tree>>().toEqualTypeOf<Tree>();
  });

  it("keeps an array whose items hold the array's owner", () => {
    interface Menu {
      items: { label: string; submenu?: Menu }[];
    }
    expectTypeOf<Widened<Menu>>().toEqualTypeOf<Menu>();
    expectTypeOf<Widened<Menu["items"]>>().toEqualTypeOf<Menu["items"]>();
  });

  it("keeps two types that refer to each other", () => {
    interface Folder {
      name: string;
      files: Entry[];
    }
    interface Entry {
      name: string;
      parent: Folder;
    }
    expectTypeOf<Widened<Folder>>().toEqualTypeOf<Folder>();
    expectTypeOf<Widened<Entry>>().toEqualTypeOf<Entry>();
  });

  it("still widens literals around a recursive type", () => {
    interface Node {
      n: Node[];
    }
    expectTypeOf<Widened<{ readonly flag: false; readonly root: Node }>>().toEqualTypeOf<{ flag: boolean; root: Node }>();
  });
});
