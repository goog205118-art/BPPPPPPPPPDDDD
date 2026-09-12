"use strict";

const assert = require("assert");
const {
  DEFAULT_MAIL_AUTOMATION,
  normalizeMailAutomation,
  publicMailAutomation,
  dueDecision,
  selectDueAccounts,
  reserveRun,
  finalizeRun,
} = require("./mail-scheduler-domain.cjs");

const now = new Date("2026-09-12T20:00:00.000Z");
const accounts = [
  {
    id: "mail-hsu",
    enabled: true,
    brand_ids: ["brand-hsu", "brand-hsu-india"],
    imap: { host: "imap.example.test", user: "team@example.test", passwordEncrypted: "encrypted" },
  },
  {
    id: "mail-disabled",
    enabled: false,
    brand_ids: ["brand-other"],
    imap: { host: "imap.example.test", user: "other@example.test", passwordEncrypted: "encrypted" },
  },
];

function testDefaultsStayDisabled() {
  const automation = normalizeMailAutomation({}, accounts, {});
  assert.strictEqual(automation.enabled, DEFAULT_MAIL_AUTOMATION.enabled);
  const result = dueDecision(automation, accounts[0], now);
  assert.deepStrictEqual(result, { eligible: false, reason: "automation_disabled" });
}

function testScopeAndReadiness() {
  const automation = normalizeMailAutomation({
    enabled: true,
    accountIds: ["mail-hsu", "unknown"],
    intervalMinutes: 1,
    maxPerFolder: 999,
  }, accounts, {});
  assert.deepStrictEqual(automation.accountIds, ["mail-hsu"]);
  assert.strictEqual(automation.intervalMinutes, 15);
  assert.strictEqual(automation.maxPerFolder, 250);
  assert.strictEqual(dueDecision(automation, accounts[0], now).reason, "due");
  assert.strictEqual(dueDecision(automation, accounts[1], now).reason, "account_not_ready");
  assert.strictEqual(selectDueAccounts({ accounts, automation }, now).filter((item) => item.decision.eligible).length, 1);
}

function testLeaseAndRetry() {
  const base = normalizeMailAutomation({
    enabled: true,
    accountIds: ["mail-hsu"],
    retryLimit: 2,
    retryBackoffMinutes: 15,
  }, accounts, {});
  const reservation = reserveRun(base, accounts[0], {
    accounts,
    now,
    runId: "run-one",
    source: "local_timer",
    requestId: "request-one",
  });
  assert.strictEqual(reservation.run.id, "run-one");
  assert.strictEqual(dueDecision(reservation.automation, accounts[0], now).reason, "run_in_progress");
  const failed = finalizeRun(reservation.automation, reservation.run, {
    accounts,
    status: "failed",
    error: "server timeout",
  }, new Date("2026-09-12T20:01:00.000Z"));
  assert.strictEqual(failed.automation.accountState["mail-hsu"].consecutiveFailures, 1);
  assert.strictEqual(failed.automation.accountState["mail-hsu"].nextDueAt, "2026-09-12T20:16:00.000Z");
  const retryReservation = reserveRun(failed.automation, accounts[0], {
    accounts,
    now: new Date("2026-09-12T20:16:01.000Z"),
    runId: "run-two",
    source: "vercel_cron",
  });
  const succeeded = finalizeRun(retryReservation.automation, retryReservation.run, {
    accounts,
    status: "succeeded",
    summary: { scanned: 6, added: 2, matched: 1, pending: 1, skipped: 4, warnings: [] },
  }, new Date("2026-09-12T20:17:00.000Z"));
  assert.strictEqual(succeeded.automation.accountState["mail-hsu"].consecutiveFailures, 0);
  assert.strictEqual(succeeded.automation.runHistory[0].summary.scanned, 6);
  assert.strictEqual(succeeded.automation.runHistory[0].summary.warnings, 0);
}

function testLogsStaySanitized() {
  const automation = normalizeMailAutomation({
    enabled: true,
    runHistory: [{
      id: "unsafe",
      accountId: "mail-hsu",
      status: "failed",
      error: "password=super-secret body=full mail content",
      summary: { scanned: 1, warnings: ["contains details"] },
    }],
  }, accounts, {});
  const publicValue = publicMailAutomation(automation, accounts);
  assert.strictEqual(publicValue.runHistory[0].error.includes("super-secret"), false);
  assert.strictEqual(publicValue.runHistory[0].error.includes("[已隐藏]"), true);
  assert.strictEqual(publicValue.runHistory[0].summary.warnings, 1);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicValue, "passwordEncrypted"), false);
}

testDefaultsStayDisabled();
testScopeAndReadiness();
testLeaseAndRetry();
testLogsStaySanitized();

console.log("mail scheduler regression tests passed");
