import {
  bundledLanguages,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
  type ThemeRegistration,
} from "shiki";

/**
 * Two small themes after the Paper mock: keywords in the accent, strings and
 * comments muted, everything else in the text colour. The hex values repeat
 * the tokens in `styles/global.css`, because Shiki needs literal colours.
 */
function theme(
  name: string,
  type: "light" | "dark",
  colors: { foreground: string; keyword: string; string: string; comment: string },
): ThemeRegistration {
  return {
    name,
    type,
    colors: { "editor.background": "transparent", "editor.foreground": colors.foreground },
    tokenColors: [
      { settings: { foreground: colors.foreground } },
      {
        scope: [
          "keyword",
          "storage",
          "storage.type",
          "storage.modifier",
          "support.type.primitive",
          "support.type.builtin",
          "constant.language",
          "variable.language.this",
        ],
        settings: { foreground: colors.keyword },
      },
      // Operators read as punctuation in the mock: `=>`, `=`, `...`.
      { scope: ["keyword.operator", "storage.type.function.arrow"], settings: { foreground: colors.foreground } },
      {
        scope: ["keyword.operator.new", "keyword.operator.expression", "keyword.operator.word"],
        settings: { foreground: colors.keyword },
      },
      {
        scope: ["string", "string.template", "punctuation.definition.string"],
        settings: { foreground: colors.string },
      },
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: colors.comment, fontStyle: "italic" },
      },
    ],
  };
}

export const lightTheme = theme("forms-light", "light", {
  foreground: "#18191c",
  keyword: "#3a6cf0",
  string: "#6b6c68",
  comment: "#93948f",
});

export const darkTheme = theme("forms-dark", "dark", {
  foreground: "#ececea",
  keyword: "#7c9dff",
  string: "#93948f",
  comment: "#6b6c68",
});

/** Loaded up front; anything else Shiki bundles loads on first use. */
const PRELOADED: BundledLanguage[] = ["tsx", "ts", "jsx", "js", "json", "sh", "css", "html"];

let highlighter: Promise<Highlighter> | undefined;

/** One highlighter for the whole build. Creating one per block would reload the grammars every time. */
function getHighlighter() {
  highlighter ??= createHighlighter({ themes: [lightTheme, darkTheme], langs: PRELOADED });
  return highlighter;
}

/**
 * Highlight source at build time, in Astro frontmatter, never in an island.
 * Each token carries both palettes as `--shiki-light` and `--shiki-dark`
 * (`defaultColor: false`), and `CodeBlock` picks one by whether `.dark` is on
 * `<html>`, so a theme switch needs no rerender. A language Shiki doesn't
 * bundle renders as plain text.
 */
export async function highlight(code: string, lang = "text"): Promise<string> {
  const shiki = await getHighlighter();
  const known = lang in bundledLanguages;
  if (known && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(lang as BundledLanguage);
  }
  return shiki.codeToHtml(code.replace(/\n$/, ""), {
    lang: known ? lang : "text",
    themes: { light: lightTheme, dark: darkTheme },
    defaultColor: false,
  });
}
