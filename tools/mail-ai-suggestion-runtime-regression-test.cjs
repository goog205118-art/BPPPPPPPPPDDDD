"use strict";

const assert = require("node:assert/strict");
const { executeMailScheduler } = require("./mail-scheduler-executor.cjs");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stateFixture() {
  return {
    meta: { version: 4 },
    brands: [{ id: "brand-a", name: "Brand A" }],
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
    actionTasks: [{
      id: "TASK-REPLY",
      brand_id: "brand-a",
      case_id: "CASE-1",
      type: "new_reply",
      dedupe_key: "CASE-1:new_reply:EVT-INBOUND",
      source: "mail_sync",
      source_id: "EVT-INBOUND",
      title: "达人新回信待处理",
      status: "待处理",
    }],
    actionTaskEvents: [],
    resources: [],
    mailInbox: [],
  };
}

function settingsFixture(overrides = {}) {
  return {
    accounts: [{
      id: "mail-main",
      enabled: true,
      brand_ids: ["brand-a"],
      imap: {
        host: "imap.example.test",
        user: "team@example.test",
        passwordEncrypted: "encrypted",
      },
    }],
    automation: {
      enabled: true,
      accountIds: ["mail-main"],
      intervalMinutes: 15,
      maxPerFolder: 20,
      retryLimit: 1,
      retryBackoffMinutes: 15,
      aiSuggestionsEnabled: true,
      aiSuggestionAccountIds: ["mail-main"],
      aiSuggestionMinIntervalMinutes: 60,
      aiSuggestionMaxPerRun: 5,
      ...overrides,
    },
  };
}

function versionConflict() {
  const error = new Error("数据版本冲突");
  error.code = "version_conflict";
  return error;
}

function createDependencies(options = {}) {
  let savedSettings = clone(options.settings || settingsFixture());
  let savedState = clone(options.state || stateFixture());
  let syncCalls = 0;
  let aiCalls = 0;
  let aiSaveAttempts = 0;
  const sequence = [];

  return {
    async loadSettings() {
      return clone(savedSettings);
    },
    async saveSettings(next) {
      savedSettings = clone(next);
      return clone(savedSettings);
    },
    async loadState() {
      return clone(savedState);
    },
    async saveState(next, expectedVersion) {
      const actor = String(next?._saveAudit?.actorId || "");
      sequence.push(`save:${actor || "unknown"}`);
      assert.equal(expectedVersion, savedState.meta.version, "每一次保存必须使用当前版本。");
      if (actor === "mail_scheduler_ai") {
        aiSaveAttempts += 1;
        if (options.aiSaveConflictOnce && aiSaveAttempts === 1) {
          // Simulate a user edit committed after the IMAP state save. The retry
          // must merge only the generated suggestion/task and retain this edit.
          savedState = {
            ...savedState,
            resources: [{ id: "RES-CONCURRENT", brand_id: "brand-a", name: "并发编辑资源" }],
            meta: { ...savedState.meta, version: savedState.meta.version + 1 },
          };
          throw versionConflict();
        }
      }
      savedState = {
        ...clone(next),
        meta: { ...(next.meta || {}), version: savedState.meta.version + 1 },
      };
      return clone(savedState);
    },
    async syncMailAccount(_settings, state, _key, syncOptions) {
      syncCalls += 1;
      sequence.push("sync");
      assert.equal(syncOptions.accountId, "mail-main");
      state.mailInbox.push({ id: `MAIL-${syncCalls}`, direction: "inbound" });
      return {
        scanned: 2,
        added: 1,
        matched: 1,
        pending: 0,
        skipped: 0,
        warnings: [],
      };
    },
    async generateFollowUpAiSuggestion() {
      aiCalls += 1;
      sequence.push("ai");
      if (options.aiFailure) throw new Error("api_key=secret 邮件正文不应进入错误日志");
      return {
        model_profile: "followup",
        model_name: "fast-model",
        analysis: {
          summary_cn: "达人已回复，建议人工确认寄样地址。",
          suggested_next_steps: ["确认地址", "准备寄样"],
        },
        context_scope: {
          email_count: 2,
          body_authorized: true,
        },
      };
    },
    async acquireAccountLock({ run }) {
      return { acquired: true, runId: run.id };
    },
    async releaseAccountLock() {},
    async acquireSchedulerLock({ runId }) {
      return { acquired: true, runId };
    },
    async releaseSchedulerLock() {},
    get syncCalls() {
      return syncCalls;
    },
    get aiCalls() {
      return aiCalls;
    },
    get aiSaveAttempts() {
      return aiSaveAttempts;
    },
    get savedState() {
      return clone(savedState);
    },
    get savedSettings() {
      return clone(savedSettings);
    },
    get sequence() {
      return [...sequence];
    },
  };
}

function assertHumanControlPreserved(state) {
  assert.equal(state.cases[0].stage, "初步沟通", "AI 建议不得推进 Case 阶段。");
  assert.equal(state.followUps[0].has_unread_reply, true, "AI 建议不得清除未读回信。");
  assert.equal(state.actionTasks.filter((task) => task.type === "new_reply").length, 1, "现有新回信待办必须保留。");
  assert.equal(state.actionTasks.filter((task) => task.type === "ai_suggestion_review").length, 1, "AI 建议必须单独进入审核待办。");
}

async function testLocalTimerGeneratesOnlyAfterImapSave() {
  const dependencies = createDependencies();
  const result = await executeMailScheduler(dependencies, {
    source: "local_timer",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0].ai.status, "succeeded");
  assert.equal(result.results[0].ai.generated, 1);
  assert.equal(result.results[0].ai.persisted, true);
  assert.equal(dependencies.syncCalls, 1);
  assert.equal(dependencies.aiCalls, 1);
  assert.deepEqual(dependencies.sequence.slice(0, 4), [
    "sync",
    "save:mail_scheduler",
    "ai",
    "save:mail_scheduler_ai",
  ]);
  assert.equal(dependencies.savedState.followUpAiSuggestions.length, 1);
  assert.equal(dependencies.savedState.followUpAiSuggestions[0].status, "pending_review");
  assertHumanControlPreserved(dependencies.savedState);
}

async function testManualForceNeverCallsScheduledAi() {
  const dependencies = createDependencies({
    settings: settingsFixture({ enabled: false }),
  });
  const result = await executeMailScheduler(dependencies, {
    source: "manual",
    force: true,
    accountId: "mail-main",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });

  assert.equal(result.status, "succeeded");
  assert.equal(dependencies.syncCalls, 1);
  assert.equal(dependencies.aiCalls, 0);
  assert.equal(result.results[0].ai.status, "skipped");
  assert.equal(result.results[0].ai.persisted, false);
  assert.equal(dependencies.savedState.followUpAiSuggestions.length, 0);
}

async function testVercelCronHonorsDisabledAndAccountScope() {
  const disabled = createDependencies({
    settings: settingsFixture({ aiSuggestionsEnabled: false }),
  });
  await executeMailScheduler(disabled, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.equal(disabled.syncCalls, 1);
  assert.equal(disabled.aiCalls, 0);
  assert.equal(disabled.savedState.followUpAiSuggestions.length, 0);

  const outOfScope = createDependencies({
    settings: settingsFixture({ aiSuggestionAccountIds: [] }),
  });
  await executeMailScheduler(outOfScope, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.equal(outOfScope.syncCalls, 1);
  assert.equal(outOfScope.aiCalls, 0);
  assert.equal(outOfScope.savedState.followUpAiSuggestions.length, 0);
}

async function testAiFailureDoesNotFailImapSchedulerRun() {
  const dependencies = createDependencies({ aiFailure: true });
  const result = await executeMailScheduler(dependencies, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0].status, "succeeded");
  assert.equal(result.results[0].ai.status, "failed");
  assert.equal(result.results[0].ai.failed, 1);
  assert.equal(result.results[0].ai.persisted, true);
  assert.equal(dependencies.savedState.followUpAiSuggestions[0].status, "failed");
  assert.equal(dependencies.savedState.followUpAiSuggestions[0].error.includes("secret"), false);
  assertHumanControlPreserved(dependencies.savedState);
}

async function testAiSaveConflictMergesWithoutReplayingModel() {
  const dependencies = createDependencies({ aiSaveConflictOnce: true });
  const result = await executeMailScheduler(dependencies, {
    source: "local_timer",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0].ai.persisted, true);
  assert.equal(dependencies.aiCalls, 1, "版本冲突重试不得重新调用模型。");
  assert.equal(dependencies.aiSaveAttempts, 2);
  assert.equal(dependencies.savedState.resources[0].id, "RES-CONCURRENT", "并发人工编辑不得被 AI 建议覆盖。");
  assert.equal(dependencies.savedState.followUpAiSuggestions.length, 1);
  assertHumanControlPreserved(dependencies.savedState);
}

Promise.resolve()
  .then(testLocalTimerGeneratesOnlyAfterImapSave)
  .then(testManualForceNeverCallsScheduledAi)
  .then(testVercelCronHonorsDisabledAndAccountScope)
  .then(testAiFailureDoesNotFailImapSchedulerRun)
  .then(testAiSaveConflictMergesWithoutReplayingModel)
  .then(() => console.log("mail AI suggestion runtime regression tests passed"));
