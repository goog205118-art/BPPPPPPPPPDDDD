const {
  contactIdentityForEmail,
  personEmailAddresses,
} = require("./contact-domain.cjs");

const TERMINAL_STAGES = new Set(["已结案", "合作终止", "暂停跟进", "未谈妥"]);
const MIN_CONFIDENT_SCORE = 50;
const AMBIGUITY_DELTA = 15;
const REPLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function text(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function emailsIn(value) {
  return [...new Set(String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.map(normalizeEmail) || [])];
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function accountBrandIds(account = {}) {
  const ids = Array.isArray(account.brand_ids)
    ? account.brand_ids
    : typeof account.brand_ids === "string"
      ? account.brand_ids.split(/[,;；\n]/)
      : [];
  const legacy = text(account.brand_id);
  return unique(legacy ? [legacy, ...ids] : ids);
}

function normalizeMessageId(value) {
  return text(value).replace(/[<>]/g, "").trim();
}

function messageReferences(value) {
  if (Array.isArray(value)) return unique(value.flatMap((item) => messageReferences(item)));
  const raw = String(value || "").trim();
  if (!raw) return [];
  const bracketed = [...raw.matchAll(/<([^>]+)>/g)].map((match) => normalizeMessageId(match[1]));
  const plain = raw.replace(/<[^>]+>/g, " ").split(/\s+/).map(normalizeMessageId);
  return unique([...bracketed, ...plain]);
}

function timestamp(value) {
  const parsed = new Date(value || "").getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function inReplyWindow(outboundAt, occurredAt) {
  const outbound = timestamp(outboundAt);
  const occurred = timestamp(occurredAt);
  return Number.isFinite(outbound)
    && Number.isFinite(occurred)
    && occurred >= outbound
    && occurred - outbound <= REPLY_WINDOW_MS;
}

function personFor(state, input = {}) {
  const personType = text(input.person_type) === "lead" ? "lead" : "creator";
  const collection = personType === "lead"
    ? state?.leads
    : state?.creators;
  const person = (Array.isArray(collection) ? collection : [])
    .find((row) => text(row.id) === text(input.person_id)) || null;
  return person ? { ...person, person_type: personType } : null;
}

function personForCase(state, caseRow = {}) {
  if (text(caseRow.creator_id)) {
    return personFor(state, { person_type: "creator", person_id: caseRow.creator_id });
  }
  if (text(caseRow.lead_id)) {
    return personFor(state, { person_type: "lead", person_id: caseRow.lead_id });
  }
  return null;
}

function personForFollowUp(state, followUp = {}) {
  if (text(followUp.creator_id)) {
    return personFor(state, { person_type: "creator", person_id: followUp.creator_id });
  }
  if (text(followUp.lead_id)) {
    return personFor(state, { person_type: "lead", person_id: followUp.lead_id });
  }
  return null;
}

function followUpsForPerson(state, person = {}, brandId = "") {
  return (Array.isArray(state?.followUps) ? state.followUps : [])
    .filter((row) => text(row.brand_id) === text(brandId)
      && !TERMINAL_STAGES.has(text(row.stage))
      && (text(person.person_type) === "creator"
        ? text(row.creator_id) === text(person.id)
        : text(row.lead_id) === text(person.id)));
}

function casesForPerson(state, person = {}, brandId = "") {
  return (Array.isArray(state?.cases) ? state.cases : [])
    .filter((row) => text(row.brand_id) === text(brandId)
      && !TERMINAL_STAGES.has(text(row.stage))
      && (text(person.person_type) === "creator"
        ? text(row.creator_id) === text(person.id)
        : text(row.lead_id) === text(person.id)));
}

function targetRows(state, person = {}, brandId = "") {
  const cases = casesForPerson(state, person, brandId);
  const casesById = new Map(cases.map((row) => [text(row.id), row]));
  const followUps = followUpsForPerson(state, person, brandId);
  const targets = [];
  const usedCaseIds = new Set();

  for (const followUp of followUps) {
    const caseRow = casesById.get(text(followUp.case_id)) || null;
    if (caseRow) usedCaseIds.add(text(caseRow.id));
    targets.push({ person, followUp, caseRow });
  }
  for (const caseRow of cases) {
    if (!usedCaseIds.has(text(caseRow.id))) {
      targets.push({ person, followUp: null, caseRow });
    }
  }
  return targets.length ? targets : [{ person, followUp: null, caseRow: null }];
}

function targetKey(target = {}) {
  const person = target.person || {};
  return [
    text(target.brand_id || target.caseRow?.brand_id || target.followUp?.brand_id || person.brand_id),
    text(person.person_type),
    text(person.id),
    text(target.followUp?.id),
    text(target.caseRow?.id),
  ].join("|");
}

function makeCandidate(target = {}) {
  const person = target.person || {};
  return {
    brand_id: text(target.brand_id || target.caseRow?.brand_id || target.followUp?.brand_id || person.brand_id),
    creator_id: text(person.person_type) === "creator" ? text(person.id) : "",
    lead_id: text(person.person_type) === "lead" ? text(person.id) : "",
    follow_up_id: text(target.followUp?.id),
    case_id: text(target.caseRow?.id),
    matched_contact_id: "",
    score: 0,
    evidence: [],
  };
}

function addEvidence(candidateMap, target, evidence) {
  const key = targetKey(target);
  const existing = candidateMap.get(key) || makeCandidate(target);
  const rule = text(evidence?.rule);
  const detail = text(evidence?.detail);
  if (rule && !existing.evidence.some((item) => item.rule === rule && item.detail === detail)) {
    existing.evidence.push({
      rule,
      weight: Number(evidence?.weight) || 0,
      detail,
    });
    existing.score += Number(evidence?.weight) || 0;
  }
  candidateMap.set(key, existing);
}

function recordParticipantEmails(record = {}, direction = "") {
  if (direction === "inbound") return emailsIn(record.sender);
  if (direction === "outbound") return emailsIn(record.recipients);
  return unique([...emailsIn(record.sender), ...emailsIn(record.recipients)]);
}

function directionForPerson(record, person, state = null) {
  const personEmails = new Set(
    state
      ? personEmailAddresses(state, person?.person_type, person, person?.brand_id)
      : emailsIn(person?.email),
  );
  if (!personEmails.size) return "";
  if (emailsIn(record?.sender).some((email) => personEmails.has(email))) return "inbound";
  if (emailsIn(record?.recipients).some((email) => personEmails.has(email))) return "outbound";
  return "";
}

function matchedContactForRecord(state, record, person, direction) {
  const addresses = direction === "inbound"
    ? emailsIn(record?.sender)
    : direction === "outbound"
      ? emailsIn(record?.recipients)
      : unique([...emailsIn(record?.sender), ...emailsIn(record?.recipients)]);
  return addresses
    .map((email) => contactIdentityForEmail(
      state,
      person?.person_type,
      person?.id,
      email,
      person?.brand_id,
    ))
    .find(Boolean) || null;
}

function targetForFollowUp(state, followUp) {
  const person = personForFollowUp(state, followUp);
  if (!person) return null;
  const caseRow = (Array.isArray(state?.cases) ? state.cases : [])
    .find((row) => text(row.id) === text(followUp.case_id)
      && text(row.brand_id) === text(followUp.brand_id)) || null;
  return { person, followUp, caseRow };
}

function targetForCase(state, caseRow) {
  const person = personForCase(state, caseRow);
  if (!person) return null;
  const followUp = (Array.isArray(state?.followUps) ? state.followUps : [])
    .find((row) => text(row.case_id) === text(caseRow.id)
      && text(row.brand_id) === text(caseRow.brand_id)
      && !TERMINAL_STAGES.has(text(row.stage))) || null;
  return { person, followUp, caseRow };
}

function addThreadCandidates(state, record, scope, candidateMap) {
  const threadIds = new Set([
    normalizeMessageId(record.in_reply_to),
    ...messageReferences(record.references),
  ].filter(Boolean));
  if (!threadIds.size) return;

  const followUps = Array.isArray(state?.followUps) ? state.followUps : [];
  const cases = Array.isArray(state?.cases) ? state.cases : [];
  const events = Array.isArray(state?.followUpEvents) ? state.followUpEvents : [];
  for (const event of events) {
    if (!threadIds.has(normalizeMessageId(event.message_id))) continue;
    const followUp = followUps.find((row) => text(row.id) === text(event.follow_up_id)) || null;
    const caseRow = cases.find((row) => text(row.id) === text(event.case_id || followUp?.case_id)) || null;
    const brandId = text(followUp?.brand_id || caseRow?.brand_id || event.brand_id);
    if (!scope.has(brandId)) continue;
    if (text(event.brand_id) && text(followUp?.brand_id) && text(event.brand_id) !== text(followUp.brand_id)) continue;

    const target = followUp
      ? targetForFollowUp(state, followUp)
      : caseRow
        ? targetForCase(state, caseRow)
        : null;
    if (!target || text(target.person.brand_id) !== brandId) continue;
    const direction = directionForPerson(record, target.person, state);
    if (!direction) continue;
    addEvidence(candidateMap, target, {
      rule: "thread_reference",
      weight: 100,
      detail: `Message-ID 线程关联 ${normalizeMessageId(event.message_id)}。`,
    });
  }
}

function addContactTrackCandidates(state, record, account, scope, candidateMap) {
  const direction = text(record.direction);
  if (direction !== "inbound") return;
  const senders = new Set(emailsIn(record.sender));
  if (!senders.size) return;
  const followUps = Array.isArray(state?.followUps) ? state.followUps : [];

  for (const track of Array.isArray(state?.contactTracks) ? state.contactTracks : []) {
    const brandId = text(track.brand_id);
    if (!scope.has(brandId)) continue;
    if (text(track.mailbox_account_id) && text(track.mailbox_account_id) !== text(account.id)) continue;
    if (!["waiting_reply", "replied"].includes(text(track.status))) continue;
    if (!emailsIn(track.email).some((email) => senders.has(email))) continue;

    const person = personFor(state, track);
    if (!person || text(person.brand_id) !== brandId) continue;
    const followUp = followUps.find((row) => text(row.id) === text(track.follow_up_id)
      && text(row.brand_id) === brandId
      && !TERMINAL_STAGES.has(text(row.stage))) || null;
    const caseRow = (Array.isArray(state?.cases) ? state.cases : [])
      .find((row) => text(row.id) === text(followUp?.case_id)
        && text(row.brand_id) === brandId) || null;
    const activeFollowUp = Boolean(followUp);
    if (!activeFollowUp && !inReplyWindow(track.last_outbound_at, record.occurred_at)) continue;
    addEvidence(candidateMap, { person, followUp, caseRow }, {
      rule: activeFollowUp ? "contact_track_active_case" : "contact_track_reply_window",
      weight: activeFollowUp ? 65 : 55,
      detail: activeFollowUp
        ? "命中当前品牌的活跃待回复联系轨迹。"
        : "命中首联后 30 天内的待回复联系轨迹。",
    });
  }
}

function scoreMailRouting(state, record = {}, account = {}) {
  const scopeIds = accountBrandIds(account);
  const scope = new Set(scopeIds);
  const candidateMap = new Map();
  const forcedDirection = text(record.direction);
  const candidatesByPerson = new Map();

  for (const collection of [
    { key: "creators", person_type: "creator" },
    { key: "leads", person_type: "lead" },
  ]) {
    for (const row of Array.isArray(state?.[collection.key]) ? state[collection.key] : []) {
      if (collection.person_type === "lead" && text(row.status) === "已转达人库") continue;
      if (!scope.has(text(row.brand_id))) continue;
      const person = { ...row, person_type: collection.person_type };
      const direction = directionForPerson(record, person, state);
      if (!direction || (forcedDirection && forcedDirection !== direction)) continue;
      candidatesByPerson.set(`${collection.person_type}|${text(row.id)}`, { person, direction });
    }
  }

  for (const { person, direction } of candidatesByPerson.values()) {
    const targets = targetRows(state, person, person.brand_id);
    const matchedContact = matchedContactForRecord(state, record, person, direction);
    for (const target of targets) {
      addEvidence(candidateMap, target, {
        rule: "contact_identity",
        weight: 35,
        detail: `邮件${direction === "inbound" ? "发件人" : "收件人"}命中已登记联系人邮箱。`,
      });
      if (direction === "inbound" && inReplyWindow(person.last_outreach_at, record.occurred_at)) {
        addEvidence(candidateMap, target, {
          rule: "first_outreach_reply_window",
          weight: 25,
          detail: "回信位于达人最近首联/复联后的 30 天窗口内。",
        });
      }
      const candidate = candidateMap.get(targetKey(target));
      if (candidate && matchedContact?.id) candidate.matched_contact_id = matchedContact.id;
      if (target.followUp) {
        addEvidence(candidateMap, target, {
          rule: "active_follow_up",
          weight: 30,
          detail: "联系人关联当前品牌的活跃合作跟进。",
        });
      }
      if (target.caseRow) {
        addEvidence(candidateMap, target, {
          rule: "active_case",
          weight: 20,
          detail: "联系人关联当前品牌的活跃合作 Case。",
        });
      }
    }
  }

  addContactTrackCandidates(state, record, account, scope, candidateMap);
  addThreadCandidates(state, record, scope, candidateMap);

  const candidates = [...candidateMap.values()]
    .map((candidate) => ({
      ...candidate,
      evidence: candidate.evidence.slice().sort((left, right) => right.weight - left.weight),
    }))
    .sort((left, right) => right.score - left.score
      || left.brand_id.localeCompare(right.brand_id)
      || left.case_id.localeCompare(right.case_id)
      || left.follow_up_id.localeCompare(right.follow_up_id)
      || left.creator_id.localeCompare(right.creator_id)
      || left.lead_id.localeCompare(right.lead_id));
  const top = candidates[0] || null;
  const second = candidates[1] || null;
  const closeToTop = top && second && top.score - second.score < AMBIGUITY_DELTA;
  const disposition = !top || top.score < MIN_CONFIDENT_SCORE
    ? "unmatched"
    : closeToTop
      ? "ambiguous"
      : "unique";
  const selected = disposition === "unique" ? top : null;
  const candidateBrandIds = unique(candidates.map((candidate) => candidate.brand_id));
  const resolvedBrandId = selected?.brand_id
    || (candidateBrandIds.length === 1 ? candidateBrandIds[0] : "");
  const reasons = !top
    ? ["邮件未命中当前邮箱账号范围内的已登记联系人或线程。"]
    : disposition === "ambiguous"
      ? ["最高分候选与其他候选分差不足，必须人工确认归属。"]
      : disposition === "unmatched"
        ? ["存在弱联系人线索，但证据不足以自动归档。"]
        : ["最高分候选满足自动归档前的唯一匹配阈值。"];

  return {
    disposition,
    brand_id: resolvedBrandId,
    creator_id: selected?.creator_id || "",
    lead_id: selected?.lead_id || "",
    matched_contact_id: selected?.matched_contact_id || "",
    follow_up_id: selected?.follow_up_id || "",
    case_id: selected?.case_id || "",
    score: selected?.score || top?.score || 0,
    candidate_brand_ids: candidateBrandIds.length ? candidateBrandIds : scopeIds,
    candidate_creator_ids: unique(candidates.map((candidate) => candidate.creator_id)),
    candidate_lead_ids: unique(candidates.map((candidate) => candidate.lead_id)),
    candidate_follow_up_ids: unique(candidates.map((candidate) => candidate.follow_up_id)),
    candidate_case_ids: unique(candidates.map((candidate) => candidate.case_id)),
    candidates,
    reasons,
  };
}

module.exports = {
  scoreMailRouting,
  accountBrandIds,
  emailsIn,
  messageReferences,
  normalizeMessageId,
};
