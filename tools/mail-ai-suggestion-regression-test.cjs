"use strict";

const assert = require("assert");
const {
  generateScheduledAiSuggestions,
  normalizeAiSuggestionAutomation,
} = require("./mail-ai-suggestion-domain.cjs");

const ACCOUNT = {
  id: "mail-main",
  brand_ids: ["brand-a"],
};

function stateFixture() {
  return {
    cases: [{
      id: "CASE-1",
      brand_id: "brand-a",
      brand: "Brand A",
      stage: "初步沟通",
    }],
    followUps: [{
      id: "FU-1",
      case_id: "CASE-1",
      brand_id: "brand-a",
      has_unread_reply: true,
    }],
    followUpEvents: [
      {
        id: "EVT-OUTBOUND",
        case_id: "CASE-1",
        brand_id: "brand-a",
        follow_up_id: "FU-1",
        direction: "outbound",
        occurred_at: "2026-09-12T18:00:00.000Z",
      },
      {
        id: "EVT-INBOUND",
        case_id: "CASE-1",
        brand_id: "brand-a",
        follow_up_id: "FU-1",
        direction: "inbound",
        occurred_at: "2026-09-12T19:00:00.000Z",
      },
    ],
    followUpAiSuggestions: [],
    actionTasks: [],
    actionTaskEvents: [],
  };
}

function automation(overrides = {}) {
  return {
    aiSuggestionsEnabled: true,
    aiSuggestionAccountIds: ["mail-main"],
    aiSuggestionMinIntervalMinutes: 60,
    aiSuggestionMaxPerRun: 5,
    ...overrides,
  };
}

async function testDefaultDisabledAndManualNeverCallsAi() {
  const state = stateFixture();
  let calls = 0;
  const result = await generateScheduledAiSuggestions(state, {
    accounts: [ACCOUNT],
    account: ACCOUNT,
    source: "manual",
    automation: automation(),
    generateFollowUpAiSuggestion: async () => {
      calls += 1;
      return { analysis: { summary_cn: "不应调用" } };
    },
  });
  assert.strictEqual(result.reason, "source_not_automatic");
  assert.strictEqual(calls, 0);

  const defaults = normalizeAiSuggestionAutomation({}, [ACCOUNT], {});
  assert.strictEqual(defaults.aiSuggestionsEnabled, false);
}

async function testUniqueReplyCreatesReviewOnly() {
  const state = stateFixture();
  let calls = 0;
  const beforeStage = state.cases[0].stage;
  const result = await generateScheduledAiSuggestions(state, {
    accounts: [ACCOUNT],
    account: ACCOUNT,
    source: "local_timer",
    now: "2026-09-12T20:00:00.000Z",
    automation: automation(),
    generateFollowUpAiSuggestion: async () => {
      calls += 1;
      return {
        model_profile: "followup",
        model_name: "fast-model",
        analysis: { summary_cn: "达人愿意继续沟通。" },
        context_scope: { email_count: 2, body_authorized: true },
      };
    },
  });
  assert.strictEqual(result.status, "succeeded");
  assert.strictEqual(calls, 1);
  assert.strictEqual(state.followUpAiSuggestions.length, 1);
  assert.strictEqual(state.followUpAiSuggestions[0].status, "pending_review");
  assert.strictEqual(state.followUpAiSuggestions[0].trigger_event_id, "EVT-INBOUND");
  assert.strictEqual(state.actionTasks.length, 1);
  assert.strictEqual(state.actionTasks[0].type, "ai_suggestion_review");
  assert.strictEqual(state.cases[0].stage, beforeStage);
  assert.strictEqual(state.followUps[0].has_unread_reply, true);
}

async function testSameCaseEventIsIdempotentAndMinimumIntervalApplies() {
  const state = stateFixture();
  let calls = 0;
  const input = {
    accounts: [ACCOUNT],
    account: ACCOUNT,
    source: "vercel_cron",
    now: "2026-09-12T20:00:00.000Z",
    automation: automation(),
    generateFollowUpAiSuggestion: async () => {
      calls += 1;
      return { analysis: { summary_cn: "建议审核。" } };
    },
  };
  await generateScheduledAiSuggestions(state, input);
  const again = await generateScheduledAiSuggestions(state, {
    ...input,
    now: "2026-09-12T20:10:00.000Z",
    automation: input.automation,
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(again.skipped[0].reason, "already_suggested");
  assert.strictEqual(state.followUpAiSuggestions.length, 1);
}

async function testScopeIsolationAndFailureDoNotBreakSyncState() {
  const state = stateFixture();
  const wrongAccount = { id: "mail-other", brand_ids: ["brand-other"] };
  let calls = 0;
  const scope = await generateScheduledAiSuggestions(state, {
    accounts: [ACCOUNT, wrongAccount],
    account: wrongAccount,
    source: "local_timer",
    automation: automation(),
    generateFollowUpAiSuggestion: async () => { calls += 1; return {}; },
  });
  assert.strictEqual(scope.reason, "account_out_of_scope");
  assert.strictEqual(calls, 0);

  const failed = await generateScheduledAiSuggestions(state, {
    accounts: [ACCOUNT],
    account: ACCOUNT,
    source: "local_timer",
    now: "2026-09-12T20:00:00.000Z",
    automation: automation(),
    generateFollowUpAiSuggestion: async () => {
      throw new Error("api_key=secret body=private message");
    },
  });
  assert.strictEqual(failed.status, "failed");
  assert.strictEqual(state.followUpAiSuggestions[0].status, "failed");
  assert.strictEqual(state.followUpAiSuggestions[0].error.includes("secret"), false);
  assert.strictEqual(state.followUps[0].has_unread_reply, true);
  assert.strictEqual(state.cases[0].stage, "初步沟通");
  assert.strictEqual(state.actionTasks[0].type, "ai_suggestion_review");
}

Promise.resolve()
  .then(testDefaultDisabledAndManualNeverCallsAi)
  .then(testUniqueReplyCreatesReviewOnly)
  .then(testSameCaseEventIsIdempotentAndMinimumIntervalApplies)
  .then(testScopeIsolationAndFailureDoNotBreakSyncState)
  .then(() => console.log("mail AI suggestion regression tests passed"));
