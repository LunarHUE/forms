import { FRAMEWORKS, type Framework } from "@/lib/frameworks";
import type { Alternate } from "@/lib/nav";
import { docHref, frameworkHref } from "@/lib/routes";
import { VERSIONS } from "@/lib/versions";

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
  const versionItems = VERSIONS.map(
    ({ id, latest }): PickerItem => ({
      group: "version",
      value: id,
      label: id,
      href: slug ? docHref({ framework, version: id, slug }) : frameworkHref(framework, id),
      hint: latest ? "latest" : undefined,
    }),
  );
  return [...frameworkItems, ...versionItems];
}
