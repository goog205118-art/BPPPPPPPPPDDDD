const { randomUUID } = require("node:crypto");

const CASE_STAGES = new Set([
  "待开发",
  "已联系待回复",
  "初步沟通",
  "已回复",
  "合作协商",
  "谈合作方式 / 报价",
  "条款确认",
  "待寄样",
  "已寄样",
  "运输中",
  "已签收",
  "待发布",
  "已发布",
  "待数据回收",
  "数据回收",
  "合作完成",
  "已结案",
  "合作终止",
  "暂停跟进",
  "未谈妥",
]);

const CASE_STAGE_TRANSITIONS = new Map([
  ["待开发", new Set(["已联系待回复", "合作终止", "未谈妥"])],
  ["已联系待回复", new Set(["初步沟通", "合作终止", "暂停跟进", "未谈妥"])],
  ["初步沟通", new Set(["合作协商", "待寄样", "合作终止", "暂停跟进", "未谈妥"])],
  ["已回复", new Set(["初步沟通", "合作协商", "待寄样", "合作终止", "暂停跟进", "未谈妥"])],
  ["合作协商", new Set(["谈合作方式 / 报价", "条款确认", "待寄样", "合作终止", "暂停跟进", "未谈妥"])],
  ["谈合作方式 / 报价", new Set(["条款确认", "待寄样", "合作终止", "暂停跟进", "未谈妥"])],
  ["条款确认", new Set(["待寄样", "合作终止", "暂停跟进", "未谈妥"])],
  ["待寄样", new Set(["已寄样", "合作终止", "暂停跟进"])],
  ["已寄样", new Set(["运输中", "已签收", "待发布", "合作终止", "暂停跟进"])],
  ["运输中", new Set(["已签收", "待发布", "合作终止", "暂停跟进"])],
  ["已签收", new Set(["待发布", "合作终止", "暂停跟进"])],
  ["待发布", new Set(["已发布", "合作终止", "暂停跟进"])],
  ["已发布", new Set(["待数据回收", "数据回收", "合作完成", "已结案"])],
  ["待数据回收", new Set(["数据回收", "合作完成", "已结案"])],
  ["数据回收", new Set(["合作完成", "已结案"])],
  ["合作完成", new Set(["已结案"])],
  ["暂停跟进", new Set(["已联系待回复", "初步沟通", "合作协商", "待寄样", "待发布", "合作终止", "未谈妥"])],
  ["未谈妥", new Set(["初步沟通", "合作协商", "合作终止"])],
  ["合作终止", new Set()],
  ["已结案", new Set()],
]);

const TASK_STATUSES = new Set(["待处理", "已完成", "已失效", "已跳过", "待修复"]);
const TASK_PRIORITIES = new Set(["高", "中", "低", "普通"]);

function text(value) {
  return String(value ?? "").trim();
}

function flag(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "是"].includes(text(value).toLowerCase());
}

function iso(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function createCase(input = {}, now = new Date().toISOString()) {
  const brandId = text(input.brand_id);
  if (!brandId) throw new Error("Case 必须关联品牌。");
  if (!text(input.creator_id) && !text(input.lead_id)) {
    throw new Error("Case 必须关联达人或待开发达人。");
  }

  return {
    id: text(input.id) || `CASE-${randomUUID()}`,
    brand_id: brandId,
    creator_id: text(input.creator_id),
    lead_id: text(input.lead_id),
    product_ids: Array.isArray(input.product_ids) ? [...new Set(input.product_ids.map(text).filter(Boolean))] : [],
    cooperation_id: text(input.cooperation_id),
    stage: CASE_STAGES.has(text(input.stage)) ? text(input.stage) : "待开发",
    priority: text(input.priority) || "普通",
    quote_amount: Number.isFinite(Number(input.quote_amount)) ? Number(input.quote_amount) : null,
    shipping_address: text(input.shipping_address),
    tracking_no: text(input.tracking_no),
    publish_due_at: text(input.publish_due_at),
    next_action: text(input.next_action),
    next_action_at: text(input.next_action_at),
    last_outreach_at: text(input.last_outreach_at),
    version: Math.max(1, Number(input.version) || 1),
    last_stage_changed_at: text(input.last_stage_changed_at),
    last_stage_changed_by: text(input.last_stage_changed_by),
    last_stage_change_reason: text(input.last_stage_change_reason),
    last_stage_change_source: text(input.last_stage_change_source),
    last_stage_change_event_id: text(input.last_stage_change_event_id),
    createdAt: text(input.createdAt) || iso(now),
    updatedAt: text(input.updatedAt) || iso(now),
  };
}

function canTransitionCaseStage(fromStage, toStage) {
  const from = text(fromStage);
  const to = text(toStage);
  return from === to || Boolean(CASE_STAGE_TRANSITIONS.get(from)?.has(to));
}

function caseById(state, caseId) {
  return (Array.isArray(state?.cases) ? state.cases : []).find((item) => text(item.id) === text(caseId)) || null;
}

function recordCaseStageChange(state, input = {}, now = new Date().toISOString()) {
  const caseId = text(input.case_id);
  const caseRow = caseById(state, caseId);
  if (!caseRow) throw new Error("未找到目标 Case。");

  const followUpId = text(input.follow_up_id);
  const followUp = (Array.isArray(state?.followUps) ? state.followUps : [])
    .find((item) => text(item.id) === followUpId) || null;
  if (followUp && text(followUp.brand_id) && text(followUp.brand_id) !== text(caseRow.brand_id)) {
    throw new Error("合作跟进与 Case 品牌不一致，禁止跨品牌推进。");
  }

  const previousStage = text(input.previous_stage || followUp?.stage || caseRow.stage);
  const nextStage = text(input.next_stage);
  const reason = text(input.change_reason);
  if (!CASE_STAGES.has(nextStage)) throw new Error("目标 Case 阶段无效。");
  if (!reason) throw new Error("人工阶段变更必须填写原因。");

  const timestamp = iso(now);
  const eventId = text(input.event_id) || `EV-${randomUUID()}`;
  const nextVersion = Math.max(1, Number(caseRow.version) || 1) + 1;
  const actor = text(input.actor) || "人工操作";
  const source = text(input.source) || "manual_stage_change";
  const event = {
    id: eventId,
    brand_id: caseRow.brand_id,
    case_id: caseRow.id,
    follow_up_id: followUpId,
    type: "stage_update",
    direction: "internal",
    subject: text(input.subject) || "合作阶段已更新",
    excerpt: text(input.excerpt) || `${previousStage || "未设置"} -> ${nextStage}`,
    source,
    previous_stage: previousStage,
    next_stage: nextStage,
    actor,
    change_reason: reason,
    evidence: text(input.evidence),
    case_version: nextVersion,
    occurred_at: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  Object.assign(caseRow, {
    stage: nextStage,
    version: nextVersion,
    last_stage_changed_at: timestamp,
    last_stage_changed_by: actor,
    last_stage_change_reason: reason,
    last_stage_change_source: source,
    last_stage_change_event_id: eventId,
    updatedAt: timestamp,
  });
  if (followUp) {
    Object.assign(followUp, {
      stage: nextStage,
      has_unread_reply: false,
      updatedAt: timestamp,
    });
  }

  const events = Array.isArray(state?.followUpEvents) ? state.followUpEvents : (state.followUpEvents = []);
  events.push(event);
  return { case: caseRow, followUp, event };
}

function assertSameBrand(caseRow, mailRow) {
  if (!caseRow) throw new Error("未找到目标 Case。");
  if (!mailRow) throw new Error("未找到待分诊邮件。");
  if (text(caseRow.brand_id) !== text(mailRow.brand_id)) {
    throw new Error("邮件与 Case 品牌不一致，禁止跨品牌归档。");
  }
}

function archiveTriageMail(state, input = {}, now = new Date().toISOString()) {
  const mailId = text(input.mail_id);
  const caseId = text(input.case_id);
  const inbox = Array.isArray(state?.mailInbox) ? state.mailInbox : [];
  const mailIndex = inbox.findIndex((item) => text(item.id) === mailId);
  if (mailIndex < 0) throw new Error("未找到待分诊邮件。");
  const selectedCase = caseById(state, caseId);
  const mailRow = inbox[mailIndex];
  assertSameBrand(selectedCase, mailRow);

  const candidateIds = Array.isArray(mailRow.candidate_case_ids) ? mailRow.candidate_case_ids.map(text).filter(Boolean) : [];
  if (candidateIds.length && !candidateIds.includes(caseId)) {
    throw new Error("所选 Case 不在该邮件的候选范围内。");
  }

  const timestamp = iso(now);
  const nextMail = {
    ...mailRow,
    case_id: caseId,
    status: "已归档",
    match_type: "manual",
    resolved_at: timestamp,
    updatedAt: timestamp,
  };
  inbox[mailIndex] = nextMail;

  const events = Array.isArray(state.followUpEvents) ? state.followUpEvents : (state.followUpEvents = []);
  const existing = events.find((item) => text(item.mail_inbox_id) === mailId && text(item.case_id) === caseId);
  if (!existing) {
    events.push({
      id: `EV-${randomUUID()}`,
      brand_id: selectedCase.brand_id,
      case_id: caseId,
      mail_inbox_id: mailId,
      type: "email",
      direction: text(mailRow.direction) || "inbound",
      subject: text(mailRow.subject),
      excerpt: text(mailRow.excerpt),
      occurred_at: text(mailRow.occurred_at) || timestamp,
      source: "manual_triage",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return { mail: nextMail, case: selectedCase, eventCreated: !existing };
}

function taskKey(caseId, type, sourceId = "") {
  return [text(caseId), text(type), text(sourceId)].join(":");
}

function taskById(state, taskId) {
  return (Array.isArray(state?.actionTasks) ? state.actionTasks : [])
    .find((item) => text(item.id) === text(taskId)) || null;
}

function taskValidationError(state, input = {}) {
  const caseId = text(input.case_id);
  if (!caseId) return "行动任务必须关联 Case。";
  const caseRow = caseById(state, caseId);
  if (!caseRow) return "行动任务关联的 Case 不存在。";
  const inputBrandId = text(input.brand_id);
  if (inputBrandId && inputBrandId !== text(caseRow.brand_id)) {
    return "行动任务与 Case 品牌不一致，禁止跨品牌保存。";
  }
  return "";
}

function createActionTask(state, input = {}, now = new Date().toISOString()) {
  const validationError = taskValidationError(state, input);
  if (validationError) throw new Error(validationError);

  const caseRow = caseById(state, input.case_id);
  const status = TASK_STATUSES.has(text(input.status)) ? text(input.status) : "待处理";
  const completionEvidence = text(input.completion_evidence);
  if (!text(input.title)) throw new Error("行动任务必须填写标题。");
  if (status === "已完成" && !completionEvidence) {
    throw new Error("完成行动任务必须填写完成证据。");
  }

  const timestamp = iso(now);
  return {
    id: text(input.id) || `TASK-${randomUUID()}`,
    brand_id: caseRow.brand_id,
    brand: text(caseRow.brand),
    case_id: caseRow.id,
    source: text(input.source) || "manual",
    source_id: text(input.source_id),
    type: text(input.type) || "general",
    title: text(input.title),
    description: text(input.description),
    owner_id: text(input.owner_id),
    owner_name: text(input.owner_name),
    priority: TASK_PRIORITIES.has(text(input.priority)) ? text(input.priority) : "普通",
    due_at: text(input.due_at),
    status,
    completion_evidence: completionEvidence,
    completed_at: status === "已完成" ? (text(input.completed_at) || timestamp) : "",
    dedupe_key: text(input.dedupe_key),
    generated: flag(input.generated),
    validation_error: "",
    version: Math.max(1, Number(input.version) || 1),
    createdAt: text(input.createdAt) || timestamp,
    updatedAt: text(input.updatedAt) || timestamp,
  };
}

function latestEvent(events, predicate) {
  return events
    .filter(predicate)
    .sort((left, right) => new Date(right.occurred_at || 0) - new Date(left.occurred_at || 0))[0] || null;
}

function taskSpec(type, sourceId, title, priority, dueAt, description = "") {
  return {
    type,
    source_id: text(sourceId),
    title,
    description,
    priority,
    due_at: text(dueAt),
  };
}

function isPendingTriageMail(mailRow) {
  return text(mailRow?.status) !== "已归档"
    && text(mailRow?.direction) === "inbound";
}

function mailBelongsUniquelyToCase(mailRow, caseId, brandId) {
  if (text(mailRow?.brand_id) !== text(brandId)) return false;
  if (text(mailRow?.case_id) === text(caseId)) return true;
  const candidates = Array.isArray(mailRow?.candidate_case_ids)
    ? mailRow.candidate_case_ids.map(text).filter(Boolean)
    : [];
  return candidates.length === 1 && candidates[0] === text(caseId);
}

function unreadReplyEventForCase(state, caseRow, events) {
  const unreadFollowUpIds = new Set(
    (Array.isArray(state?.followUps) ? state.followUps : [])
      .filter((followUp) => text(followUp.case_id) === text(caseRow.id)
        && text(followUp.brand_id) === text(caseRow.brand_id)
        && flag(followUp.has_unread_reply))
      .map((followUp) => text(followUp.id))
      .filter(Boolean),
  );
  if (!unreadFollowUpIds.size) return null;

  const latestOutbound = latestEvent(events, (item) => text(item.direction) === "outbound");
  const latestUnreadInbound = latestEvent(
    events,
    (item) => text(item.direction) === "inbound"
      && unreadFollowUpIds.has(text(item.follow_up_id))
      && (!latestOutbound || new Date(item.occurred_at || 0) >= new Date(latestOutbound.occurred_at || 0)),
  );
  return latestUnreadInbound;
}

function generatedTaskSpecs(state, caseRow, now) {
  const events = (Array.isArray(state.followUpEvents) ? state.followUpEvents : [])
    .filter((item) => text(item.case_id) === text(caseRow.id)
      && text(item.brand_id) === text(caseRow.brand_id));
  const inbox = (Array.isArray(state.mailInbox) ? state.mailInbox : [])
    .filter((item) => mailBelongsUniquelyToCase(item, caseRow.id, caseRow.brand_id));
  const specs = [];

  const unreadReply = unreadReplyEventForCase(state, caseRow, events);
  if (unreadReply) {
    specs.push(taskSpec(
      "new_reply",
      unreadReply.id,
      "达人新回信待处理",
      "高",
      text(unreadReply.occurred_at) || iso(now),
      "已归档到当前合作 Case 的新回信尚未标记已读，待人工阅读、判断和推进。",
    ));
  }

  for (const mail of inbox.filter(isPendingTriageMail)) {
    specs.push(taskSpec(
      "mail_triage",
      mail.id,
      "待人工归档邮件",
      "高",
      text(mail.occurred_at) || iso(now),
      "邮件已唯一匹配当前 Case，但尚未完成归档确认；确认前不写入沟通时间线。",
    ));
  }

  const latestOutbound = latestEvent(events, (item) => text(item.direction) === "outbound");
  const latestInbound = latestEvent(
    [...events.filter((item) => text(item.direction) === "inbound"), ...inbox.filter(isPendingTriageMail)],
    () => true,
  );
  const outboundAt = latestOutbound?.occurred_at || caseRow.last_outreach_at;
  const hasNewerReply = latestInbound && outboundAt && new Date(latestInbound.occurred_at) >= new Date(outboundAt);
  const daysSinceOutbound = outboundAt ? (new Date(now).getTime() - new Date(outboundAt).getTime()) / 86400000 : 0;
  if (caseRow.stage === "已联系待回复" && outboundAt && daysSinceOutbound >= 3 && !hasNewerReply) {
    specs.push(taskSpec(
      "reply_overdue",
      outboundAt,
      "已联系超过三天未回复",
      "中",
      iso(now),
      "最近一次外联后三天仍无更晚的达人回信，建议人工决定是否复联。",
    ));
  }

  if (caseRow.stage === "待寄样" && !text(caseRow.shipping_address)) {
    specs.push(taskSpec(
      "address_needed",
      "shipping_address",
      "待补寄样地址",
      "高",
      iso(now),
      "已进入寄样阶段，但当前 Case 未保存收件地址。",
    ));
  }
  if (caseRow.stage === "待寄样" && text(caseRow.shipping_address) && !text(caseRow.tracking_no)) {
    specs.push(taskSpec(
      "sample_pending",
      "shipping",
      "待安排寄样",
      "高",
      iso(now),
      "收件地址已具备，但尚未登记物流单号或寄样动作。",
    ));
  }

  if (["合作协商", "谈合作方式 / 报价"].includes(text(caseRow.stage))) {
    specs.push(taskSpec(
      "quote_confirmation_pending",
      "quote_confirmation",
      "待确认报价与合作方式",
      "高",
      iso(now),
      "当前处于合作协商阶段，报价、合作方式或条款尚需人工确认。",
    ));
  }
  if (caseRow.stage === "待发布") {
    specs.push(taskSpec(
      "publish_pending",
      "publication",
      "待确认内容发布",
      "中",
      text(caseRow.publish_due_at) || iso(now),
      "样品合作已进入待发布阶段，需人工核对发布时间或发布链接。",
    ));
  }
  if (caseRow.stage === "待数据回收") {
    specs.push(taskSpec(
      "performance_data_pending",
      "performance_data",
      "待回收合作数据",
      "中",
      iso(now),
      "内容已发布或已到数据回收阶段，需人工收集点击、订单或其他约定数据。",
    ));
  }
  return specs;
}

function reconcileCaseTasks(state, now = new Date().toISOString()) {
  const tasks = Array.isArray(state?.actionTasks) ? state.actionTasks : (state.actionTasks = []);
  const activeKeys = new Set();
  const created = [];
  const timestamp = iso(now);

  for (const caseRow of Array.isArray(state?.cases) ? state.cases : []) {
    for (const spec of generatedTaskSpecs(state, caseRow, timestamp)) {
      const dedupe_key = taskKey(caseRow.id, spec.type, spec.source_id);
      activeKeys.add(dedupe_key);
      const existing = tasks.find((item) => text(item.dedupe_key) === dedupe_key
        && text(item.case_id) === text(caseRow.id)
        && text(item.brand_id) === text(caseRow.brand_id));
      if (existing) {
        if (text(existing.status) === "已失效") {
          existing.status = "待处理";
          existing.title = spec.title;
          existing.description = spec.description;
          existing.priority = spec.priority;
          existing.due_at = spec.due_at;
          existing.validation_error = "";
          existing.version = Math.max(1, Number(existing.version) || 1) + 1;
          existing.updatedAt = timestamp;
        }
        continue;
      }
      const next = {
        ...createActionTask(state, {
          brand_id: caseRow.brand_id,
          case_id: caseRow.id,
          source: "case_rule",
          source_id: spec.source_id,
          type: spec.type,
          dedupe_key,
          title: spec.title,
          priority: spec.priority,
          due_at: spec.due_at,
          status: "待处理",
          generated: true,
        }, timestamp),
      };
      tasks.push(next);
      created.push(next);
    }
  }

  const invalidated = [];
  for (const task of tasks) {
    if (task.generated
      && text(task.source) === "case_rule"
      && text(task.status) === "待处理"
      && !activeKeys.has(text(task.dedupe_key))) {
      task.status = "已失效";
      task.version = Math.max(1, Number(task.version) || 1) + 1;
      task.updatedAt = timestamp;
      invalidated.push(task);
    }
  }
  return { created, invalidated, tasks };
}

function completeTask(state, taskId, evidence = "", now = new Date().toISOString()) {
  const task = taskById(state, taskId);
  if (!task) throw new Error("未找到待办。");
  const validationError = taskValidationError(state, task);
  if (validationError) throw new Error(validationError);
  const completionEvidence = text(evidence);
  if (!completionEvidence) throw new Error("完成行动任务必须填写完成证据。");
  task.status = "已完成";
  task.completed_at = iso(now);
  task.completion_evidence = completionEvidence;
  task.validation_error = "";
  task.version = Math.max(1, Number(task.version) || 1) + 1;
  task.updatedAt = task.completed_at;
  return task;
}

function patchVersionedRecord(collection, id, expectedVersion, patch = {}, now = new Date().toISOString()) {
  const row = (Array.isArray(collection) ? collection : []).find((item) => text(item.id) === text(id));
  if (!row) return { ok: false, code: "not_found" };
  const expected = Number(expectedVersion);
  const actual = Math.max(1, Number(row.version) || 1);
  if (!Number.isInteger(expected) || expected !== actual) {
    return { ok: false, code: "version_conflict", actualVersion: actual, current: { ...row } };
  }
  const updated = {
    ...row,
    ...patch,
    id: row.id,
    version: actual + 1,
    updatedAt: iso(now),
  };
  const index = collection.indexOf(row);
  collection[index] = updated;
  return { ok: true, entity: updated };
}

module.exports = {
  CASE_STAGES,
  CASE_STAGE_TRANSITIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  archiveTriageMail,
  canTransitionCaseStage,
  completeTask,
  createActionTask,
  createCase,
  patchVersionedRecord,
  recordCaseStageChange,
  reconcileCaseTasks,
  taskKey,
};
