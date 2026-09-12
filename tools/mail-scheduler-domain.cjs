"use strict";

const crypto = require("crypto");

const MAX_RUN_HISTORY = 60;
const MIN_INTERVAL_MINUTES = 15;
const MAX_INTERVAL_MINUTES = 1440;
const MAX_MESSAGES_PER_FOLDER = 250;
const MAX_RETRY_LIMIT = 3;
const MAX_BACKOFF_MINUTES = 1440;
const MAX_LEASE_MINUTES = 30;

const DEFAULT_MAIL_AUTOMATION = Object.freeze({
  enabled: false,
  intervalMinutes: 30,
  accountIds: [],
  maxPerFolder: 120,
  retryLimit: 2,
  retryBackoffMinutes: 15,
  aiSuggestionsEnabled: false,
  accountState: {},
  runHistory: [],
});

function text(value) {
  return String(value ?? "").trim();
}

function flag(value) {
  return value === true || value === 1 || value === "1" || text(value).toLowerCase() === "true";
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function iso(value) {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function redactLogText(value) {
  return text(value)
    .replace(/\b(?:password|passwd|authorization|token|api[_ -]?key)\s*[:=]\s*\S+/gi, "[已隐藏]")
    .replace(/\bdata:(?:text|message|application)\/[^,\s]+,[^\s]+/gi, "[已隐藏]")
    .slice(0, 600);
}

function validAccountIds(accounts = []) {
  return new Set((Array.isArray(accounts) ? accounts : []).map((account) => text(account?.id)).filter(Boolean));
}

function sanitizeAccountState(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const status = text(source.lastStatus);
  return {
    lastRunId: text(source.lastRunId).slice(0, 120),
    lastAttemptAt: iso(source.lastAttemptAt),
    lastSuccessAt: iso(source.lastSuccessAt),
    nextDueAt: iso(source.nextDueAt),
    leaseId: text(source.leaseId).slice(0, 120),
    leaseUntil: iso(source.leaseUntil),
    lastStatus: ["succeeded", "partial", "failed", "skipped"].includes(status) ? status : "",
    consecutiveFailures: integer(source.consecutiveFailures, 0, 0, MAX_RETRY_LIMIT),
  };
}

function sanitizeRunRecord(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const status = text(source.status);
  return {
    id: text(source.id).slice(0, 120),
    requestId: text(source.requestId).slice(0, 120),
    source: ["local_timer", "vercel_cron", "manual"].includes(text(source.source)) ? text(source.source) : "manual",
    accountId: text(source.accountId).slice(0, 120),
    brandIds: [...new Set((Array.isArray(source.brandIds) ? source.brandIds : []).map(text).filter(Boolean))].slice(0, 24),
    status: ["running", "succeeded", "partial", "failed", "skipped"].includes(status) ? status : "skipped",
    startedAt: iso(source.startedAt),
    finishedAt: iso(source.finishedAt),
    attempt: integer(source.attempt, 0, 0, MAX_RETRY_LIMIT + 1),
    summary: sanitizeSummary(source.summary),
    warning: redactLogText(source.warning),
    error: redactLogText(source.error),
  };
}

function sanitizeSummary(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    scanned: integer(source.scanned, 0, 0, 1000000),
    added: integer(source.added, 0, 0, 1000000),
    matched: integer(source.matched, 0, 0, 1000000),
    pending: integer(source.pending, 0, 0, 1000000),
    skipped: integer(source.skipped, 0, 0, 1000000),
    warnings: integer(Array.isArray(source.warnings) ? source.warnings.length : source.warnings, 0, 0, 1000000),
  };
}

function normalizeMailAutomation(input = {}, accounts = [], previous = {}) {
  const source = input && typeof input === "object" ? input : {};
  const fallback = previous && typeof previous === "object" ? previous : {};
  const knownIds = validAccountIds(accounts);
  const requestedIds = Array.isArray(source.accountIds) ? source.accountIds : Array.isArray(fallback.accountIds) ? fallback.accountIds : [];
  const accountIds = [...new Set(requestedIds.map(text).filter((id) => knownIds.has(id)))];
  const rawAccountState = source.accountState && typeof source.accountState === "object"
    ? source.accountState
    : fallback.accountState && typeof fallback.accountState === "object"
      ? fallback.accountState
      : {};
  const accountState = {};
  Object.entries(rawAccountState).forEach(([accountId, value]) => {
    if (knownIds.has(text(accountId))) accountState[text(accountId)] = sanitizeAccountState(value);
  });
  const rawHistory = Array.isArray(source.runHistory) ? source.runHistory : Array.isArray(fallback.runHistory) ? fallback.runHistory : [];

  return {
    enabled: source.enabled === undefined ? flag(fallback.enabled) : flag(source.enabled),
    intervalMinutes: integer(source.intervalMinutes ?? fallback.intervalMinutes, DEFAULT_MAIL_AUTOMATION.intervalMinutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES),
    accountIds,
    maxPerFolder: integer(source.maxPerFolder ?? fallback.maxPerFolder, DEFAULT_MAIL_AUTOMATION.maxPerFolder, 1, MAX_MESSAGES_PER_FOLDER),
    retryLimit: integer(source.retryLimit ?? fallback.retryLimit, DEFAULT_MAIL_AUTOMATION.retryLimit, 0, MAX_RETRY_LIMIT),
    retryBackoffMinutes: integer(source.retryBackoffMinutes ?? fallback.retryBackoffMinutes, DEFAULT_MAIL_AUTOMATION.retryBackoffMinutes, 1, MAX_BACKOFF_MINUTES),
    aiSuggestionsEnabled: source.aiSuggestionsEnabled === undefined ? flag(fallback.aiSuggestionsEnabled) : flag(source.aiSuggestionsEnabled),
    accountState,
    runHistory: rawHistory.map(sanitizeRunRecord).filter((run) => run.id).slice(0, MAX_RUN_HISTORY),
  };
}

function accountReady(account = {}) {
  const imap = account.imap && typeof account.imap === "object" ? account.imap : {};
  return flag(account.enabled) && Boolean(text(imap.host)) && Boolean(text(imap.user)) && Boolean(text(imap.passwordEncrypted));
}

function accountBrandIds(account = {}) {
  return [...new Set((Array.isArray(account.brand_ids) ? account.brand_ids : [account.brand_id]).map(text).filter(Boolean))];
}

function dueDecision(automation, account, now = new Date()) {
  const accountId = text(account?.id);
  const current = automation?.accountState?.[accountId] || {};
  const at = now instanceof Date ? now : new Date(now);
  const nowMs = at.getTime();
  if (!automation?.enabled) return { eligible: false, reason: "automation_disabled" };
  if (!accountId || !accountReady(account)) return { eligible: false, reason: "account_not_ready" };
  if (automation.accountIds.length && !automation.accountIds.includes(accountId)) return { eligible: false, reason: "account_out_of_scope" };
  if (Date.parse(current.leaseUntil) > nowMs) return { eligible: false, reason: "run_in_progress" };
  if (Date.parse(current.nextDueAt) > nowMs) return { eligible: false, reason: "not_due" };
  return { eligible: true, reason: "due" };
}

function selectDueAccounts(settings = {}, now = new Date()) {
  const automation = normalizeMailAutomation(settings.automation, settings.accounts, settings.automation);
  const accounts = Array.isArray(settings.accounts) ? settings.accounts : [];
  return accounts.map((account) => ({ account, decision: dueDecision(automation, account, now) }));
}

function createRunId() {
  return `mail-run-${crypto.randomUUID()}`;
}

function reserveRun(automationInput, account, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const automation = normalizeMailAutomation(automationInput, options.accounts || [account], automationInput);
  const decision = dueDecision(automation, account, now);
  if (!decision.eligible) return { automation, decision, run: null };

  const accountId = text(account.id);
  const previous = automation.accountState[accountId] || sanitizeAccountState();
  const runId = text(options.runId) || createRunId();
  const leaseMinutes = integer(options.leaseMinutes, 10, 1, MAX_LEASE_MINUTES);
  const attempt = Math.min(automation.retryLimit + 1, previous.consecutiveFailures + 1);
  const startedAt = now.toISOString();
  const run = sanitizeRunRecord({
    id: runId,
    requestId: text(options.requestId) || runId,
    source: options.source,
    accountId,
    brandIds: accountBrandIds(account),
    status: "running",
    startedAt,
    attempt,
  });
  automation.accountState[accountId] = {
    ...previous,
    lastRunId: run.id,
    lastAttemptAt: startedAt,
    leaseId: run.id,
    leaseUntil: new Date(now.getTime() + leaseMinutes * 60 * 1000).toISOString(),
  };
  return { automation, decision, run };
}

function finalizeRun(automationInput, runInput, outcome = {}, now = new Date()) {
  const run = sanitizeRunRecord({ ...runInput, ...outcome, finishedAt: now.toISOString() });
  const automation = normalizeMailAutomation(automationInput, outcome.accounts || [], automationInput);
  const accountId = run.accountId;
  const previous = automation.accountState[accountId] || sanitizeAccountState();
  const status = ["succeeded", "partial", "failed"].includes(run.status) ? run.status : "failed";
  const successful = status === "succeeded" || status === "partial";
  const consecutiveFailures = successful ? 0 : Math.min(automation.retryLimit, previous.consecutiveFailures + 1);
  const delayMinutes = successful
    ? automation.intervalMinutes
    : Math.min(MAX_BACKOFF_MINUTES, automation.retryBackoffMinutes * (2 ** Math.max(0, consecutiveFailures - 1)));
  automation.accountState[accountId] = {
    ...previous,
    lastRunId: run.id,
    lastStatus: status,
    lastSuccessAt: successful ? run.finishedAt : previous.lastSuccessAt,
    nextDueAt: new Date(Date.parse(run.finishedAt) + delayMinutes * 60 * 1000).toISOString(),
    leaseId: "",
    leaseUntil: "",
    consecutiveFailures,
  };
  const completed = { ...run, status };
  automation.runHistory = [completed, ...automation.runHistory.filter((item) => item.id !== completed.id)].slice(0, MAX_RUN_HISTORY);
  return { automation, run: completed };
}

function publicMailAutomation(automationInput = {}, accounts = []) {
  const automation = normalizeMailAutomation(automationInput, accounts, automationInput);
  return {
    enabled: automation.enabled,
    intervalMinutes: automation.intervalMinutes,
    accountIds: automation.accountIds,
    maxPerFolder: automation.maxPerFolder,
    retryLimit: automation.retryLimit,
    retryBackoffMinutes: automation.retryBackoffMinutes,
    aiSuggestionsEnabled: automation.aiSuggestionsEnabled,
    accountState: automation.accountState,
    runHistory: automation.runHistory,
  };
}

module.exports = {
  DEFAULT_MAIL_AUTOMATION,
  normalizeMailAutomation,
  publicMailAutomation,
  accountReady,
  dueDecision,
  selectDueAccounts,
  reserveRun,
  finalizeRun,
  sanitizeRunRecord,
  redactLogText,
};
