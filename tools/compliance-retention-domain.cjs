const { createHash } = require("node:crypto");

const RETENTION_SCOPES = new Set(["email_bodies", "contact_identity"]);
const MAIL_COLLECTIONS = ["followUpEvents", "mailInbox"];

function text(value) {
  return String(value ?? "").trim();
}

function emailsIn(value) {
  return [...new Set(
    text(value)
      .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
      ?.map((email) => email.toLowerCase()) || [],
  )];
}

function bool(value) {
  return value === true || ["1", "true", "yes", "是"].includes(text(value).toLowerCase());
}

function normalizeRetentionPolicy(input = {}) {
  const rawScopes = Array.isArray(input.scopes)
    ? input.scopes
    : text(input.scope).split(/[,\s+]+/).filter(Boolean);
  const scopes = [...new Set(rawScopes.map(text).filter((scope) => RETENTION_SCOPES.has(scope)))];
  const policy = {
    brandId: text(input.brandId || input.brand_id),
    contactId: text(input.contactId || input.contact_id),
    scopes,
    actorId: text(input.actorId || input.actor_id),
    actorName: text(input.actorName || input.actor_name),
    source: text(input.source) || "manual_compliance",
    reason: text(input.reason),
    requestId: text(input.requestId || input.request_id),
    dryRun: bool(input.dryRun),
  };
  if (!policy.brandId) throw new Error("合规删除必须指定品牌范围。");
  if (!policy.scopes.length) throw new Error("至少选择一项数据范围：邮件正文或联系人身份。");
  if (!policy.reason) throw new Error("合规删除必须填写原因。");
  if (policy.reason.length > 500) throw new Error("合规删除原因不能超过 500 个字符。");
  if (!policy.actorId && !policy.actorName) throw new Error("合规删除必须填写操作者。");
  return policy;
}

function brandMatches(row, brandId) {
  return text(row?.brand_id) === text(brandId);
}

function personMatchesContact(row, contact, contactEmails) {
  if (text(row?.matched_contact_id) === text(contact.id) || text(row?.contact_id) === text(contact.id)) return true;
  const addresses = new Set([
    ...emailsIn(row?.sender),
    ...emailsIn(row?.recipients),
  ]);
  return [...contactEmails].some((email) => addresses.has(email));
}

function rowsForScope(state, policy, contact) {
  const contactEmails = new Set(emailsIn(contact?.email));
  const filter = (row) => brandMatches(row, policy.brandId) &&
    (!contact || personMatchesContact(row, contact, contactEmails));
  return {
    followUpEvents: (Array.isArray(state?.followUpEvents) ? state.followUpEvents : []).filter(filter),
    mailInbox: (Array.isArray(state?.mailInbox) ? state.mailInbox : []).filter(filter),
  };
}

function previewRetention(state, input, now = new Date()) {
  const policy = normalizeRetentionPolicy(input);
  const brands = Array.isArray(state?.brands) ? state.brands : [];
  const brand = brands.find((row) => text(row.id) === policy.brandId);
  if (!brand) throw new Error("指定品牌不存在，已拒绝执行。");

  const contacts = (Array.isArray(state?.contacts) ? state.contacts : [])
    .filter((row) => brandMatches(row, policy.brandId) && (!policy.contactId || text(row.id) === policy.contactId));
  if (policy.contactId && !contacts.length) throw new Error("指定联系人不存在或不属于当前品牌。");
  const contact = contacts[0] || null;
  const rows = rowsForScope(state, policy, contact);
  const bodyRows = [...rows.followUpEvents, ...rows.mailInbox]
    .filter((row) => text(row.body));
  const activeContacts = contacts.filter((row) => !text(row.deleted_at) && !bool(row.is_deleted));
  const deletedContacts = contacts.filter((row) => text(row.deleted_at) || bool(row.is_deleted));
  return {
    policy,
    brand: { id: text(brand.id), name: text(brand.name || brand.brand) },
    contact: contact
      ? {
          id: text(contact.id),
          name: text(contact.name),
          email: text(contact.email),
          alreadyDeleted: Boolean(deletedContacts.length),
        }
      : null,
    counts: {
      followUpEvents: rows.followUpEvents.length,
      mailInbox: rows.mailInbox.length,
      emailBodies: bodyRows.length,
      activeContacts: activeContacts.length,
      alreadyDeletedContacts: deletedContacts.length,
    },
    protected: [
      "不会删除 followUpEvents/mailInbox 邮件记录、摘要、Message-ID、线程和路由证据。",
      "不会删除 Case、合作记录、达人或待开发达人。",
      "不会清除联系人退订、黑名单和投递失败证据；联系人仅做软删除。",
    ],
    generatedAt: now.toISOString(),
  };
}

function auditId(policy, now) {
  const digest = createHash("sha1")
    .update(`${policy.requestId}|${policy.brandId}|${policy.contactId}|${policy.scopes.join(",")}|${policy.reason}`, "utf8")
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return `COMPLIANCE-${digest}-${now.getTime()}`;
}

function applyRetention(state, input, now = new Date()) {
  const policy = normalizeRetentionPolicy(input);
  const existingAudit = (Array.isArray(state?.complianceAudit) ? state.complianceAudit : [])
    .find((row) => policy.requestId && text(row.request_id) === policy.requestId);
  if (existingAudit) {
    return {
      state,
      audit: existingAudit,
      preview: previewRetention(state, policy, now),
      idempotent: true,
    };
  }

  const preview = previewRetention(state, policy, now);
  if (policy.dryRun) return { state, audit: null, preview, idempotent: false };

  const nextState = {
    ...state,
    followUpEvents: Array.isArray(state.followUpEvents) ? state.followUpEvents.map((row) => ({ ...row })) : [],
    mailInbox: Array.isArray(state.mailInbox) ? state.mailInbox.map((row) => ({ ...row })) : [],
    contacts: Array.isArray(state.contacts) ? state.contacts.map((row) => ({ ...row })) : [],
    complianceAudit: Array.isArray(state.complianceAudit) ? state.complianceAudit.map((row) => ({ ...row })) : [],
  };
  const rows = rowsForScope(nextState, policy, preview.contact ? nextState.contacts.find((row) => text(row.id) === preview.contact.id) : null);
  let clearedBodies = 0;
  if (policy.scopes.includes("email_bodies")) {
    const clearBody = (row) => {
      if (!text(row.body)) return row;
      clearedBodies += 1;
      return {
        ...row,
        body: "",
        body_cached_at: "",
        body_retention_until: "",
        body_truncated: false,
        body_expired_at: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    };
    const selectedIds = new Set(rows.followUpEvents.map((row) => text(row.id)));
    nextState.followUpEvents = nextState.followUpEvents.map((row) => selectedIds.has(text(row.id)) ? clearBody(row) : row);
    const inboxIds = new Set(rows.mailInbox.map((row) => text(row.id)));
    nextState.mailInbox = nextState.mailInbox.map((row) => inboxIds.has(text(row.id)) ? clearBody(row) : row);
  }

  let softDeletedContacts = 0;
  if (policy.scopes.includes("contact_identity")) {
    nextState.contacts = nextState.contacts.map((row) => {
      if (!brandMatches(row, policy.brandId) || (policy.contactId && text(row.id) !== policy.contactId)) return row;
      if (text(row.deleted_at) || bool(row.is_deleted)) return row;
      softDeletedContacts += 1;
      return {
        ...row,
        is_deleted: true,
        deleted_at: now.toISOString(),
        deleted_by: policy.actorId || policy.actorName,
        deletion_reason: policy.reason,
        deletion_source: policy.source,
        updatedAt: now.toISOString(),
      };
    });
  }

  const audit = {
    id: auditId(policy, now),
    action: "retention_apply",
    brand_id: policy.brandId,
    contact_id: policy.contactId,
    scopes: policy.scopes,
    request_id: policy.requestId,
    actor_id: policy.actorId,
    actor_name: policy.actorName,
    source: policy.source,
    reason: policy.reason,
    affected_email_bodies: clearedBodies,
    affected_follow_up_events: rows.followUpEvents.length,
    affected_mail_inbox: rows.mailInbox.length,
    affected_contacts: softDeletedContacts,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  nextState.complianceAudit.unshift(audit);
  return {
    state: nextState,
    audit,
    preview: previewRetention(nextState, policy, now),
    idempotent: false,
  };
}

module.exports = {
  RETENTION_SCOPES,
  normalizeRetentionPolicy,
  previewRetention,
  applyRetention,
};
