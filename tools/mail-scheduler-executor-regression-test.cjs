"use strict";

const assert = require("assert");
const { executeMailScheduler } = require("./mail-scheduler-executor.cjs");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseSettings(enabled = true) {
  return {
    accounts: [{
      id: "mail-main",
      enabled: true,
      brand_ids: ["brand-a", "brand-b"],
      imap: { host: "imap.example.test", user: "team@example.test", passwordEncrypted: "encrypted" },
    }],
    automation: {
      enabled,
      accountIds: ["mail-main"],
      intervalMinutes: 15,
      maxPerFolder: 20,
      retryLimit: 2,
      retryBackoffMinutes: 15,
    },
  };
}

function createDependencies({ settings = baseSettings(), conflictOnce = false, warnings = [], lockAllowed = true, schedulerLockAllowed = true } = {}) {
  let savedSettings = clone(settings);
  let savedState = { meta: { version: 4 }, followUpEvents: [], mailInbox: [] };
  let syncCalls = 0;
  let saveCalls = 0;
  return {
    async loadSettings() { return clone(savedSettings); },
    async saveSettings(next) { savedSettings = clone(next); return clone(savedSettings); },
    async loadState() { return clone(savedState); },
    async saveState(next, expectedVersion) {
      saveCalls += 1;
      if (conflictOnce && saveCalls === 1) {
        const error = new Error("数据版本冲突");
        error.code = "version_conflict";
        throw error;
      }
      assert.strictEqual(expectedVersion, 4);
      savedState = { ...clone(next), meta: { version: 5 } };
      return clone(savedState);
    },
    async syncMailAccount(_settings, state, _key, options) {
      syncCalls += 1;
      assert.strictEqual(options.accountId, "mail-main");
      assert.strictEqual(options.maxPerFolder, 20);
      state.mailInbox.push({ id: `mail-${syncCalls}` });
      return { scanned: 2, added: 1, matched: 1, pending: 0, skipped: 1, warnings };
    },
    async acquireAccountLock({ run }) {
      return lockAllowed ? { acquired: true, runId: run.id } : { acquired: false };
    },
    async releaseAccountLock() {},
    async acquireSchedulerLock() {
      return schedulerLockAllowed ? { acquired: true, runId: "scheduler-run" } : { acquired: false };
    },
    async releaseSchedulerLock() {},
    get syncCalls() { return syncCalls; },
    get savedSettings() { return clone(savedSettings); },
  };
}

async function testDisabledDoesNotCallImap() {
  const dependencies = createDependencies({ settings: baseSettings(false) });
  const result = await executeMailScheduler(dependencies, {
    source: "local_timer",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.strictEqual(result.status, "skipped");
  assert.strictEqual(dependencies.syncCalls, 0);
}

async function testManualBypassesOnlyThisRun() {
  const dependencies = createDependencies({ settings: baseSettings(false) });
  const result = await executeMailScheduler(dependencies, {
    source: "manual",
    force: true,
    accountId: "mail-main",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.strictEqual(result.status, "succeeded");
  assert.strictEqual(dependencies.syncCalls, 1);
  assert.strictEqual(dependencies.savedSettings.automation.enabled, false);
}

async function testConflictRetriesAndPartialLogs() {
  const dependencies = createDependencies({ conflictOnce: true, warnings: ["一个文件夹短暂不可用"] });
  const result = await executeMailScheduler(dependencies, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.strictEqual(result.status, "succeeded");
  assert.strictEqual(result.results[0].status, "partial");
  assert.strictEqual(result.results[0].retries, 1);
  assert.strictEqual(dependencies.syncCalls, 2);
  const history = dependencies.savedSettings.automation.runHistory;
  assert.strictEqual(history[0].status, "partial");
  assert.strictEqual(history[0].summary.warnings, 1);
  assert.strictEqual(history[0].warning.includes("重试 1 次"), true);
}

async function testLeasePreventsOverlap() {
  const dependencies = createDependencies();
  const settings = await dependencies.loadSettings();
  settings.automation.accountState = {
    "mail-main": {
      leaseId: "already-running",
      leaseUntil: "2026-09-12T20:10:00.000Z",
    },
  };
  await dependencies.saveSettings(settings);
  const result = await executeMailScheduler(dependencies, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.strictEqual(result.results[0].reason, "run_in_progress");
  assert.strictEqual(dependencies.syncCalls, 0);
}

async function testExternalLockPreventsOverlap() {
  const dependencies = createDependencies({ lockAllowed: false });
  const result = await executeMailScheduler(dependencies, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.strictEqual(result.results[0].reason, "run_in_progress");
  assert.strictEqual(dependencies.syncCalls, 0);
}

async function testSchedulerLockPreventsSettingsRace() {
  const dependencies = createDependencies({ schedulerLockAllowed: false });
  const result = await executeMailScheduler(dependencies, {
    source: "vercel_cron",
    now: new Date("2026-09-12T20:00:00.000Z"),
  });
  assert.strictEqual(result.status, "skipped");
  assert.strictEqual(result.results[0].reason, "scheduler_run_in_progress");
  assert.strictEqual(dependencies.syncCalls, 0);
}

Promise.resolve()
  .then(testDisabledDoesNotCallImap)
  .then(testManualBypassesOnlyThisRun)
  .then(testConflictRetriesAndPartialLogs)
  .then(testLeasePreventsOverlap)
  .then(testExternalLockPreventsOverlap)
  .then(testSchedulerLockPreventsSettingsRace)
  .then(() => console.log("mail scheduler executor regression tests passed"));
