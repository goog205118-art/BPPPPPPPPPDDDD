"use strict";

const { randomUUID } = require("node:crypto");
const {
  createActionTask,
  taskKey,
  unreadReplyEventForCase,
} = require("./crm-domain.cjs");
const { accountBrandIds, redactLogText } = require("./mail-scheduler-domain.cjs");

const MAX_SUGGESTIONS_PER_RUN = 20;
const MAX_SUGGESTION_HISTORY = 60;
const MIN_SUGGESTION_INTERVAL_MINUTES = 15;
const MAX_SUGGESTION_INTERVAL_MINUTES = 1440;
const AUTOMATED_SOURCES = new Set(["local_timer", "vercel_cron"]);

const DEFAULT_AI_SUGGESTION_AUTOMATION = Object.freeze({
  aiSuggestionsEnabled: false,
  aiSuggestionMinIntervalMinutes: 60,
  aiSuggestionMaxPerRun: 5,
  aiSuggestionAccountIds: [],
  aiSuggestionState: { byCaseId: {} },
  aiSuggestionRunHistory: [],
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

function knownAccountIds(accounts = []) {
  return new Set((Array.isArray(accounts) ? accounts : []).map((account) => text(account?.id)).filter(Boolean));
}

function sanitizeCaseState(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const lastStatus = text(source.lastStatus);
  return {
    lastTriggerEventId: text(source.lastTriggerEventId).slice(0, 160),
    lastGeneratedAt: iso(source.lastGeneratedAt),
    lastStatus: ["pending_review", "failed", "dismissed", "superseded"].includes(lastStatus) ? lastStatus : "",
  };
}

function sanitizeRunRecord(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: text(source.id).slice(0, 160),
    source: AUTOMATED_SOURCES.has(text(source.source)) ? text(source.source) : "",
    accountId: text(source.accountId).slice(0, 160),
    startedAt: iso(source.startedAt),
    finishedAt: iso(source.finishedAt),
    generated: integer(source.generated, 0, 0, MAX_SUGGESTIONS_PER_RUN),
    failed: integer(source.failed, 0, 0, MAX_SUGGESTIONS_PER_RUN),
    skipped: integer(source.skipped, 0, 0, 1000000),
    error: redactLogText(source.error),
  };
}

function normalizeAiSuggestionAutomation(input = {}, accounts = [], previous = {}) {
  const source = input && typeof input === "object" ? input : {};
  const fallback = previous && typeof previous === "object" ? previous : {};
  const accountIds = knownAccountIds(accounts);
  const requestedAccountIds = Array.isArray(source.aiSuggestionAccountIds)
    ? source.aiSuggestionAccountIds
    : Array.isArray(fallback.aiSuggestionAccountIds)
      ? fallback.aiSuggestionAccountIds
      : [];
  const byCaseInput = source.aiSuggestionState?.byCaseId && typeof source.aiSuggestionState.byCaseId === "object"
    ? source.aiSuggestionState.byCaseId
    : fallback.aiSuggestionState?.byCaseId && typeof fallback.aiSuggestionState.byCaseId === "object"
      ? fallback.aiSuggestionState.byCaseId
      : {};
  const byCaseId = {};
  Object.entries(byCaseInput).forEach(([caseId, value]) => {
    if (text(caseId)) byCaseId[text(caseId)] = sanitizeCaseState(value);
  });
  const runHistoryInput = Array.isArray(source.aiSuggestionRunHistory)
    ? source.aiSuggestionRunHistory
    : Array.isArray(fallback.aiSuggestionRunHistory)
      ? fallback.aiSuggestionRunHistory
      : [];

  return {
    aiSuggestionsEnabled: source.aiSuggestionsEnabled === undefined
      ? flag(fallback.aiSuggestionsEnabled)
      : flag(source.aiSuggestionsEnabled),
    aiSuggestionMinIntervalMinutes: integer(
      source.aiSuggestionMinIntervalMinutes ?? fallback.aiSuggestionMinIntervalMinutes,
      DEFAULT_AI_SUGGESTION_AUTOMATION.aiSuggestionMinIntervalMinutes,
      MIN_SUGGESTION_INTERVAL_MINUTES,
      MAX_SUGGESTION_INTERVAL_MINUTES,
    ),
    aiSuggestionMaxPerRun: integer(
      source.aiSuggestionMaxPerRun ?? fallback.aiSuggestionMaxPerRun,
      DEFAULT_AI_SUGGESTION_AUTOMATION.aiSuggestionMaxPerRun,
      1,
      MAX_SUGGESTIONS_PER_RUN,
    ),
    aiSuggestionAccountIds: [...new Set(requestedAccountIds.map(text).filter((id) => accountIds.has(id)))],
    aiSuggestionState: { byCaseId },
    aiSuggestionRunHistory: runHistoryInput
      .map(sanitizeRunRecord)
      .filter((run) => run.id)
      .slice(0, MAX_SUGGESTION_HISTORY),
  };
}

function sourceMayGenerateSuggestions(source) {
  return AUTOMATED_SOURCES.has(text(source));
}

function caseById(state, caseId) {
  return (Array.isArray(state?.cases) ? state.cases : [])
    .find((row) => text(row.id) === text(caseId)) || null;
}

function followUpById(state, followUpId) {
  return (Array.isArray(state?.followUps) ? state.followUps : [])
    .find((row) => text(row.id) === text(followUpId)) || null;
}

function suggestionRows(state) {
  if (!Array.isArray(state.followUpAiSuggestions)) state.followUpAiSuggestions = [];
  return state.followUpAiSuggestions;
}

function actionTasks(state) {
  if (!Array.isArray(state.actionTasks)) state.actionTasks = [];
  return state.actionTasks;
}

function sameSuggestionEvent(suggestion, caseId, triggerEventId) {
  return text(suggestion.case_id) === text(caseId)
    && text(suggestion.trigger_event_id) === text(triggerEventId);
}

function candidateForCase(state, caseRow) {
  const events = (Array.isArray(state?.followUpEvents) ? state.followUpEvents : [])
    .filter((event) => text(event.case_id) === text(caseRow.id)
      && text(event.brand_id) === text(caseRow.brand_id));
  const triggerEvent = unreadReplyEventForCase(state, caseRow, events);
  if (!triggerEvent || !text(triggerEvent.id)) return { candidate: null, reason: "no_unread_reply" };
  const followUp = followUpById(state, triggerEvent.follow_up_id);
  if (!followUp
    || text(followUp.case_id) !== text(caseRow.id)
    || text(followUp.brand_id) !== text(caseRow.brand_id)
    || !flag(followUp.has_unread_reply)) {
    return { candidate: null, reason: "follow_up_not_eligible" };
  }
  return { candidate: { caseRow, followUp, triggerEvent }, reason: "" };
}

function candidateCases(state, account, automation, now) {
  const accountBrands = new Set(accountBrandIds(account));
  const suggestions = suggestionRows(state);
  const results = [];
  const skipped = [];
  const minIntervalMs = automation.aiSuggestionMinIntervalMinutes * 60 * 1000;
  for (const caseRow of Array.isArray(state?.cases) ? state.cases : []) {
    const caseId = text(caseRow.id);
    if (!caseId || !text(caseRow.brand_id) || !accountBrands.has(text(caseRow.brand_id))) {
      continue;
    }
    const found = candidateForCase(state, caseRow);
    if (!found.candidate) {
      skipped.push({ caseId, reason: found.reason });
      continue;
    }
    const { triggerEvent } = found.candidate;
    if (suggestions.some((suggestion) => sameSuggestionEvent(suggestion, caseId, triggerEvent.id))) {
      skipped.push({ caseId, triggerEventId: triggerEvent.id, reason: "already_suggested" });
      continue;
    }
    const recent = automation.aiSuggestionState.byCaseId[caseId];
    if (recent?.lastGeneratedAt && (now.getTime() - Date.parse(recent.lastGeneratedAt)) < minIntervalMs) {
      skipped.push({ caseId, triggerEventId: triggerEvent.id, reason: "minimum_interval" });
      continue;
    }
    results.push(found.candidate);
  }
  return { candidates: results, skipped };
}

function safeAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { summary_cn: "AI 未返回可审核分析。" };
  }
  return JSON.parse(JSON.stringify(value));
}

function createReviewTask(state, suggestion, now) {
  const dedupeKey = taskKey(suggestion.case_id, "ai_suggestion_review", suggestion.trigger_event_id);
  const existing = actionTasks(state).find((task) => text(task.dedupe_key) === dedupeKey
    && text(task.case_id) === text(suggestion.case_id)
    && text(task.brand_id) === text(suggestion.brand_id));
  if (existing) return existing;
  const task = createActionTask(state, {
    brand_id: suggestion.brand_id,
    case_id: suggestion.case_id,
    source: "scheduled_mail_sync",
    source_id: suggestion.id,
    type: "ai_suggestion_review",
    dedupe_key: dedupeKey,
    title: suggestion.status === "failed" ? "AI 建议生成失败，待人工处理" : "AI 跟进建议待审核",
    description: suggestion.status === "failed"
      ? "定时邮件同步后的 AI 建议未生成。请人工查看当前 Case 与新回信，或稍后重新触发受控定时建议。"
      : "已根据当前 Case 的新回信生成建议。必须由人工审核后，才可生成草稿或推进阶段。",
    priority: "高",
    due_at: suggestion.created_at,
    status: "待处理",
    generated: true,
  }, now);
  actionTasks(state).push(task);
  return task;
}

function recordRun(automation, run) {
  automation.aiSuggestionRunHistory = [
    sanitizeRunRecord(run),
    ...automation.aiSuggestionRunHistory.filter((item) => text(item.id) !== text(run.id)),
  ].slice(0, MAX_SUGGESTION_HISTORY);
}

async function generateScheduledAiSuggestions(state, input = {}) {
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const source = text(input.source);
  const account = input.account && typeof input.account === "object" ? input.account : {};
  const accountId = text(account.id);
  const automation = normalizeAiSuggestionAutomation(input.automation, input.accounts || [account], input.automation);
  const run = {
    id: text(input.runId) || `ai-suggestion-run-${randomUUID()}`,
    source,
    accountId,
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    generated: 0,
    failed: 0,
    skipped: 0,
    error: "",
  };

  if (!sourceMayGenerateSuggestions(source)) {
    return { automation, status: "skipped", reason: "source_not_automatic", suggestions: [], skipped: [] };
  }
  if (!automation.aiSuggestionsEnabled) {
    return { automation, status: "skipped", reason: "ai_suggestions_disabled", suggestions: [], skipped: [] };
  }
  if (!accountId || !automation.aiSuggestionAccountIds.includes(accountId)) {
    return { automation, status: "skipped", reason: "account_out_of_scope", suggestions: [], skipped: [] };
  }
  if (typeof input.generateFollowUpAiSuggestion !== "function") {
    return { automation, status: "skipped", reason: "ai_generator_unavailable", suggestions: [], skipped: [] };
  }

  const candidates = candidateCases(state, account, automation, now);
  const suggestions = [];
  for (const candidate of candidates.candidates.slice(0, automation.aiSuggestionMaxPerRun)) {
    const timestamp = new Date();
    const base = {
      id: `AISUG-${randomUUID()}`,
      brand_id: text(candidate.caseRow.brand_id),
      case_id: text(candidate.caseRow.id),
      follow_up_id: text(candidate.followUp.id),
      trigger_event_id: text(candidate.triggerEvent.id),
      status: "pending_review",
      created_at: timestamp.toISOString(),
      model_profile: "",
      model_name: "",
      source: "scheduled_mail_sync",
      analysis: {},
      context_scope: {},
      error: "",
      reviewed_at: "",
      reviewed_by: "",
    };
    try {
      const result = await input.generateFollowUpAiSuggestion({
        case_id: base.case_id,
        follow_up_id: base.follow_up_id,
        trigger_event_id: base.trigger_event_id,
        brand_id: base.brand_id,
        source,
      });
      const normalized = result && typeof result === "object" ? result : {};
      const suggestion = {
        ...base,
        model_profile: text(normalized.model_profile).slice(0, 120),
        model_name: text(normalized.model_name).slice(0, 180),
        analysis: safeAnalysis(normalized.analysis || normalized),
        context_scope: normalized.context_scope && typeof normalized.context_scope === "object"
          ? JSON.parse(JSON.stringify(normalized.context_scope))
          : {},
      };
      suggestionRows(state).push(suggestion);
      createReviewTask(state, suggestion, suggestion.created_at);
      automation.aiSuggestionState.byCaseId[suggestion.case_id] = {
        lastTriggerEventId: suggestion.trigger_event_id,
        lastGeneratedAt: suggestion.created_at,
        lastStatus: suggestion.status,
      };
      suggestions.push(suggestion);
      run.generated += 1;
    } catch (error) {
      const failed = {
        ...base,
        status: "failed",
        error: redactLogText(error?.message || "AI 建议生成失败"),
      };
      suggestionRows(state).push(failed);
      createReviewTask(state, failed, failed.created_at);
      automation.aiSuggestionState.byCaseId[failed.case_id] = {
        lastTriggerEventId: failed.trigger_event_id,
        lastGeneratedAt: failed.created_at,
        lastStatus: failed.status,
      };
      suggestions.push(failed);
      run.failed += 1;
    }
  }
  run.skipped = candidates.skipped.length + Math.max(0, candidates.candidates.length - automation.aiSuggestionMaxPerRun);
  run.finishedAt = new Date().toISOString();
  recordRun(automation, run);
  return {
    automation,
    status: run.failed ? (run.generated ? "partial" : "failed") : (suggestions.length ? "succeeded" : "skipped"),
    suggestions,
    skipped: candidates.skipped,
    run: sanitizeRunRecord(run),
  };
}

module.exports = {
  DEFAULT_AI_SUGGESTION_AUTOMATION,
  AUTOMATED_SOURCES,
  candidateCases,
  generateScheduledAiSuggestions,
  normalizeAiSuggestionAutomation,
  sourceMayGenerateSuggestions,
};
