// The panel's stylesheet. It goes in the panel's shadow root, so the page's
// styles can't reach it and these can't leak out. The colours are the docs
// site's devtools tokens: the panel stays dark on light and dark pages.
export const css = `
:host {
  all: initial;
}

.root {
  --bg: #18191c;
  --raised: #222327;
  --fg: #ececee;
  --soft: #b4b6bc;
  --muted: #8f9198;
  --border: #2c2e33;
  --thumb: #3d4047;
  --hover: rgb(255 255 255 / 0.06);
  --active: #262d40;
  --brand: #4c7dff;
  --brand-tint: rgb(76 125 255 / 0.14);
  --error: #f0716a;
  --outline: #b8b8b1;
  --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font: 13px/20px var(--mono);
  color: var(--fg);
  color-scheme: dark;
  -webkit-font-smoothing: antialiased;
}

.root *,
.root *::before,
.root *::after {
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--thumb) transparent;
}

.root ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.root ::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 5px;
  background: var(--thumb) padding-box;
}

.root ::-webkit-scrollbar-track,
.root ::-webkit-scrollbar-corner {
  background: transparent;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 2px solid rgb(76 125 255 / 0.7);
  outline-offset: -2px;
}

a {
  color: var(--brand);
}

svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.muted {
  color: var(--muted);
}

.error {
  color: var(--error);
}

.surface {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);
}

/* The dock: the bar in a corner, with the open tab's panel on its far side from the corner. */

.dock {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  gap: 8px;
  max-width: calc(100vw - 48px);
}

.dock[data-corner^="bottom"] {
  bottom: 24px;
  flex-direction: column;
}

.dock[data-corner^="top"] {
  top: 24px;
  flex-direction: column-reverse;
}

.dock[data-corner$="left"] {
  left: 24px;
}

.dock[data-corner$="right"] {
  right: 24px;
}

.bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 40px;
  padding: 0 3px;
}

.bar.notice {
  padding: 0 12px;
  font: 13px/20px var(--sans);
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--soft);
}

.icon:hover,
.icon[aria-expanded="true"] {
  background: var(--hover);
  color: var(--fg);
}

.icon[aria-pressed="true"] {
  background: var(--active);
  color: var(--fg);
}

.icon.small {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.icon.small svg {
  width: 12px;
  height: 12px;
}

.chip {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 180px;
  height: 32px;
  padding-right: 6px;
  border-radius: 6px;
}

.chip:hover,
.chip:has([aria-expanded="true"]) {
  background: var(--hover);
}

.chip-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 100%;
  padding-left: 8px;
}

.chip .icon {
  margin-left: 2px;
  color: var(--muted);
}

.chip .icon:hover {
  background: var(--hover);
}

.chip-main > svg {
  width: 12px;
  height: 12px;
  color: var(--muted);
}

.swatch {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border: 1.5px solid var(--muted);
  border-radius: 3px;
}

.swatch.on {
  border-color: var(--brand);
}

.divider {
  flex-shrink: 0;
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--border);
}

.tabs {
  display: flex;
  gap: 2px;
}

.tab {
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  font: 13px/20px var(--sans);
  color: var(--soft);
  white-space: nowrap;
}

.tab:hover {
  color: var(--fg);
  background: var(--hover);
}

.tab[aria-selected="true"] {
  background: var(--active);
  color: var(--fg);
}

/* Menus open from their button, over the panel. */

.menu {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: 220px;
  padding: 4px;
}

.dock[data-corner^="bottom"] .menu {
  bottom: calc(100% + 4px);
}

.dock[data-corner^="top"] .menu,
.sheet .menu {
  top: calc(100% + 4px);
}

.menu-label {
  padding: 6px 8px 2px;
  font: 12px/20px var(--sans);
  color: var(--muted);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
  font-family: var(--sans);
  text-align: left;
}

.menu-item:hover,
.menu-item:focus-visible {
  background: var(--hover);
  outline: none;
}

.menu-item svg {
  width: 14px;
  height: 14px;
  color: var(--muted);
}

.menu-item .check {
  margin-left: auto;
  color: var(--brand);
}

.menu-separator {
  height: 1px;
  margin: 4px -4px;
  background: var(--border);
}

/* The panel takes the bar's width and never widens it. */

.panel {
  display: flex;
  flex-direction: column;
  width: 0;
  min-width: 100%;
  max-height: min(560px, calc(100vh - 120px));
  overflow: hidden;
}

.empty {
  margin: 0;
  padding: 16px;
  font: 13px/20px var(--sans);
  color: var(--muted);
}

.toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  font: 12px/20px var(--sans);
  color: var(--muted);
}

.toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toolbar input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--brand);
}

.toolbar .count {
  margin-left: auto;
}

.scroll {
  overflow: auto;
  min-height: 0;
}

/* Fields */

.tree {
  flex: 1 1 auto;
  margin: 0;
  padding: 8px 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 4px 16px 4px calc(10px + var(--depth, 0) * 16px);
}

.row:hover {
  background: rgb(255 255 255 / 0.03);
}

.row[aria-current="true"] {
  background: var(--active);
  box-shadow: inset 2px 0 var(--brand);
}

.twisty {
  width: 16px;
  height: 20px;
  border-radius: 4px;
  color: var(--muted);
}

.twisty svg {
  width: 14px;
  height: 14px;
}

.twisty[aria-expanded="false"] svg {
  transform: rotate(-90deg);
}

.leaf {
  flex-shrink: 0;
  width: 16px;
}

.row-main {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  min-width: 0;
  text-align: left;
}

.row-value {
  color: var(--muted);
}

.flags {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  font: 12px/20px var(--sans);
  color: var(--muted);
}

.flag-invalid {
  color: var(--error);
}

.flag-validating {
  color: var(--fg);
}

.row-error {
  grid-column: 1 / -1;
  font: 12px/18px var(--sans);
}

.detail {
  flex: 0 0 auto;
  max-height: 50%;
  border-top: 1px solid var(--border);
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--border);
}

.detail-head strong {
  font-weight: 500;
}

.detail-head .icon {
  margin-left: auto;
}

.facts {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  padding: 12px 16px;
}

.facts dt {
  font: 12px/20px var(--sans);
  color: var(--muted);
}

.facts dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.facts ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

pre {
  margin: 0;
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.source {
  font-family: var(--sans);
  font-size: 12px;
  color: var(--muted);
}

/* Log and Plugins */

.log,
.plugins {
  margin: 0;
  padding: 8px 0;
  list-style: none;
}

.log-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 12px;
  padding: 4px 16px;
}

.log-item > :first-child,
.log-item > :last-child {
  font: 12px/20px var(--sans);
}

.log-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.plugin + .plugin {
  border-top: 1px solid var(--border);
}

.plugin-head {
  display: flex;
  gap: 12px;
  padding: 12px 16px 0;
}

.plugin-head .muted {
  width: 16px;
  font-family: var(--sans);
}

/* Bundle */

.bundle {
  padding-bottom: 8px;
}

.note {
  margin: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  font: 12px/18px var(--sans);
}

code {
  font: 12px var(--mono);
  color: var(--brand);
}

.sizes {
  width: 100%;
  margin-top: 4px;
  border-collapse: collapse;
}

.sizes th,
.sizes td {
  height: 28px;
  padding: 0 16px;
  text-align: left;
  font-weight: normal;
}

.sizes thead th {
  font: 12px/20px var(--sans);
  color: var(--muted);
}

.sizes tfoot th,
.sizes tfoot td {
  border-top: 1px solid var(--border);
}

.sizes .num {
  text-align: right;
  white-space: nowrap;
}

/* On the page: form outlines with their tags, field outlines and the hover card. */

.outline {
  position: fixed;
  z-index: 2147482999;
  pointer-events: none;
}

.outline.form {
  border: 1px dashed var(--outline);
  border-radius: 0 6px 6px 6px;
}

.outline.form:has(.tag:hover) {
  border-color: var(--brand);
}

.outline.form.on {
  border: 1px solid var(--brand);
}

.tag {
  position: absolute;
  bottom: 100%;
  left: -1px;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100% + 2px);
  height: 24px;
  padding: 0 8px;
  border-radius: 4px 4px 0 0;
  background: var(--bg);
  font: 12px/16px var(--mono);
  color: #fff;
  pointer-events: auto;
}

.tag.inside {
  top: -1px;
  bottom: auto;
  border-radius: 0 0 4px 0;
}

.tag svg {
  width: 12px;
  height: 12px;
}

.tag:hover,
.on > .tag {
  background: var(--brand);
}

.outline.field {
  border: 2px solid var(--brand);
  border-radius: 4px;
  background: var(--brand-tint);
}

.card {
  position: fixed;
  z-index: 2147483001;
  display: flex;
  flex-direction: column;
  max-height: min(420px, calc(100vh - 16px));
  overflow: auto;
}

.card .detail-head .muted {
  font: 12px/20px var(--sans);
}

.tip {
  position: fixed;
  z-index: 2147483002;
  max-width: 220px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--raised);
  font: 12px/16px var(--sans);
  color: var(--fg);
  pointer-events: none;
  transform: translate(-50%, -100%);
}

.tip.below {
  transform: translateX(-50%);
}

/* Phones: a button that opens a bottom sheet. */

.fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483000;
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.fab svg {
  width: 20px;
  height: 20px;
}

.sheet {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  border-width: 1px 0 0;
  border-radius: 12px 12px 0 0;
}

.grip {
  width: 36px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 2px;
  background: var(--thumb);
}

.sheet-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 48px;
  padding: 0 8px;
}

.sheet-head .chip {
  max-width: none;
}

.sheet-head .end {
  display: flex;
  margin-left: auto;
}

.sheet .tabs {
  padding: 0 8px 8px;
  border-bottom: 1px solid var(--border);
}

.sheet .tab {
  flex: 1;
}

.sheet .panel {
  max-height: none;
  min-height: 128px;
  border: 0;
}
`;
