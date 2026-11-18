import reactPackage from "@lunarhue/forms-react/package.json";

export interface Version {
  /** The version number, also the URL segment for an older version. */
  readonly id: string;
  /** The latest version's URLs have no version segment. */
  readonly latest: boolean;
}

/** The adapters release together, so the React package's version is the docs version. */
export const LATEST_VERSION: string = reactPackage.version;

/** Newest first. */
export const VERSIONS: readonly Version[] = [{ id: LATEST_VERSION, latest: true }];

export const isVersion = (value: string): boolean => VERSIONS.some((version) => version.id === value);
