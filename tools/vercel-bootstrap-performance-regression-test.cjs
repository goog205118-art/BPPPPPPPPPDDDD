const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const apiSource = fs.readFileSync(path.join(rootDir, "api", "[...route].mjs"), "utf8");

function sectionAfter(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `未找到代码段：${marker}`);
  const end = source.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `未找到代码段结束标记：${endMarker}`);
  return source.slice(start, end);
}

function count(source, value) {
  return source.split(value).length - 1;
}

function run() {
  const gate = sectionAfter(appSource, 'elements.accessForm.addEventListener("submit"', "showAccessGate();");
  const start = sectionAfter(appSource, "async function start()", "start().catch");
  const init = sectionAfter(appSource, "async function init(", "function bindAccessGate()");
  const loadState = sectionAfter(appSource, "function applyLoadedState", "function hasBusinessData");
  const warmSettings = sectionAfter(appSource, "function warmRuntimeSettings()", "function normalizeAiSettingsPayload");
  const stateRoute = sectionAfter(
    apiSource,
    'if (req.method === "GET" && pathname === "/api/state")',
    'if (req.method === "POST" && pathname === "/api/state")',
  );
  const saveRoute = sectionAfter(
    apiSource,
    'if (req.method === "POST" && pathname === "/api/records/batch")',
    "const entityRoute = onlineEntityRoute(pathname);",
  );

  assert.equal(count(gate, "apiFetch(API_STATE)"), 1, "登录校验只能读取一次业务状态。");
  assert.match(gate, /await init\(\{\s*state: payload,/s);
  assert.equal(count(start, "apiFetch(API_STATE)"), 1, "会话恢复只能读取一次业务状态。");
  assert.match(start, /await withActivity\([^]*?init\(\{\s*state: payload,/);

  assert.match(loadState, /if \(initialState && typeof initialState === "object"\)/);
  assert.match(loadState, /applyLoadedState\(initialState\.state, initialState\.storageDriver\)/);
  assert.match(init, /await loadState\(initialState\)/);
  assert.match(init, /void warmRuntimeSettings\(\)/);
  assert.doesNotMatch(init, /await loadAiSettings\(\)/);
  assert.doesNotMatch(init, /await loadMailSettings\(\)/);
  assert.match(warmSettings, /Promise\.allSettled\(loaders\)/);

  assert.match(apiSource, /function setServerTiming\(res, entries = \[\]\)/);
  assert.match(stateRoute, /x-workbench-state-record-count/);
  assert.match(stateRoute, /workspace_read/);
  assert.match(saveRoute, /record_commit/);
  assert.match(saveRoute, /x-workbench-storage-driver/);

  console.log(
    "PASS Vercel bootstrap performance regression: login/session restore reuse one state response, settings warm in parallel, and state/record routes expose timing evidence.",
  );
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
