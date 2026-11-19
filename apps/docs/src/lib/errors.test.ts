import { describe, expect, it } from "vitest";

import { errorAnchors } from "./errors";

describe("errorAnchors", () => {
  it("lists the anchors in page order, split into package and code", () => {
    const source = [
      "## Core",
      '<a id="core:plugins:name"></a>',
      "### `plugins:name`",
      "## React",
      '<a id="react:context:form"></a>',
    ].join("\n\n");
    expect(errorAnchors(source)).toEqual([
      { id: "core:plugins:name", package: "core", code: "plugins:name" },
      { id: "react:context:form", package: "react", code: "context:form" },
    ]);
  });

  it("rejects an anchor without a package", () => {
    expect(() => errorAnchors('<a id="plugins"></a>')).toThrow('anchor "plugins" has no package');
  });
});
