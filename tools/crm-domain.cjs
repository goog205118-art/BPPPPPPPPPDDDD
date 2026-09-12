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
const AI_HIGH_RISK_CASE_STAGES = new Set([
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
  "未谈妥",
]);

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

function applyAiSuggestedCaseStage(state, input = {}, now = new Date().toISOString()) {
  const caseId = text(input.case_id);
  const caseRow = caseById(state, caseId);
  if (!caseRow) throw new Error("未找到目标 Case。");
  const followUpId = text(input.follow_up_id);
  const followUp = (Array.isArray(state?.followUps) ? state.followUps : [])
    .find((item) => text(item.id) === followUpId) || null;
  const nextStage = text(input.next_stage);
  const reason = text(input.change_reason);
  if (!CASE_STAGES.has(nextStage)) throw new Error("AI 未返回可应用的有效阶段。");
  if (text(caseRow.stage) === nextStage || text(followUp?.stage) === nextStage) {
    throw new Error("AI 建议与当前阶段相同，无需写入重复阶段事件。");
  }
  if (!reason) throw new Error("人工应用 AI 建议必须填写理由。");
  if (!flag(input.confirmed)) throw new Error("人工应用 AI 建议必须完成确认。");
  if (AI_HIGH_RISK_CASE_STAGES.has(nextStage) && !flag(input.high_risk_confirmed)) {
    throw new Error("高风险 AI 阶段建议必须完成额外事实确认。");
  }
  return recordCaseStageChange(state, {
    case_id: caseId,
    follow_up_id: followUpId,
    next_stage: nextStage,
    previous_stage: text(input.previous_stage) || text(followUp?.stage) || text(caseRow.stage),
    change_reason: reason,
    actor: "人工确认",
    source: "ai_suggestion_confirmed",
    subject: "已人工应用 AI 阶段建议",
    excerpt: text(input.excerpt) || `阶段：${nextStage}`,
    evidence: text(input.evidence),
  }, now);
}

function assertSameBrand(caseRow, mailRow) {
  if (!caseRow) throw new Error("未找到目标 Case。");
  if (!mailRow) throw new Error("未找到待分诊邮件。");
  if (text(caseRow.brand_id) !== text(mailRow.brand_id)) {
    throw new Error("邮件与 Case 品牌不一致，禁止跨品牌归档。");
  }
}

function isTerminalCase(caseRow) {
  return ["合作终止", "已结案", "未谈妥"].includes(text(caseRow?.stage));
}

function triageCandidateCases(state, mailRow) {
  const candidateIds = new Set(
    (Array.isArray(mailRow?.candidate_case_ids) ? mailRow.candidate_case_ids : [])
      .map(text)
      .filter(Boolean),
  );
  if (!candidateIds.size) return [];
  return (Array.isArray(state?.cases) ? state.cases : [])
    .filter((caseRow) => text(caseRow.brand_id) === text(mailRow?.brand_id))
    .filter((caseRow) => !isTerminalCase(caseRow))
    .filter((caseRow) => candidateIds.has(text(caseRow.id)));
}

function ensureOpenTriageMail(mailRow) {
  if (text(mailRow?.status) === "已归档" || text(mailRow?.triage_status) === "archived") {
    throw new Error("该邮件已归档，不能再次处理。");
  }
  if (text(mailRow?.triage_status) === "ignored") {
    throw new Error("该邮件已忽略；如需重新处理，请先恢复邮件分诊状态。");
  }
}

function linkedFollowUpsForCase(state, caseRow) {
  return (Array.isArray(state?.followUps) ? state.followUps : [])
    .filter((followUp) => text(followUp.case_id) === text(caseRow.id))
    .filter((followUp) => text(followUp.brand_id) === text(caseRow.brand_id));
}

function linkedFollowUpForTriageMail(state, caseRow, mailRow) {
  const linked = linkedFollowUpsForCase(state, caseRow);
  if (!linked.length) return null;

  const explicitIds = new Set([
    ...(Array.isArray(mailRow?.candidate_follow_up_ids) ? mailRow.candidate_follow_up_ids : []),
    ...(Array.isArray(mailRow?.match_candidates) ? mailRow.match_candidates
      .filter((candidate) => text(candidate?.case_id) === text(caseRow.id))
      .map((candidate) => candidate?.follow_up_id) : []),
  ].map(text).filter(Boolean));
  if (explicitIds.size) {
    const explicitMatches = linked.filter((followUp) => explicitIds.has(text(followUp.id)));
    return explicitMatches.length === 1 ? explicitMatches[0] : null;
  }
  return linked.length === 1 ? linked[0] : null;
}

function latestTimestamp(left, right) {
  const leftDate = new Date(text(left));
  const rightDate = new Date(text(right));
  if (Number.isNaN(leftDate.getTime())) return text(right);
  if (Number.isNaN(rightDate.getTime())) return text(left);
  return leftDate >= rightDate ? leftDate.toISOString() : rightDate.toISOString();
}

function addressList(value) {
  return String(value ?? "")
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
    ?.map((email) => email.toLowerCase()) || [];
}

function canSafelyEnterInitialCommunication(caseRow, followUp) {
  const lowRiskStages = new Set(["", "已联系待回复", "待回复", "初步沟通"]);
  return lowRiskStages.has(text(caseRow?.stage)) && lowRiskStages.has(text(followUp?.stage));
}

function updateContactTrackForInboundArchive(state, caseRow, followUp, mailRow, timestamp) {
  if (text(mailRow?.direction) !== "inbound" || !text(caseRow?.creator_id)) return null;
  const creator = (Array.isArray(state?.creators) ? state.creators : [])
    .find((item) => text(item.id) === text(caseRow.creator_id)
      && text(item.brand_id) === text(caseRow.brand_id));
  const creatorEmails = new Set(addressList(creator?.email));
  const senderEmails = new Set(addressList(mailRow?.sender));
  const matchedEmail = [...senderEmails].find((email) => creatorEmails.has(email));
  if (!matchedEmail) return null;

  const tracks = Array.isArray(state?.contactTracks) ? state.contactTracks : (state.contactTracks = []);
  const track = tracks.find((item) => text(item.brand_id) === text(caseRow.brand_id)
    && text(item.person_type || "creator") === "creator"
    && text(item.person_id) === text(caseRow.creator_id)
    && text(item.email).toLowerCase() === matchedEmail
    && (!text(item.follow_up_id) || text(item.follow_up_id) === text(followUp?.id)));
  if (!track) return null;
  Object.assign(track, {
    status: "replied",
    follow_up_id: text(followUp?.id),
    case_id: caseRow.id,
    replied_at: latestTimestamp(track.replied_at, text(mailRow.occurred_at) || timestamp),
    updatedAt: timestamp,
  });
  return track;
}

function archiveTriageMail(state, input = {}, now = new Date().toISOString()) {
  const mailId = text(input.mail_id);
  const caseId = text(input.case_id);
  const inbox = Array.isArray(state?.mailInbox) ? state.mailInbox : [];
  const mailIndex = inbox.findIndex((item) => text(item.id) === mailId);
  if (mailIndex < 0) throw new Error("未找到待分诊邮件。");
  const selectedCase = caseById(state, caseId);
  const mailRow = inbox[mailIndex];
  ensureOpenTriageMail(mailRow);
  assertSameBrand(selectedCase, mailRow);

  const candidateIds = Array.isArray(mailRow.candidate_case_ids) ? mailRow.candidate_case_ids.map(text).filter(Boolean) : [];
  if (!candidateIds.length || !candidateIds.includes(caseId)) {
    throw new Error("所选 Case 不在该邮件的候选范围内。");
  }

  const timestamp = iso(now);
  const followUp = linkedFollowUpForTriageMail(state, selectedCase, mailRow);
  const inboundReply = text(mailRow.direction) === "inbound";
  const stageAdvanced = Boolean(inboundReply && followUp && canSafelyEnterInitialCommunication(selectedCase, followUp)
    && (text(selectedCase.stage) !== "初步沟通" || text(followUp.stage) !== "初步沟通"));
  const eventId = `EV-${randomUUID()}`;
  const eventOccurredAt = text(mailRow.occurred_at) || timestamp;
  const previousCaseStage = text(selectedCase.stage);
  let caseVersion = Math.max(1, Number(selectedCase.version) || 1);
  if (followUp && inboundReply) {
    followUp.has_unread_reply = true;
    followUp.last_email_at = latestTimestamp(followUp.last_email_at, eventOccurredAt);
    if (stageAdvanced) followUp.stage = "初步沟通";
    followUp.updatedAt = timestamp;
  }
  if (stageAdvanced) {
    caseVersion += 1;
    Object.assign(selectedCase, {
      stage: "初步沟通",
      version: caseVersion,
      last_stage_changed_at: timestamp,
      last_stage_changed_by: text(input.actor_name) || "人工",
      last_stage_change_reason: "人工确认归档达人新回信",
      last_stage_change_source: "manual_triage_inbound_reply",
      last_stage_change_event_id: eventId,
      updatedAt: timestamp,
    });
  }
  const nextMail = {
    ...mailRow,
    case_id: caseId,
    status: "已归档",
    match_type: "manual",
    triage_status: "archived",
    triage_reason: text(input.reason) || "人工确认归档",
    triage_resolved_at: timestamp,
    triage_resolved_by: text(input.actor_name) || "人工",
    resolved_at: timestamp,
    updatedAt: timestamp,
  };
  inbox[mailIndex] = nextMail;

  const events = Array.isArray(state.followUpEvents) ? state.followUpEvents : (state.followUpEvents = []);
  const existing = events.find((item) => text(item.mail_inbox_id) === mailId && text(item.case_id) === caseId);
  if (!existing) {
    events.push({
      id: eventId,
      brand_id: selectedCase.brand_id,
      case_id: caseId,
      follow_up_id: text(followUp?.id),
      mail_inbox_id: mailId,
      type: "email",
      direction: text(mailRow.direction) || "inbound",
      subject: text(mailRow.subject),
      sender: text(mailRow.sender),
      recipients: text(mailRow.recipients),
      excerpt: text(mailRow.excerpt),
      body: text(mailRow.body),
      body_cached_at: text(mailRow.body_cached_at),
      body_retention_until: text(mailRow.body_retention_until),
      body_truncated: flag(mailRow.body_truncated),
      message_id: text(mailRow.message_id),
      in_reply_to: text(mailRow.in_reply_to),
      references: Array.isArray(mailRow.references)
        ? mailRow.references.map(text).filter(Boolean)
        : text(mailRow.references),
      fingerprint: text(mailRow.fingerprint),
      mailbox_account_id: text(mailRow.mailbox_account_id),
      mailbox: text(mailRow.mailbox),
      server_key: text(mailRow.server_key),
      imap_uid: text(mailRow.imap_uid),
      occurred_at: eventOccurredAt,
      source: "manual_triage",
      previous_stage: stageAdvanced ? previousCaseStage : "",
      next_stage: stageAdvanced ? "初步沟通" : "",
      actor: stageAdvanced ? (text(input.actor_name) || "人工") : "",
      change_reason: stageAdvanced ? "人工确认归档达人新回信" : "",
      evidence: stageAdvanced ? "人工确认的入站邮件已归档到当前 Case。" : "",
      case_version: stageAdvanced ? caseVersion : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  const contactTrack = followUp ? updateContactTrackForInboundArchive(state, selectedCase, followUp, mailRow, timestamp) : null;
  const taskResult = reconcileCaseTasks(state, timestamp);
  return {
    mail: nextMail,
    case: selectedCase,
    followUp,
    contactTrack,
    eventCreated: !existing,
    stageAdvanced,
    taskResult,
  };
}

function ignoreTriageMail(state, input = {}, now = new Date().toISOString()) {
  const mailId = text(input.mail_id);
  const reason = text(input.reason);
  if (!reason) throw new Error("忽略邮件必须填写原因。");
  const inbox = Array.isArray(state?.mailInbox) ? state.mailInbox : [];
  const mailIndex = inbox.findIndex((item) => text(item.id) === mailId);
  if (mailIndex < 0) throw new Error("未找到待分诊邮件。");
  const mailRow = inbox[mailIndex];
  ensureOpenTriageMail(mailRow);

  const timestamp = iso(now);
  const ignored = {
    ...mailRow,
    triage_status: "ignored",
    triage_reason: reason,
    triage_resolved_at: timestamp,
    triage_resolved_by: text(input.actor_name) || "人工",
    updatedAt: timestamp,
  };
  inbox[mailIndex] = ignored;
  return { mail: ignored };
}

function createTriageCase(state, input = {}, now = new Date().toISOString()) {
  const mailId = text(input.mail_id);
  const creatorId = text(input.creator_id);
  const inbox = Array.isArray(state?.mailInbox) ? state.mailInbox : [];
  const mailRow = inbox.find((item) => text(item.id) === mailId);
  if (!mailRow) throw new Error("未找到待分诊邮件。");
  ensureOpenTriageMail(mailRow);
  const creator = (Array.isArray(state?.creators) ? state.creators : [])
    .find((item) => text(item.id) === creatorId) || null;
  if (!creator) throw new Error("只能基于已有达人资料新建 Case。");
  if (text(creator.brand_id) !== text(mailRow.brand_id)) {
    throw new Error("邮件与达人品牌不一致，禁止跨品牌新建 Case。");
  }

  const candidateCreatorIds = (Array.isArray(mailRow.candidate_creator_ids) ? mailRow.candidate_creator_ids : [])
    .map(text)
    .filter(Boolean);
  if (candidateCreatorIds.length !== 1 || candidateCreatorIds[0] !== creatorId) {
    throw new Error("新建 Case 仅允许用于已唯一识别的已有达人。");
  }

  const existingActiveCase = (Array.isArray(state?.cases) ? state.cases : [])
    .find((caseRow) => text(caseRow.brand_id) === text(creator.brand_id)
      && text(caseRow.creator_id) === creatorId
      && !isTerminalCase(caseRow));
  if (existingActiveCase) {
    throw new Error("该达人已有活跃 Case，请先确认归档到既有 Case。");
  }

  const caseRow = createCase({
    id: input.case_id,
    brand_id: creator.brand_id,
    creator_id: creatorId,
    product_ids: Array.isArray(input.product_ids) ? input.product_ids : [],
    priority: text(input.priority) || "中",
    // New triage cases must never skip directly to a high-risk stage.
    stage: "初步沟通",
    next_action: text(input.next_action) || "阅读回信并确认下一步",
  }, now);
  const cases = Array.isArray(state?.cases) ? state.cases : (state.cases = []);
  cases.push(caseRow);
  const mailIndex = inbox.findIndex((item) => text(item.id) === mailId);
  inbox[mailIndex] = {
    ...mailRow,
    // The Case was created through the unique-creator triage contract, so it
    // becomes the sole explicit archive candidate before the archive step.
    candidate_case_ids: [caseRow.id],
    updatedAt: iso(now),
  };
  const archived = archiveTriageMail(state, {
    mail_id: mailId,
    case_id: caseRow.id,
    reason: text(input.archive_reason) || "人工新建 Case 并归档",
    actor_name: input.actor_name,
  }, now);
  return { case: caseRow, mail: archived.mail, eventCreated: archived.eventCreated };
}

function normalizedEmail(value) {
  return addressList(value)[0] || "";
}

function normalizedSocialUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

function createDomainError(message, code = "", details = []) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function triageLeadDuplicateSuggestions(state, input = {}) {
  const brandId = text(input.brand_id);
  const email = normalizedEmail(input.email);
  const socialUrl = normalizedSocialUrl(input.social_url);
  if (!brandId || (!email && !socialUrl)) return [];
  const matches = [];
  for (const type of ["leads", "creators"]) {
    for (const row of Array.isArray(state?.[type]) ? state[type] : []) {
      if (text(row.brand_id) !== brandId) continue;
      const matched = [];
      if (email && normalizedEmail(row.email) === email) matched.push("邮箱");
      if (socialUrl && normalizedSocialUrl(row.social_url) === socialUrl) matched.push("社媒地址");
      if (matched.length) {
        matches.push({
          type,
          id: text(row.id),
          name: text(row.name) || text(row.handle) || text(row.email) || "未命名资料",
          matched,
        });
      }
    }
  }
  return matches;
}

function senderDisplayName(email) {
  const localPart = text(email).split("@")[0].replace(/[._-]+/g, " ").trim();
  return localPart ? `未知合作来信（${localPart}）` : "未知合作来信";
}

function createTriageLead(state, input = {}, now = new Date().toISOString()) {
  const mailId = text(input.mail_id);
  const inbox = Array.isArray(state?.mailInbox) ? state.mailInbox : [];
  const mailIndex = inbox.findIndex((item) => text(item.id) === mailId);
  if (mailIndex < 0) throw new Error("未找到待分诊邮件。");
  const mailRow = inbox[mailIndex];
  ensureOpenTriageMail(mailRow);
  if (text(mailRow.triage_status) === "lead_created" || text(mailRow.lead_id)) {
    throw new Error("该邮件已创建待开发达人，不能重复处理。");
  }
  if (text(mailRow.direction) !== "inbound") {
    throw new Error("只有入站邮件可以创建待开发达人。");
  }
  const brandId = text(mailRow.brand_id);
  if (!brandId) throw new Error("请先人工确认邮件所属品牌后再创建待开发达人。");
  if (text(input.brand_id) && text(input.brand_id) !== brandId) {
    throw new Error("邮件与待开发达人品牌不一致，禁止跨品牌创建。");
  }
  if (text(mailRow.matched_creator_id) || (Array.isArray(mailRow.candidate_creator_ids) && mailRow.candidate_creator_ids.length)) {
    throw new Error("该邮件已关联或候选关联到已有达人，不能降级创建待开发达人。");
  }
  if ((Array.isArray(mailRow.candidate_case_ids) && mailRow.candidate_case_ids.length)
    || (Array.isArray(mailRow.candidate_follow_up_ids) && mailRow.candidate_follow_up_ids.length)) {
    throw new Error("该邮件已有活跃合作候选，不能创建待开发达人。");
  }

  const email = normalizedEmail(input.email || mailRow.sender);
  if (!email) throw new Error("未能从来信中识别有效邮箱，请补充有效邮箱后再创建。");
  const socialUrl = text(input.social_url);
  const duplicates = triageLeadDuplicateSuggestions(state, { brand_id: brandId, email, social_url: socialUrl });
  if (duplicates.length) {
    const labels = duplicates.map((item) => `${item.type === "creators" ? "达人库" : "待开发达人"}「${item.name}」`).join("、");
    throw createDomainError(`检测到同品牌重复资料：${labels}。请先打开已有记录确认，不会自动合并或重复创建。`, "duplicate_identity", duplicates);
  }

  const timestamp = iso(now);
  const brand = (Array.isArray(state?.brands) ? state.brands : [])
    .find((item) => text(item.id) === brandId);
  const sourceSubject = text(mailRow.subject) || "无主题邮件";
  const lead = {
    id: text(input.lead_id) || `LEAD-${randomUUID()}`,
    brand_id: brandId,
    brand: text(brand?.name) || text(mailRow.brand),
    social_url: socialUrl,
    name: text(input.name) || senderDisplayName(email),
    handle: text(input.handle),
    platform: text(input.platform),
    country: text(input.country),
    niche: text(input.niche),
    followers: null,
    avg_views: null,
    engagement: null,
    email,
    email_source: `邮件来信：${sourceSubject}`,
    source_mail_inbox_id: mailRow.id,
    source_mail_message_id: text(mailRow.message_id),
    source_mail_sender: text(mailRow.sender),
    source_mail_occurred_at: text(mailRow.occurred_at),
    source_mail_subject: sourceSubject,
    source_mail_fingerprint: text(mailRow.fingerprint),
    source_mail_server_key: text(mailRow.server_key),
    source_mail_imap_uid: text(mailRow.imap_uid),
    last_outreach_at: "",
    status: "待开发",
    priority: text(input.priority) || "中",
    notes: text(input.notes),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const leads = Array.isArray(state?.leads) ? state.leads : (state.leads = []);
  leads.push(lead);
  const updatedMail = {
    ...mailRow,
    lead_id: lead.id,
    triage_status: "lead_created",
    triage_reason: text(input.reason) || "人工从陌生合作来信创建待开发达人",
    triage_resolved_at: timestamp,
    triage_resolved_by: text(input.actor_name) || "人工",
    updatedAt: timestamp,
  };
  inbox[mailIndex] = updatedMail;
  return { lead, mail: updatedMail, duplicateSuggestions: [] };
}

function taskKey(caseId, type, sourceId = "") {
  return [text(caseId), text(type), text(sourceId)].join(":");
}

function taskById(state, taskId) {
  return (Array.isArray(state?.actionTasks) ? state.actionTasks : [])
    .find((item) => text(item.id) === text(taskId)) || null;
}

const TASK_EVENT_TYPES = new Set(["created", "assignment", "note", "defer", "complete", "skip"]);

function taskEvents(state) {
  return Array.isArray(state?.actionTaskEvents)
    ? state.actionTaskEvents
    : (state.actionTaskEvents = []);
}

function taskEventsForTask(state, taskId) {
  return taskEvents(state)
    .filter((item) => text(item.task_id) === text(taskId) && !text(item.validation_error))
    .sort((left, right) => new Date(left.occurred_at || 0) - new Date(right.occurred_at || 0));
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

function appendTaskEvent(state, task, input = {}, now = new Date().toISOString()) {
  const validationError = taskValidationError(state, task);
  if (validationError) throw new Error(validationError);
  const type = text(input.type);
  if (!TASK_EVENT_TYPES.has(type)) throw new Error("行动任务事件类型无效。");
  if (text(input.brand_id) && text(input.brand_id) !== text(task.brand_id)) {
    throw new Error("行动任务事件与任务品牌不一致，禁止跨品牌保存。");
  }
  if (text(input.case_id) && text(input.case_id) !== text(task.case_id)) {
    throw new Error("行动任务事件与任务 Case 不一致，禁止跨 Case 保存。");
  }
  const summary = text(input.summary);
  if (!summary) throw new Error("行动任务事件必须填写摘要。");

  const timestamp = iso(now);
  const event = {
    id: text(input.id) || `TASKEVT-${randomUUID()}`,
    task_id: task.id,
    brand_id: task.brand_id,
    case_id: task.case_id,
    type,
    actor_id: text(input.actor_id),
    actor_name: text(input.actor_name) || "当前用户",
    summary,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    occurred_at: text(input.occurred_at) || timestamp,
    validation_error: "",
    createdAt: text(input.createdAt) || timestamp,
    updatedAt: timestamp,
  };
  taskEvents(state).push(event);
  return event;
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
  const task = {
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
    defer_reason: text(input.defer_reason),
    dedupe_key: text(input.dedupe_key),
    generated: flag(input.generated),
    validation_error: "",
    version: Math.max(1, Number(input.version) || 1),
    createdAt: text(input.createdAt) || timestamp,
    updatedAt: text(input.updatedAt) || timestamp,
  };
  if (!input.skip_created_event) {
    appendTaskEvent(state, task, {
      type: "created",
      actor_id: text(input.actor_id),
      actor_name: text(input.actor_name) || (flag(input.generated) ? "系统规则" : "当前用户"),
      summary: flag(input.generated) ? "系统规则生成行动任务。" : "已创建行动任务。",
      metadata: {
        source: task.source,
        type: task.type,
        due_at: task.due_at,
        owner_id: task.owner_id,
        owner_name: task.owner_name,
      },
    }, timestamp);
  }
  return task;
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
  appendTaskEvent(state, task, {
    type: "complete",
    summary: `已完成：${completionEvidence}`,
    metadata: { completion_evidence: completionEvidence },
  }, task.completed_at);
  return task;
}

function skipTask(state, taskId, reason = "", now = new Date().toISOString()) {
  const task = taskById(state, taskId);
  if (!task) throw new Error("未找到待办。");
  const validationError = taskValidationError(state, task);
  if (validationError) throw new Error(validationError);
  if (!["待处理", "待修复"].includes(text(task.status))) {
    throw new Error("只有待处理或待修复的行动任务可以跳过。");
  }
  const skipReason = text(reason);
  if (!skipReason) throw new Error("跳过行动任务必须填写原因。");
  const timestamp = iso(now);
  task.status = "已跳过";
  task.completed_at = timestamp;
  task.completion_evidence = skipReason;
  task.validation_error = "";
  task.version = Math.max(1, Number(task.version) || 1) + 1;
  task.updatedAt = timestamp;
  appendTaskEvent(state, task, {
    type: "skip",
    summary: `已跳过：${skipReason}`,
    metadata: { reason: skipReason },
  }, timestamp);
  return task;
}

function deferTask(state, taskId, dueAt, reason = "", now = new Date().toISOString()) {
  const task = taskById(state, taskId);
  if (!task) throw new Error("未找到待办。");
  const validationError = taskValidationError(state, task);
  if (validationError) throw new Error(validationError);
  if (text(task.status) !== "待处理") {
    throw new Error("只有待处理的行动任务可以延期。");
  }
  const parsedDueAt = new Date(text(dueAt));
  const parsedNow = new Date(iso(now));
  if (Number.isNaN(parsedDueAt.getTime()) || parsedDueAt.getTime() <= parsedNow.getTime()) {
    throw new Error("延期时间必须晚于当前时间。");
  }
  const deferReason = text(reason);
  if (!deferReason) throw new Error("延期行动任务必须填写原因。");
  const previousDueAt = text(task.due_at);
  task.due_at = parsedDueAt.toISOString();
  task.defer_reason = deferReason;
  task.version = Math.max(1, Number(task.version) || 1) + 1;
  task.updatedAt = iso(now);
  appendTaskEvent(state, task, {
    type: "defer",
    summary: `延期至 ${task.due_at}：${deferReason}`,
    metadata: {
      previous_due_at: previousDueAt,
      due_at: task.due_at,
      reason: deferReason,
    },
  }, task.updatedAt);
  return task;
}

function assignTask(state, taskId, assignment = {}, now = new Date().toISOString()) {
  const task = taskById(state, taskId);
  if (!task) throw new Error("未找到待办。");
  const validationError = taskValidationError(state, task);
  if (validationError) throw new Error(validationError);
  if (!["待处理", "待修复"].includes(text(task.status))) {
    throw new Error("只有待处理或待修复的行动任务可以调整负责人。");
  }
  const previousOwnerId = text(task.owner_id);
  const previousOwnerName = text(task.owner_name);
  const ownerId = text(assignment.owner_id);
  const ownerName = text(assignment.owner_name);
  if (previousOwnerId === ownerId && previousOwnerName === ownerName) {
    throw new Error("负责人没有变化。");
  }
  const timestamp = iso(now);
  task.owner_id = ownerId;
  task.owner_name = ownerName;
  task.version = Math.max(1, Number(task.version) || 1) + 1;
  task.updatedAt = timestamp;
  appendTaskEvent(state, task, {
    type: "assignment",
    actor_id: text(assignment.actor_id),
    actor_name: text(assignment.actor_name),
    summary: ownerName ? `已指派给 ${ownerName}。` : "已取消负责人指派。",
    metadata: {
      previous_owner_id: previousOwnerId,
      previous_owner_name: previousOwnerName,
      owner_id: ownerId,
      owner_name: ownerName,
    },
  }, timestamp);
  return task;
}

function addTaskNote(state, taskId, note = "", actor = {}, now = new Date().toISOString()) {
  const task = taskById(state, taskId);
  if (!task) throw new Error("未找到待办。");
  const validationError = taskValidationError(state, task);
  if (validationError) throw new Error(validationError);
  const content = text(note);
  if (!content) throw new Error("任务备注不能为空。");
  const timestamp = iso(now);
  task.version = Math.max(1, Number(task.version) || 1) + 1;
  task.updatedAt = timestamp;
  appendTaskEvent(state, task, {
    type: "note",
    actor_id: text(actor.actor_id),
    actor_name: text(actor.actor_name),
    summary: content,
    metadata: { note: content },
  }, timestamp);
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
  AI_HIGH_RISK_CASE_STAGES,
  CASE_STAGES,
  CASE_STAGE_TRANSITIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_EVENT_TYPES,
  addTaskNote,
  archiveTriageMail,
  applyAiSuggestedCaseStage,
  assignTask,
  appendTaskEvent,
  canTransitionCaseStage,
  completeTask,
  createActionTask,
  createCase,
  createTriageLead,
  createTriageCase,
  deferTask,
  ignoreTriageMail,
  patchVersionedRecord,
  recordCaseStageChange,
  reconcileCaseTasks,
  skipTask,
  taskEventsForTask,
  taskKey,
  triageLeadDuplicateSuggestions,
  triageCandidateCases,
};
