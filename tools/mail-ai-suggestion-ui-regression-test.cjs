"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "..", "app", "styles.css"), "utf8");

function functionBlock(name, nextName) {
  const start = appSource.indexOf(name);
  assert.notEqual(start, -1, `${name} 应存在`);
  const end = nextName ? appSource.indexOf(nextName, start) : appSource.length;
  assert.notEqual(end, -1, `${nextName || "文件结尾"} 应存在`);
  return appSource.slice(start, end);
}

function testSettingsExposeControlledSuggestionOptions() {
  assert.match(htmlSource, /id="mailAutomationAiSuggestions" type="checkbox"(?! disabled)/);
  for (const id of [
    "mailAutomationAiSuggestionAccountIds",
    "mailAutomationAiSuggestionMinInterval",
    "mailAutomationAiSuggestionMaxPerRun",
  ]) {
    assert.match(htmlSource, new RegExp(`id="${id}"`));
    assert.match(appSource, new RegExp(`document\\.getElementById\\("${id}"\\)`));
  }
  assert.match(htmlSource, /不会自动发送邮件、不会自动推进合作阶段，也不会清除达人新回信未读状态/);
  assert.doesNotMatch(htmlSource, /AI 建议（预留）|当前版本不执行 AI/);

  const normalized = functionBlock("function normalizedMailAutomation", "function mailAccountBrandIds");
  for (const field of [
    "aiSuggestionsEnabled",
    "aiSuggestionMinIntervalMinutes",
    "aiSuggestionMaxPerRun",
    "aiSuggestionAccountIds",
    "aiSuggestionState",
    "aiSuggestionRunHistory",
  ]) {
    assert.match(normalized, new RegExp(field));
  }

  const read = functionBlock("function readMailAutomation", "function renderMailAutomationSettings");
  assert.match(read, /aiSuggestionState:\s*state\.mailSettings\.automation\?\.aiSuggestionState/);
  assert.match(read, /aiSuggestionRunHistory:\s*state\.mailSettings\.automation\?\.aiSuggestionRunHistory/);
  assert.match(appSource, /ai_suggestion_review:\s*"AI 建议待审核"/);
}

function testDetailPanelIsReadOnlyAndRoutesToHumanReview() {
  const panel = functionBlock("function scheduledAiSuggestionMarkup", "function renderFollowUpDetail");
  assert.match(panel, /定时 AI 待审核建议/);
  assert.match(panel, /只读建议，不会自动应用、不自动发送邮件、不自动推进阶段，也不会清除新回信未读状态/);
  assert.match(panel, /data-followup-open-scheduled-ai-review/);
  assert.doesNotMatch(panel, /data-followup-send|data-followup-confirm-stage-apply|applyFollowUpAnalysisSuggestion\(/);

  const render = functionBlock("function renderFollowUpDetail", "async function requestFollowUpAnalysis");
  assert.match(render, /scheduledAiSuggestionMarkup\(followUp, model\)/);
  assert.match(render, /scrollIntoView/);
  assert.match(render, /analyzer\?\.focus\(\)/);
  assert.match(stylesSource, /\.followup-scheduled-ai-panel/);
  assert.match(stylesSource, /\.followup-scheduled-ai-notice/);
}

testSettingsExposeControlledSuggestionOptions();
testDetailPanelIsReadOnlyAndRoutesToHumanReview();
console.log("mail AI suggestion UI regression tests passed");
