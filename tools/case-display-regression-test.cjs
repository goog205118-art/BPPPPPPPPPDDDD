const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "..", "app", "styles.css"), "utf8");

function functionBlock(name, nextName) {
  const start = appSource.indexOf(name);
  assert.notEqual(start, -1, `${name} 应存在`);
  const end = nextName ? appSource.indexOf(nextName, start) : appSource.length;
  assert.notEqual(end, -1, `${nextName || "文件结尾"} 应存在`);
  return appSource.slice(start, end);
}

function testCaseAggregationContract() {
  const display = functionBlock("function followUpDisplayModel", "function syncFollowUpContactTracksForStage");
  assert.match(display, /followUpCase\(row\)/);
  assert.match(display, /followUpEventsFor\(row\)/);
  assert.match(display, /followUpCooperationsFor\(row\)/);
  assert.match(display, /followUpProductsFor\(row\)/);
  assert.match(display, /caseRow\?\.\[caseKey\]\)\s*\|\|/);

  const events = functionBlock("function followUpEventsFor", "function followUpCooperationsFor");
  assert.match(events, /text\(event\.case_id\)\s*===\s*caseId/);
  assert.match(events, /text\(event\.follow_up_id\)\s*===\s*followUpId/);
  assert.match(events, /seen\.has\(key\)/);

  const cooperations = functionBlock("function followUpCooperationsFor", "function followUpProductsFor");
  assert.match(cooperations, /text\(record\.case_id\)\s*===\s*caseId/);
  assert.match(cooperations, /text\(record\.follow_up_id\)\s*===\s*followUpId/);
  assert.match(cooperations, /text\(record\.id\)\s*===\s*explicitCooperationId/);
}

function testCaseWriteContract() {
  const archive = functionBlock("function archiveMailIntoFollowUp", "async function archivePendingMail");
  assert.match(archive, /follow_up_id:\s*followUp\.id/);
  assert.match(archive, /case_id:\s*followUp\.case_id/);

  const parse = functionBlock("async function parseEmlFile", "function openFollowUpMailImport");
  assert.match(parse, /follow_up_id:\s*followUp\.id/);
  assert.match(parse, /case_id:\s*followUp\.case_id/);

  const confirm = functionBlock("async function confirmMailImport", "function followUpCardMarkup");
  assert.match(confirm, /follow_up_id:\s*followUp\.id/);
  assert.match(confirm, /case_id:\s*followUp\.case_id/);

  const completion = functionBlock("function syncCompletedCooperation", "function syncCooperationName");
  assert.match(completion, /const byCase\s*=\s*allRows\("cooperations"\)/);
  assert.match(completion, /const existing = byCase\[0\]/);
  assert.match(completion, /case_id:\s*caseId/);
  assert.match(completion, /product_ids:\s*products\.map/);

  const stageActions = [
    functionBlock("async function applyFollowUpAnalysisSuggestion", "function openFollowUpEditor"),
    functionBlock("async function manuallyUpdateFollowUpStage", "function openFollowUpEditor"),
  ];
  assert.match(stageActions[0], /follow_up_id:/);
  assert.match(stageActions[0], /case_id:\s*followUp\.case_id/);
  assert.match(stageActions[1], /follow_up_id:/);
  assert.match(stageActions[1], /case_id:\s*followUp\.case_id/);
  assert.match(appSource, /follow_up_id:\s*record\.id,\s*case_id:\s*record\.case_id/);
}

function testDisplayStyles() {
  for (const selector of [
    ".followup-case-badge",
    ".followup-detail-products",
    ".followup-detail-history",
    ".followup-detail-action-history",
  ]) {
    assert.match(stylesSource, new RegExp(selector.replace(".", "\\.")));
  }
}

testCaseAggregationContract();
testCaseWriteContract();
testDisplayStyles();
console.log("PASS Case display regression: Case-first aggregation, legacy fallback, write paths, and compact detail styles.");
