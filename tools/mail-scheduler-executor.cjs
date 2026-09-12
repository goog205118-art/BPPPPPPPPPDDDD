"use strict";

const { randomUUID } = require("node:crypto");
const {
  normalizeMailAutomation,
  dueDecision,
  reserveRun,
  finalizeRun,
  redactLogText,
} = require("./mail-scheduler-domain.cjs");
const { generateScheduledAiSuggestions } = require("./mail-ai-suggestion-domain.cjs");

function text(value) {
  return String(value ?? "").trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function summaryForLog(summary = {}) {
  return {
    scanned: Number(summary.scanned || 0),
    added: Number(summary.added || 0),
    matched: Number(summary.matched || 0),
    pending: Number(summary.pending || 0),
    skipped: Number(summary.skipped || 0),
    warnings: Array.isArray(summary.warnings) ? summary.warnings : [],
  };
}

function updateAccountSyncMetadata(settings, accountId, summary, now = new Date()) {
  return {
    ...settings,
    accounts: (Array.isArray(settings.accounts) ? settings.accounts : []).map((account) => (
      text(account.id) === text(accountId)
        ? {
            ...account,
            lastSyncAt: now.toISOString(),
            lastSyncStatus: Array.isArray(summary.warnings) && summary.warnings.length ? "部分完成" : "完成",
            lastSyncSummary: {
              scanned: Number(summary.scanned || 0),
              added: Number(summary.added || 0),
              matched: Number(summary.matched || 0),
              pending: Number(summary.pending || 0),
              skipped: Number(summary.skipped || 0),
              repliesMarkedUnread: Number(summary.repliesMarkedUnread || 0),
              stagesAdvancedFromReplies: Number(summary.stagesAdvancedFromReplies || 0),
              warnings: Array.isArray(summary.warnings) ? summary.warnings.slice(0, 5) : [],
            },
            updatedAt: now.toISOString(),
          }
        : account
    )),
  };
}

function accountCandidates(settings, options) {
  const accounts = Array.isArray(settings.accounts) ? settings.accounts : [];
  const requested = text(options.accountId);
  return requested ? accounts.filter((account) => text(account.id) === requested) : accounts;
}

function schedulerAutomation(settings, accountId, force) {
  const automation = normalizeMailAutomation(settings.automation, settings.accounts, settings.automation);
  if (!force) return automation;
  return {
    ...automation,
    enabled: true,
    accountIds: accountId ? [accountId] : automation.accountIds,
  };
}

async function syncAndSaveWithRetry(dependencies, settings, account, options) {
  const maxStateSaveRetries = Math.min(2, Math.max(0, Number(options.maxStateSaveRetries ?? 1)));
  let retries = 0;
  let lastSummary = null;
  while (retries <= maxStateSaveRetries) {
    const state = await dependencies.loadState();
    const expectedVersion = state?.meta?.version;
    const summary = await dependencies.syncMailAccount(
      settings,
      state,
      dependencies.credentialKeyMaterial,
      { accountId: account.id, maxPerFolder: options.maxPerFolder },
    );
    lastSummary = summary;
    try {
      state._saveAudit = {
        actorId: "mail_scheduler",
        actorName: "邮箱定时同步",
        source: options.source,
        reason: `邮箱同步：${account.id}`,
      };
      const savedState = await dependencies.saveState(state, expectedVersion);
      return { summary, state: savedState, retries };
    } catch (error) {
      if (error?.code !== "version_conflict" || retries >= maxStateSaveRetries) throw error;
      retries += 1;
    }
  }
  return { summary: lastSummary, state: null, retries };
}

function suggestionKey(suggestion = {}) {
  return `${text(suggestion.case_id)}::${text(suggestion.trigger_event_id)}`;
}

function aiAutomationPatch(automation = {}) {
  return {
    aiSuggestionsEnabled: automation.aiSuggestionsEnabled,
    aiSuggestionMinIntervalMinutes: automation.aiSuggestionMinIntervalMinutes,
    aiSuggestionMaxPerRun: automation.aiSuggestionMaxPerRun,
    aiSuggestionAccountIds: automation.aiSuggestionAccountIds,
    aiSuggestionState: automation.aiSuggestionState,
    aiSuggestionRunHistory: automation.aiSuggestionRunHistory,
  };
}

function mergeScheduledAiSuggestionState(currentState, generatedState) {
  const current = currentState && typeof currentState === "object" ? currentState : {};
  const generated = generatedState && typeof generatedState === "object" ? generatedState : {};
  const currentSuggestions = Array.isArray(current.followUpAiSuggestions) ? current.followUpAiSuggestions : [];
  const generatedSuggestions = Array.isArray(generated.followUpAiSuggestions) ? generated.followUpAiSuggestions : [];
  const existingSuggestionKeys = new Set(currentSuggestions.map(suggestionKey));
  const additions = generatedSuggestions.filter((row) => {
    const key = suggestionKey(row);
    return key !== "::" && !existingSuggestionKeys.has(key);
  });
  const suggestionIds = new Set(additions.map((row) => text(row.id)).filter(Boolean));
  const currentTasks = Array.isArray(current.actionTasks) ? current.actionTasks : [];
  const generatedTasks = Array.isArray(generated.actionTasks) ? generated.actionTasks : [];
  const existingTaskKeys = new Set(currentTasks.map((row) => `${text(row.case_id)}::${text(row.dedupe_key)}`));
  const taskAdditions = generatedTasks.filter((row) => (
    text(row.type) === "ai_suggestion_review"
    && suggestionIds.has(text(row.source_id))
    && !existingTaskKeys.has(`${text(row.case_id)}::${text(row.dedupe_key)}`)
  ));
  return {
    ...current,
    followUpAiSuggestions: [...currentSuggestions, ...additions],
    actionTasks: [...currentTasks, ...taskAdditions],
  };
}

async function saveScheduledAiSuggestionsWithRetry(dependencies, state, expectedVersion, input = {}) {
  const generatedState = clone(state);
  const outcome = await generateScheduledAiSuggestions(generatedState, input);
  if (!outcome.suggestions?.length) return { ...outcome, state, retries: 0, persisted: false };

  const maxRetries = Math.min(2, Math.max(0, Number(input.maxStateSaveRetries ?? 1)));
  let retries = 0;
  let current = generatedState;
  let version = expectedVersion;
  while (retries <= maxRetries) {
    try {
      current._saveAudit = {
        actorId: "mail_scheduler_ai",
        actorName: "邮箱定时 AI 建议",
        source: input.source,
        reason: `邮件同步后生成 AI 待审核建议：${text(input.account?.id)}`,
      };
      const savedState = await dependencies.saveState(current, version);
      return { ...outcome, state: savedState, retries, persisted: true };
    } catch (error) {
      if (error?.code !== "version_conflict" || retries >= maxRetries) {
        return {
          ...outcome,
          state,
          retries,
          persisted: false,
          persistenceError: redactLogText(error?.message || "AI 建议保存失败"),
        };
      }
      retries += 1;
      const latest = await dependencies.loadState();
      current = mergeScheduledAiSuggestionState(latest, generatedState);
      version = latest?.meta?.version;
    }
  }
  return { ...outcome, state, retries, persisted: false };
}

async function executeMailScheduler(dependencies, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const source = ["local_timer", "vercel_cron", "manual"].includes(text(options.source)) ? text(options.source) : "manual";
  let settings = await dependencies.loadSettings();
  const results = [];
  const force = options.force === true;
  let schedulerLock = null;

  if (typeof dependencies.acquireSchedulerLock === "function") {
    schedulerLock = await dependencies.acquireSchedulerLock({
      now,
      source,
      requestId: text(options.requestId),
      leaseMinutes: options.leaseMinutes,
      runId: `mail-scheduler-${randomUUID()}`,
    });
    if (!schedulerLock?.acquired) {
      return {
        ok: true,
        status: "skipped",
        results: [{ accountId: "", status: "skipped", reason: "scheduler_run_in_progress" }],
        settings,
      };
    }
  }

  try {
    for (const account of accountCandidates(settings, options)) {
      const baseAutomation = schedulerAutomation(settings, text(account.id), force);
      const decision = dueDecision(baseAutomation, account, now);
      if (!decision.eligible) {
        results.push({ accountId: text(account.id), status: "skipped", reason: decision.reason });
        continue;
      }
      const reservation = reserveRun(baseAutomation, account, {
        accounts: settings.accounts,
        now,
        source,
        requestId: options.requestId,
        leaseMinutes: options.leaseMinutes,
        runId: `mail-run-${randomUUID()}`,
      });
      if (!reservation.run) {
        results.push({ accountId: text(account.id), status: "skipped", reason: reservation.decision.reason });
        continue;
      }

      let lock = null;
      try {
        if (typeof dependencies.acquireAccountLock === "function") {
          lock = await dependencies.acquireAccountLock({
            account,
            run: reservation.run,
            now,
            leaseMinutes: options.leaseMinutes,
          });
          if (!lock?.acquired) {
            results.push({ accountId: text(account.id), status: "skipped", reason: "run_in_progress" });
            continue;
          }
        }

        // A manual sync may bypass the switch for this one execution, but must never turn automation on.
        reservation.automation.enabled = normalizeMailAutomation(settings.automation, settings.accounts, settings.automation).enabled;
        settings = await dependencies.saveSettings({ ...settings, automation: reservation.automation });

        const outcome = await syncAndSaveWithRetry(dependencies, settings, account, {
          ...options,
          source,
          maxPerFolder: reservation.automation.maxPerFolder,
        });
        let aiOutcome = null;
        if (outcome.state) {
          try {
            aiOutcome = await saveScheduledAiSuggestionsWithRetry(
              dependencies,
              outcome.state,
              outcome.state?.meta?.version,
              {
                source,
                account,
                accounts: settings.accounts,
                automation: settings.automation,
                runId: `${reservation.run.id}-ai`,
                maxStateSaveRetries: options.maxStateSaveRetries,
                generateFollowUpAiSuggestion: dependencies.generateFollowUpAiSuggestion,
              },
            );
          } catch (error) {
            aiOutcome = {
              status: "failed",
              suggestions: [],
              persistenceError: redactLogText(error?.message || "AI 建议生成失败"),
            };
          }
        }
        const status = outcome.summary?.warnings?.length ? "partial" : "succeeded";
        const aiAutomation = aiOutcome?.automation
          ? normalizeMailAutomation(aiOutcome.automation, settings.accounts, settings.automation)
          : normalizeMailAutomation(settings.automation, settings.accounts, settings.automation);
        const finalized = finalizeRun(reservation.automation, reservation.run, {
          accounts: settings.accounts,
          status,
          summary: summaryForLog(outcome.summary),
          warning: outcome.retries ? `保存版本冲突后已重试 ${outcome.retries} 次。` : "",
        }, new Date());
        settings = updateAccountSyncMetadata({
          ...settings,
          // AI suggestions own only their settings and history. Preserve the just-finalized
          // scheduler lease/account state/run log rather than reapplying stale settings.
          automation: normalizeMailAutomation({
            ...finalized.automation,
            ...aiAutomationPatch(aiAutomation),
          }, settings.accounts, finalized.automation),
        }, account.id, outcome.summary, new Date());
        settings = await dependencies.saveSettings(settings);
        results.push({
          accountId: text(account.id),
          status,
          summary: summaryForLog(outcome.summary),
          retries: outcome.retries,
          runId: finalized.run.id,
          state: aiOutcome?.state || outcome.state,
          ai: aiOutcome ? {
            status: aiOutcome.status,
            generated: Number(aiOutcome.run?.generated || 0),
            failed: Number(aiOutcome.run?.failed || 0),
            skipped: Number(aiOutcome.run?.skipped || 0),
            persisted: aiOutcome.persisted === true,
            warning: aiOutcome.persistenceError || "",
          } : null,
        });
      } catch (error) {
        const finalized = finalizeRun(reservation.automation, reservation.run, {
          accounts: settings.accounts,
          status: "failed",
          error: redactLogText(error?.message || "邮箱同步失败"),
        }, new Date());
        settings = await dependencies.saveSettings({ ...settings, automation: finalized.automation });
        results.push({
          accountId: text(account.id),
          status: "failed",
          error: redactLogText(error?.message || "邮箱同步失败"),
          runId: finalized.run.id,
        });
      } finally {
        if (lock?.acquired && typeof dependencies.releaseAccountLock === "function") {
          try {
            await dependencies.releaseAccountLock(lock);
          } catch {
            // The persisted lease remains visible and expires; never mask the sync result with lock cleanup noise.
          }
        }
      }
    }
  } finally {
    if (schedulerLock?.acquired && typeof dependencies.releaseSchedulerLock === "function") {
      try {
        await dependencies.releaseSchedulerLock(schedulerLock);
      } catch {
        // The scheduler can recover from a stale global lease; do not mask completed account results.
      }
    }
  }

  const completed = results.filter((result) => result.status === "succeeded" || result.status === "partial");
  const failed = results.filter((result) => result.status === "failed");
  return {
    ok: failed.length === 0,
    status: failed.length ? (completed.length ? "partial" : "failed") : (completed.length ? "succeeded" : "skipped"),
    results,
    settings,
  };
}

module.exports = {
  executeMailScheduler,
  updateAccountSyncMetadata,
  syncAndSaveWithRetry,
  mergeScheduledAiSuggestionState,
  saveScheduledAiSuggestionsWithRetry,
  aiAutomationPatch,
};
