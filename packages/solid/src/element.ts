import type { createComponent } from "solid-js";

/**
 * What a Solid component returns: `Element` in Solid 2 and `JSX.Element` in
 * Solid 1. Named through `createComponent`, which both majors export, so one
 * set of declarations serves both entries.
 */
export type SolidElement = ReturnType<typeof createComponent>;
