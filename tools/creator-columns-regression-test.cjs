const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(rootDir, "app", "styles.css"), "utf8");

function expectMarker(source, marker, label) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), label || marker);
}

for (const key of [
  "name",
  "platform",
  "brand",
  "email",
  "status",
  "priority",
  "last_contacted_summary",
  "next_action_summary",
]) {
  expectMarker(appSource, `"${key}"`, `达人库列定义缺少 ${key}`);
}

for (const marker of [
  "const defaultCreatorColumnKeys",
  "const requiredCreatorColumnKeys",
  "function normalizeColumnPreferences",
  "function getCreatorColumnPreferences",
  "function getVisibleTableColumns",
  "columnPreferences: normalizeColumnPreferences",
  "state.columnMenuOpen",
  "function renderColumnSettings",
  "data-column-key",
  "data-column-reset",
  "renderTable(filterRows(rows(\"creators\")))",
  "openCreatorDrawer",
]) {
  expectMarker(appSource, marker);
}

for (const selector of ['id="columnUi"', 'id="columnSetupBtn"', 'id="columnPopover"']) {
  expectMarker(htmlSource, selector);
}

for (const selector of [
  ".column-ui",
  ".column-popover",
  ".column-popover-sheet",
  ".column-option",
  ".creator-name-cell",
  ".table-summary-cell",
]) {
  expectMarker(stylesSource, selector);
}

console.log("PASS Creator columns regression: defaults, persistence, chooser UI, and creator interaction contracts.");
