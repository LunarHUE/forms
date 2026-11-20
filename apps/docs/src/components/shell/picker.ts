import { FRAMEWORKS, type Framework } from "@/lib/frameworks";
import type { Alternate } from "@/lib/nav";
import { docHref, frameworkHref } from "@/lib/routes";
import { CHANNEL, CHANNEL_URLS } from "@/lib/site";
import { VERSIONS } from "@/lib/versions";

/** The version item for main's docs, which the next site serves. */
const NEXT = "next";

/**
 * The version the picker shows as current. The next site says "next": main
 * keeps the last release's version number until the version bump.
 */
export const pickerVersion = (version: string): string => (CHANNEL === "next" ? NEXT : version);

export interface PickerItem {
  group: "framework" | "version";
  value: string;
  label: string;
  /**
   * Where picking the item goes. A framework item without one only switches
   * the last-used framework, which is how the framework-free pages (errors,
   * 404) swap their sidebar.
   */
  href?: string;
  disabled?: boolean;
  hint?: string;
}

export interface PickerOptions {
  framework: Framework;
  /** The page's slug. Without it, version items go to the framework's Introduction. */
  slug?: string;
  /** The same page in each framework, from `alternates()`. Without it, framework items carry no href. */
  alternates?: readonly Alternate[];
}

/** The framework group and the version group of the sidebar picker, in display order. */
export function pickerItems({ framework, slug, alternates }: PickerOptions): PickerItem[] {
  const frameworkItems = FRAMEWORKS.map((info): PickerItem => {
    const item: PickerItem = { group: "framework", value: info.id, label: info.label };
    if (!info.available) return { ...item, disabled: true, hint: "Soon" };
    const href = alternates?.find((alternate) => alternate.framework === info.id)?.href;
    return href ? { ...item, href } : item;
  });
  return [...frameworkItems, ...versionItems(framework, slug)];
}

/**
 * The version group. A release build lists its versions, then next on the
 * next site. The next site lists next, then the latest release on production.
 * The cross-site items open the same page there.
 */
function versionItems(framework: Framework, slug: string | undefined): PickerItem[] {
  const path = slug ? docHref({ framework, slug }) : frameworkHref(framework);
  if (CHANNEL === "next") {
    const release = new URL(path, CHANNEL_URLS.release).href;
    return [
      { group: "version", value: NEXT, label: NEXT, href: path, hint: "unreleased" },
      { group: "version", value: "latest", label: "latest", href: release, hint: "release" },
    ];
  }
  const released = VERSIONS.map(
    ({ id, latest }): PickerItem => ({
      group: "version",
      value: id,
      label: id,
      href: slug ? docHref({ framework, version: id, slug }) : frameworkHref(framework, id),
      hint: latest ? "latest" : undefined,
    }),
  );
  const next: PickerItem = {
    group: "version",
    value: NEXT,
    label: NEXT,
    href: new URL(path, CHANNEL_URLS.next).href,
    hint: "unreleased",
  };
  return [...released, next];
}
