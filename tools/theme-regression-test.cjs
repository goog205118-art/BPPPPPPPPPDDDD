const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(rootDir, "app", "styles.css"), "utf8");

function expectMarker(source, marker, label) {
  assert.match(
    source,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    label || marker,
  );
}

expectMarker(htmlSource, 'localStorage.getItem("resource-workbench-theme")', "首屏主题读取缺失");
expectMarker(htmlSource, 'document.documentElement.dataset.theme = theme === "light" ? "light" : "dark"', "首屏主题回退缺失");
expectMarker(htmlSource, 'id="themeToggleBtn"', "顶部主题切换入口缺失");
expectMarker(htmlSource, 'id="themeSettingsOptions"', "设置页主题选择缺失");
expectMarker(htmlSource, 'value="dark"', "深色主题选项缺失");
expectMarker(htmlSource, 'value="light"', "浅色主题选项缺失");

for (const marker of [
  'const STORAGE_THEME = "resource-workbench-theme"',
  'const THEMES = new Set(["dark", "light"])',
  "function normalizeTheme",
  "function applyTheme",
  "function initializeTheme",
  "function renderThemeToggle",
  "function renderThemeSettings",
  "localStorage.setItem(STORAGE_THEME, theme)",
  "elements.themeToggleBtn.addEventListener",
  "elements.themeSettingsOptions.addEventListener",
]) {
  expectMarker(appSource, marker, `主题逻辑缺少 ${marker}`);
}

for (const selector of [
  ':root[data-theme="light"]',
  ':root[data-theme="light"] body',
  ':root[data-theme="light"] button.primary',
  ':root[data-theme="light"] button.ghost',
  ':root[data-theme="light"] .tab.active',
  ':root[data-theme="light"] .table-wrap',
  ':root[data-theme="light"] .filter-drawer-sheet',
  ':root[data-theme="light"] .editor-dialog',
  ':root[data-theme="light"] .creator-drawer-panel',
  ':root[data-theme="light"] .followup-ai-panel',
  ':root[data-theme="light"] .mail-signature-editor',
  ':root[data-theme="light"] .activity-card',
  ':root[data-theme="light"] .theme-choice:has(input:checked)',
]) {
  expectMarker(stylesSource, selector, `浅色主题缺少 ${selector}`);
}

assert.match(stylesSource, /color-scheme:\s*light;/, "浅色主题未声明 color-scheme");
assert.match(stylesSource, /background:\s*#ffffff;/, "浅色面板颜色缺失");
assert.match(stylesSource, /color:\s*#1b2a3b;/, "浅色输入文字颜色缺失");
assert.match(stylesSource, /background:\s*#1859c9;/, "浅色主按钮颜色缺失");
assert.match(stylesSource, /background:\s*#e1f5e9;/, "浅色成功状态颜色缺失");
assert.match(stylesSource, /background:\s*#fff3d8;/, "浅色警告状态颜色缺失");
assert.match(stylesSource, /background:\s*#ffeaed;/, "浅色风险状态颜色缺失");

console.log("PASS Theme regression: initialization, persistence, synchronized controls, and light-theme contrast contracts.");
