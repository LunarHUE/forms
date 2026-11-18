/** Framework ids, in picker order. The content schema validates against this list. */
export const FRAMEWORK_IDS = ["react", "solid", "vue"] as const;

export type Framework = (typeof FRAMEWORK_IDS)[number];

export interface FrameworkInfo {
  readonly id: Framework;
  readonly label: string;
  /** False for a framework the picker lists as coming soon. It has no pages. */
  readonly available: boolean;
}

export const FRAMEWORKS: readonly FrameworkInfo[] = [
  { id: "react", label: "React", available: true },
  { id: "solid", label: "Solid", available: true },
  { id: "vue", label: "Vue", available: false },
];

/** Frameworks that get pages. */
export const AVAILABLE_FRAMEWORKS: readonly Framework[] = FRAMEWORKS.filter((info) => info.available).map(
  (info) => info.id,
);

/** Where `/` goes when the visitor has no last-used framework. */
export const DEFAULT_FRAMEWORK: Framework = "react";

export const isFramework = (value: string): value is Framework =>
  (FRAMEWORK_IDS as readonly string[]).includes(value);

export const frameworkLabel = (framework: Framework): string =>
  FRAMEWORKS.find((info) => info.id === framework)?.label ?? framework;
