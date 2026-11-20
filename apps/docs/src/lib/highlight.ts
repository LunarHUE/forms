import {
  bundledLanguages,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
  type ThemeRegistration,
} from "shiki";

/** The colour of each token role, one set per theme. */
interface Palette {
  text: string;
  keyword: string;
  component: string;
  attribute: string;
  func: string;
  type: string;
  property: string;
  string: string;
  number: string;
  punctuation: string;
  comment: string;
}

/**
 * The two themes after the Paper mock ("Option B"). Rules go from general to
 * specific, so a narrower scope wins where two match: `support.class.component`
 * over `support.class`, an object key's function over `entity.name.function`,
 * `keyword.operator.new` over `keyword.operator`. Code inside `${}` goes back
 * to the text colour. The text and punctuation colours repeat
 * `--foreground` and `--muted-foreground` in `styles/global.css`, because
 * Shiki needs literal colours.
 */
function theme(name: string, type: "light" | "dark", colors: Palette): ThemeRegistration {
  return {
    name,
    type,
    colors: { "editor.background": "transparent", "editor.foreground": colors.text },
    tokenColors: [
      { settings: { foreground: colors.text } },
      {
        scope: [
          "punctuation",
          "meta.brace",
          "keyword.operator",
          "storage.type.function.arrow",
          "punctuation.definition.tag",
          "punctuation.section.embedded",
        ],
        settings: { foreground: colors.punctuation },
      },
      {
        scope: [
          "keyword",
          "storage",
          "storage.type",
          "storage.modifier",
          "variable.language.this",
          "variable.language.super",
          "keyword.operator.new",
          "keyword.operator.expression",
          "keyword.operator.word",
        ],
        settings: { foreground: colors.keyword },
      },
      {
        scope: ["string", "string.template", "punctuation.definition.string"],
        settings: { foreground: colors.string },
      },
      { scope: "meta.template.expression", settings: { foreground: colors.text } },
      {
        scope: ["constant.numeric", "constant.language", "support.constant"],
        settings: { foreground: colors.number },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "entity.other.inherited-class",
          "support.type",
          "support.class",
          "support.type.primitive",
          "support.type.builtin",
        ],
        settings: { foreground: colors.type },
      },
      { scope: ["entity.name.function", "support.function"], settings: { foreground: colors.func } },
      {
        scope: [
          "variable.other.property",
          "variable.other.object.property",
          "variable.other.constant.property",
          "support.variable.property",
          "meta.object-literal.key",
          "meta.object-literal.key entity.name.function",
        ],
        settings: { foreground: colors.property },
      },
      { scope: "entity.name.tag", settings: { foreground: colors.keyword } },
      { scope: "support.class.component", settings: { foreground: colors.component } },
      { scope: "entity.other.attribute-name", settings: { foreground: colors.attribute } },
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: colors.comment, fontStyle: "italic" },
      },
    ],
  };
}

export const lightTheme = theme("forms-light", "light", {
  text: "#18191c",
  keyword: "#3463e6",
  component: "#0b7780",
  attribute: "#4a5670",
  func: "#6a48cf",
  type: "#0b7780",
  property: "#4a5670",
  string: "#44762a",
  number: "#955600",
  punctuation: "#6b6c68",
  comment: "#70716c",
});

export const darkTheme = theme("forms-dark", "dark", {
  text: "#ececea",
  keyword: "#7c9dff",
  component: "#5fc3c9",
  attribute: "#aab3c5",
  func: "#b5a3ff",
  type: "#5fc3c9",
  property: "#aab3c5",
  string: "#a3c986",
  number: "#dfa95f",
  punctuation: "#93948f",
  comment: "#84857f",
});

const isBundled = (lang: string): lang is BundledLanguage => lang in bundledLanguages;

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
  const known = isBundled(lang);
  if (known && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(lang);
  }
  return shiki.codeToHtml(code.replace(/\n$/, ""), {
    lang: known ? lang : "text",
    themes: { light: lightTheme, dark: darkTheme },
    defaultColor: false,
    // Long lines scroll sideways; lib/edge-fade.ts softens the cut-off edge.
    transformers: [
      {
        pre(node) {
          node.properties["data-edge-fade"] = "x";
        },
      },
    ],
  });
}
