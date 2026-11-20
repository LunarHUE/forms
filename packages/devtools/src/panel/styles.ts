// The panel's stylesheet. It goes in the panel's shadow root, so the page's
// styles can't reach it and these can't leak out. The colours are the docs
// site's devtools tokens: the panel stays dark on light and dark pages.
export const css = `
:host {
  all: initial;
}

.root {
  --bg: #18191c;
  --fg: #e6e6e3;
  --muted: #8b8d93;
  --border: #2c2e33;
  --hover: rgb(255 255 255 / 0.08);
  --pressed: rgb(255 255 255 / 0.1);
  --brand: #4c7dff;
  --brand-tint: rgb(76 125 255 / 0.18);
  --error: #f07474;
  --mono: ui-monospace, "Geist Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font: 12px/18px var(--mono);
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}

.root *,
.root *::before,
.root *::after {
  box-sizing: border-box;
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
  outline: 2px solid rgb(76 125 255 / 0.6);
  outline-offset: 1px;
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
  align-items: flex-start;
}

.dock[data-corner$="right"] {
  right: 24px;
  align-items: flex-end;
}

.surface {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.24);
}

.bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 6px;
}

.bar.notice {
  padding: 0 12px;
  font-family: var(--sans);
  font-size: 13px;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--muted);
}

.icon:hover,
.icon[aria-expanded="true"] {
  background: var(--hover);
  color: var(--fg);
}

.icon[aria-pressed="true"] {
  background: var(--pressed);
  color: var(--fg);
}

.icon.small {
  width: 22px;
  height: 22px;
  margin-left: -4px;
}

.icon.small svg {
  width: 12px;
  height: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 180px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
}

.chip:hover,
.chip[aria-expanded="true"] {
  background: var(--hover);
}

.chip svg {
  width: 14px;
  height: 14px;
  color: var(--muted);
}

.swatch {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border: 1px solid var(--muted);
  border-radius: 2px;
}

.swatch.on {
  border-color: var(--brand);
}

.truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.muted {
  color: var(--muted);
}

.divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--border);
}

.tab {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--muted);
}

.tab:hover {
  color: var(--fg);
}

.tab[aria-selected="true"] {
  background: var(--pressed);
  color: var(--fg);
}

.menu {
  position: absolute;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 224px;
  padding: 4px;
}

.dock[data-corner^="bottom"] .menu {
  bottom: calc(100% + 8px);
}

.dock[data-corner^="top"] .menu {
  top: calc(100% + 8px);
}

.dock[data-corner$="left"] .menu {
  left: 0;
}

.dock[data-corner$="right"] .menu {
  right: 0;
}

.sheet .menu {
  top: calc(100% + 4px);
  left: 8px;
}

.menu-label {
  padding: 6px 8px 4px;
  color: var(--muted);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  text-align: left;
}

.menu-item:hover,
.menu-item:focus-visible {
  background: var(--pressed);
  outline: none;
}

.menu-item svg {
  width: 14px;
  height: 14px;
}

.menu-item .check {
  margin-left: auto;
  color: var(--brand);
}

.menu-separator {
  height: 1px;
  margin: 4px 0;
  background: var(--border);
}

.panel {
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: 100%;
  max-height: min(600px, calc(100vh - 120px));
  overflow: hidden;
}

.empty {
  padding: 16px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--muted);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
}

.toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.toolbar input {
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

.tree {
  flex: 1 1 auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 2px 12px 2px calc(12px + var(--depth, 0) * 14px);
}

.row:hover {
  background: rgb(255 255 255 / 0.04);
}

.row[aria-current="true"] {
  background: var(--brand-tint);
  box-shadow: inset 2px 0 var(--brand);
}

.twisty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 18px;
  color: var(--muted);
}

.twisty svg {
  width: 12px;
  height: 12px;
  transition: transform 0.1s;
}

.twisty[aria-expanded="false"] svg {
  transform: rotate(-90deg);
}

.leaf {
  width: 16px;
}

.row-main {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 12px;
  min-width: 0;
  text-align: left;
}

.row-name {
  min-width: 0;
}

.row-value {
  color: var(--muted);
}

.flags {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  color: var(--muted);
}

.flag-invalid,
.error {
  color: var(--error);
}

.flag-validating {
  color: var(--fg);
}

.row-error {
  grid-column: 1 / -1;
  font-family: var(--sans);
}

.detail {
  flex: 0 0 auto;
  max-height: 50%;
  border-top: 1px solid var(--border);
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 4px;
}

.facts {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  padding: 4px 12px 12px;
}

.facts dt {
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
  color: var(--muted);
}

.log,
.plugins {
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

.log-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  padding: 6px 12px;
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
  padding: 8px 12px 0;
}

.outline {
  position: fixed;
  z-index: 2147482999;
  pointer-events: none;
  border-radius: 4px;
}

.outline.form {
  pointer-events: auto;
  border: 1px dashed var(--muted);
  cursor: pointer;
}

.outline.form:hover,
.outline.form.on {
  border-color: var(--brand);
}

.outline.form.on {
  border-style: solid;
}

.tag {
  position: absolute;
  top: -1px;
  left: -1px;
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 4px 0 4px 0;
  background: var(--bg);
  color: var(--fg);
}

.outline.form:hover .tag,
.outline.form.on .tag {
  background: var(--brand);
  color: #fff;
}

.outline.field {
  border: 2px solid var(--brand);
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

.card .detail-head {
  justify-content: flex-start;
}

.card .detail-head .icon {
  margin-left: auto;
}

.fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  border-radius: 12px 12px 0 0;
  border-width: 1px 0 0;
}

.grip {
  width: 36px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 2px;
  background: var(--border);
}

.sheet-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
}

.sheet-head .end {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.sheet .panel {
  width: 100%;
  max-height: none;
  min-height: 128px;
  border: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`;
