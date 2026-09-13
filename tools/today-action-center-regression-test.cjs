const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const domain = require(path.join(rootDir, "tools", "crm-domain.cjs"));
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(rootDir, "app", "styles.css"), "utf8");
const emptyWorkspaceFixture = JSON.parse(fs.readFileSync(path.join(rootDir, "tools", "fixtures", "empty-workspace-state.json"), "utf8"));

function fixture() {
  return {
    brands: [{ id: "BR-A", name: "HSU" }],
    cases: [{ id: "CASE-A", brand_id: "BR-A", brand: "HSU", creator_id: "CR-A", stage: "初步沟通", version: 1 }],
    followUps: [{ id: "FU-A", brand_id: "BR-A", case_id: "CASE-A", stage: "初步沟通" }],
    followUpEvents: [],
    mailInbox: [],
    actionTasks: [
      domain.createActionTask({
        brands: [{ id: "BR-A", name: "HSU" }],
        cases: [{ id: "CASE-A", brand_id: "BR-A", brand: "HSU", creator_id: "CR-A", stage: "初步沟通", version: 1 }],
        actionTasks: [],
      }, {
        id: "TASK-A",
        brand_id: "BR-A",
        case_id: "CASE-A",
        type: "new_reply",
        title: "处理达人新回信",
        status: "待处理",
        due_at: "2026-09-12T09:00:00.000Z",
        generated: true,
        dedupe_key: "CASE-A:new_reply:MAIL-A",
      }, "2026-09-11T09:00:00.000Z"),
    ],
  };
}

function testSkipAndReconcile() {
  const state = fixture();
  assert.throws(() => domain.skipTask(state, "TASK-A", "", "2026-09-11T10:00:00.000Z"), /必须填写原因/);
  const skipped = domain.skipTask(state, "TASK-A", "达人已明确不再合作", "2026-09-11T10:00:00.000Z");
  assert.equal(skipped.status, "已跳过");
  assert.equal(skipped.completion_evidence, "达人已明确不再合作");
  state.followUps[0].has_unread_reply = true;
  state.followUpEvents.push({
    id: "MAIL-A",
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    brand_id: "BR-A",
    direction: "inbound",
    occurred_at: "2026-09-11T09:30:00.000Z",
  });
  domain.reconcileCaseTasks(state, "2026-09-11T11:00:00.000Z");
  assert.equal(state.actionTasks[0].status, "已跳过", "已跳过的规则任务不得因条件仍存在而重开。");
}

function testDeferValidation() {
  const state = fixture();
  assert.throws(() => domain.deferTask(state, "TASK-A", "not-a-date", "等待达人确认", "2026-09-11T10:00:00.000Z"), /必须晚于当前时间/);
  assert.throws(() => domain.deferTask(state, "TASK-A", "2026-09-11T09:59:00.000Z", "等待达人确认", "2026-09-11T10:00:00.000Z"), /必须晚于当前时间/);
  assert.throws(() => domain.deferTask(state, "TASK-A", "2026-09-12T12:30:00.000Z", "", "2026-09-11T10:00:00.000Z"), /必须填写原因/);
  const deferred = domain.deferTask(state, "TASK-A", "2026-09-12T12:30:00.000Z", "等待达人确认", "2026-09-11T10:00:00.000Z");
  assert.equal(deferred.status, "待处理");
  assert.equal(deferred.due_at, "2026-09-12T12:30:00.000Z");
  assert.equal(deferred.defer_reason, "等待达人确认");
  assert.equal(state.cases[0].stage, "初步沟通");
  assert.equal(state.followUps[0].stage, "初步沟通");
  assert.equal(state.followUpEvents.length, 0);
}

function testCompleteDoesNotAdvanceCase() {
  const state = fixture();
  domain.completeTask(state, "TASK-A", "已阅读并记录回复要点", "2026-09-11T10:00:00.000Z");
  assert.equal(state.actionTasks[0].status, "已完成");
  assert.equal(state.cases[0].stage, "初步沟通");
  assert.equal(state.followUps[0].stage, "初步沟通");
  assert.equal(state.followUpEvents.length, 0);
}

function testUiContracts() {
  for (const marker of [
    "TODAY_ACTION_TAB",
    "function renderTodayActionPage",
    "data-today-action-filter=\"brand\"",
    "data-today-action-filter=\"owner\"",
    "data-today-action-filter=\"priority\"",
    "data-today-action-filter=\"due\"",
    "data-today-action-filter=\"type\"",
    "data-today-action-complete",
    "data-today-action-skip",
    "data-today-action-defer",
    "data-today-action-assign",
    "data-today-action-note",
    "function appendTodayActionEvent",
    "function actionTaskHistoryMarkup",
    "data-today-action-open-case",
    "openFollowUpDetail(followUp.id)",
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(htmlSource, /id="todayActionPage"/);
  for (const selector of [".today-action-page", ".today-action-row", ".today-action-filters"]) {
    assert.match(stylesSource, new RegExp(selector.replace(".", "\\.")));
  }
}

function testWorkspaceEntryContracts() {
  for (const marker of [
    "activeTab: TODAY_ACTION_TAB.key",
    "function hasBusinessData",
    "function resolveInitialWorkspaceTab",
    "state.activeTab = resolveInitialWorkspaceTab();",
    "function openTodayOnboardingAction",
    "data-today-onboarding-action=\"import\"",
    "data-today-onboarding-action=\"creator\"",
    "data-today-onboarding-action=\"brand\"",
    "openBrandManager({ create: true })",
    "elements.importTableInput.click()",
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const selector of [".today-onboarding", ".today-onboarding-action", ".today-onboarding-icon"]) {
    assert.match(stylesSource, new RegExp(selector.replace(".", "\\.")));
  }
}

function testGroupedNavigationContracts() {
  for (const marker of [
    "const NAVIGATION_GROUPS",
    'key: "library"',
    'title: "资料"',
    'key: "collaboration"',
    'title: "协作"',
    'key: "analysis"',
    'title: "分析"',
    'key: "creators"',
    'key: "leads"',
    'key: "products"',
    'key: "resources"',
    'key: "today"',
    'key: "followups"',
    'key: "matches"',
    'key: "cooperations"',
    "function renderTabs",
    'class="tab-group',
    'data-tab="${escapeHtml(item.key)}"',
    "tab--priority",
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const selector of [".tab-group", ".tab-group-title", ".tab-group-items", ".tab--priority"]) {
    assert.match(stylesSource, new RegExp(selector.replace(".", "\\.")));
  }
}

function testCompactTopbarContracts() {
  for (const marker of [
    "function pendingActionTaskCount",
    "function renderTopbarQueue",
    "function renderTopbarMoreMenu",
    "function openSettingsSection",
    "function timeZoneClockMarkup",
    "data-timezone-popover-toggle",
    "data-topbar-settings-section",
    "data-topbar-export-state",
    "data-topbar-import-state",
    "elements.importStateInput.click()",
    "state.topbarMoreOpen",
    "state.timeZonePopoverOpen",
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const marker of [
    'id="todayQueueBtn"',
    'id="topbarMoreBtn"',
    'id="topbarMoreMenu"',
    'id="refreshBtn"',
    'id="brandManageBtn"',
    'id="settingsBtn"',
  ]) {
    assert.match(htmlSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const selector of [
    ".topbar-today-queue",
    ".topbar-more-wrap",
    ".topbar-menu",
    ".timezone-main",
    ".timezone-more-trigger",
    ".timezone-popover",
  ]) {
    assert.match(stylesSource, new RegExp(selector.replace(".", "\\.")));
  }
}

function testEmptyWorkspaceFixture() {
  for (const key of [
    "brands",
    "creators",
    "resources",
    "leads",
    "products",
    "cooperations",
    "matches",
    "followUps",
    "cases",
    "actionTasks",
    "mailInbox",
  ]) {
    assert.deepEqual(emptyWorkspaceFixture[key], [], `empty workspace fixture must not contain ${key}`);
  }
}

testSkipAndReconcile();
testDeferValidation();
testCompleteDoesNotAdvanceCase();
testUiContracts();
testWorkspaceEntryContracts();
testGroupedNavigationContracts();
testCompactTopbarContracts();
testEmptyWorkspaceFixture();
console.log("PASS today action center regression: task lifecycle, no stage automation, UI contracts, workspace entry, grouped navigation, and compact topbar.");
