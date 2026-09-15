const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(rootDir, "app", "styles.css"), "utf8");

function sectionAfter(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `未找到代码段：${marker}`);
  const afterStart = start + marker.length;
  const end = endMarker
    ? source.indexOf(endMarker, afterStart)
    : afterStart + source.slice(afterStart).search(/\n(?:async )?function [A-Za-z0-9_]+\(/);
  assert.notEqual(end, -1, `未找到代码段结束标记：${endMarker}`);
  return source.slice(start, end);
}

function run() {
  const persistSection = sectionAfter(appSource, "async function persist()", "function storageConflictEntity");
  const deleteSection = sectionAfter(appSource, "async function deleteFollowUpRecord");

  for (const marker of [
    "let persistQueue = Promise.resolve()",
    "let persistKnownServerVersion = 1",
    "let latestPersistRequestId = 0",
    "function renderSaveStatus",
    "function buildPersistPayload",
    "const stateSnapshot = clone(state.data)",
    "const queued = persistQueue.catch(() => undefined).then(run)",
    "persistQueue = queued.catch(() => undefined)",
    "if (requestId === latestPersistRequestId && savedState)",
    "version: savedVersion",
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `缺少保存队列保护：${marker}`);
  }

  assert.match(persistSection, /Math\.max\(\s*1,\s*Number\(persistKnownServerVersion\)/s);
  assert.match(persistSection, /setSaveState\(\{\s*status: "saving"/s);
  assert.match(persistSection, /status: pending \? "saving" : "saved"/);
  assert.match(persistSection, /status: "error"/);

  assert.match(htmlSource, /id="saveStatusBtn"/);
  assert.match(htmlSource, /id="saveStatusText"/);
  assert.match(appSource, /elements\.saveStatusBtn\.addEventListener\("click"/);
  assert.match(appSource, /window\.addEventListener\("beforeunload"/);
  assert.match(appSource, /if \(!state\.saveState\.pending\) return;/);
  assert.match(stylesSource, /\.save-status\s*\{/);
  assert.match(stylesSource, /\.save-status\[data-status="saving"\]/);
  assert.match(stylesSource, /\.save-status\[data-status="error"\]/);
  assert.match(stylesSource, /:root\[data-theme="light"\] \.save-status/);

  assert.doesNotMatch(deleteSection, /withActivity\("正在删除合作跟进"/);
  assert.match(deleteSection, /if \(state\.activeTab === "followups"\) render\(\);/);
  assert.match(deleteSection, /await persist\(\);/);

  console.log(
    "PASS save queue regression: writes are serialized, newer local edits survive older responses, save state is visible/retryable, and follow-up deletion saves without a blocking activity overlay.",
  );
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
