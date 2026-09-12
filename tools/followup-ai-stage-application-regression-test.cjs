const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  AI_HIGH_RISK_CASE_STAGES,
  applyAiSuggestedCaseStage,
  createCase,
} = require("./crm-domain.cjs");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");

const now = "2026-09-12T12:00:00.000Z";

function fixture() {
  const caseRow = createCase({
    id: "CASE-A",
    brand_id: "BR-A",
    creator_id: "CR-A",
    stage: "初步沟通",
    version: 3,
  }, now);
  return {
    cases: [caseRow],
    followUps: [{
      id: "FU-A",
      case_id: "CASE-A",
      brand_id: "BR-A",
      creator_id: "CR-A",
      stage: "初步沟通",
      has_unread_reply: true,
      updatedAt: now,
    }],
    followUpEvents: [],
  };
}

function recommendation(overrides = {}) {
  return {
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    next_stage: "谈合作方式 / 报价",
    previous_stage: "初步沟通",
    change_reason: "达人明确询问报价，并表示愿意继续确认合作条件。",
    confirmed: true,
    high_risk_confirmed: true,
    excerpt: "对方已询问报价。",
    evidence: "入站邮件：对方询问报价与合作方式。",
    ...overrides,
  };
}

function snapshot(state) {
  return JSON.stringify(state);
}

function assertRejectedWithoutMutation(input, expectedMessage) {
  const state = fixture();
  const before = snapshot(state);
  assert.throws(
    () => applyAiSuggestedCaseStage(state, input, now),
    new RegExp(expectedMessage),
  );
  assert.equal(snapshot(state), before, `拒绝 ${expectedMessage} 时不能写入任何阶段或事件。`);
}

function testGuardrails() {
  assert.equal(AI_HIGH_RISK_CASE_STAGES.has("谈合作方式 / 报价"), true);

  assertRejectedWithoutMutation(
    recommendation({ change_reason: "" }),
    "必须填写理由",
  );
  assertRejectedWithoutMutation(
    recommendation({ confirmed: false }),
    "必须完成确认",
  );
  assertRejectedWithoutMutation(
    recommendation({ high_risk_confirmed: false }),
    "额外事实确认",
  );
  assertRejectedWithoutMutation(
    recommendation({ next_stage: "初步沟通", previous_stage: "初步沟通" }),
    "相同",
  );
}

function testConfirmedApplication() {
  const state = fixture();
  const result = applyAiSuggestedCaseStage(state, recommendation(), now);

  assert.equal(result.case.stage, "谈合作方式 / 报价");
  assert.equal(result.followUp.stage, "谈合作方式 / 报价");
  assert.equal(result.followUp.has_unread_reply, false);
  assert.equal(result.case.version, 4);
  assert.equal(result.case.last_stage_changed_by, "人工确认");
  assert.equal(result.case.last_stage_change_source, "ai_suggestion_confirmed");
  assert.equal(result.case.last_stage_change_reason, "达人明确询问报价，并表示愿意继续确认合作条件。");
  assert.equal(result.event.previous_stage, "初步沟通");
  assert.equal(result.event.next_stage, "谈合作方式 / 报价");
  assert.equal(result.event.actor, "人工确认");
  assert.equal(result.event.source, "ai_suggestion_confirmed");
  assert.equal(result.event.change_reason, "达人明确询问报价，并表示愿意继续确认合作条件。");
  assert.equal(result.event.evidence, "入站邮件：对方询问报价与合作方式。");
  assert.equal(result.event.case_version, 4);
  assert.equal(state.followUpEvents.length, 1);
}

function testFrontendContract() {
  assert.match(appSource, /data-followup-stage-apply-reason/);
  assert.match(appSource, /data-followup-stage-apply-confirmed/);
  assert.match(appSource, /data-followup-stage-apply-high-risk-confirmed/);
  assert.match(appSource, /请填写人工应用理由；未填写时不会修改阶段/);
  assert.match(appSource, /请勾选人工核对确认；未确认时不会修改阶段/);
  assert.match(appSource, /属于高风险阶段，请完成第二次事实确认/);
  assert.match(appSource, /openFollowUpDetail\(item\.followUpId, \{ analysis: item\.analysis, userNote: batchNote \}\)/);
  assert.doesNotMatch(appSource, /人工确认 AI 阶段建议\$\{/);
}

testGuardrails();
testConfirmedApplication();
testFrontendContract();
console.log("PASS AI stage application guardrails");
