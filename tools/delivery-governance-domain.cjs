const DELIVERY_STATUSES = new Set([
  "unknown",
  "accepted",
  "delivered",
  "bounced",
  "failed",
  "unsubscribed",
  "blacklisted",
]);

const DELIVERY_SOURCES = new Set(["smtp", "imap_dsn", "manual", "provider"]);

const DEFAULT_DELIVERY_POLICY = {
  enabled: true,
  windowDays: 7,
  maxOutbound: 3,
  blockInvalid: true,
};

function text(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function normalizeMessageId(value) {
  return text(value).replace(/[<>]/g, "").toLowerCase();
}

function emailsIn(value) {
  return [...new Set(
    String(value || "")
      .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
      ?.map(normalizeEmail) || [],
  )];
}

function parseFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "是", "有"].includes(text(value).toLowerCase());
}

function normalizeDeliveryStatus(value) {
  const status = text(value).toLowerCase();
  return DELIVERY_STATUSES.has(status) ? status : "unknown";
}

function normalizeDeliverySource(value) {
  const source = text(value).toLowerCase();
  return DELIVERY_SOURCES.has(source) ? source : "";
}

function deliveryPolicy(settings = {}) {
  const source = settings?.deliveryPolicy && typeof settings.deliveryPolicy === "object"
    ? settings.deliveryPolicy
    : {};
  const windowDays = Number(source.windowDays);
  const maxOutbound = Number(source.maxOutbound);
  return {
    ...DEFAULT_DELIVERY_POLICY,
    enabled: source.enabled === undefined ? true : parseFlag(source.enabled),
    windowDays: Number.isFinite(windowDays)
      ? Math.min(90, Math.max(1, Math.round(windowDays)))
      : DEFAULT_DELIVERY_POLICY.windowDays,
    maxOutbound: Number.isFinite(maxOutbound)
      ? Math.min(50, Math.max(1, Math.round(maxOutbound)))
      : DEFAULT_DELIVERY_POLICY.maxOutbound,
    blockInvalid: source.blockInvalid === undefined ? true : parseFlag(source.blockInvalid),
  };
}

function governanceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.governance = { code, ...details };
  return error;
}

function isOutboundEvent(event = {}) {
  return ["outbound", "sent"].includes(text(event.direction).toLowerCase()) &&
    ["mail_sent", "email"].includes(text(event.type).toLowerCase());
}

function outboundEventsFor(state, { brandId = "", personType = "", personId = "", contactId = "" } = {}) {
  return (Array.isArray(state?.followUpEvents) ? state.followUpEvents : [])
    .filter((event) => {
      if (!isOutboundEvent(event)) return false;
      if (brandId && text(event.brand_id) !== text(brandId)) return false;
      if (personType && text(event.person_type) !== text(personType)) return false;
      if (personId && text(event.person_id) !== text(personId)) return false;
      if (contactId && text(event.contact_id) !== text(contactId)) return false;
      return true;
    });
}

function evaluateSendPolicy({
  state,
  settings,
  brandId,
  personType,
  personId,
  contact,
  now = new Date(),
  recipientEmails = [],
} = {}) {
  const policy = deliveryPolicy(settings);
  if (!policy.enabled) return { allowed: true, policy, recentOutboundCount: 0 };

  const targetEmails = new Set([
    ...emailsIn(contact?.email),
    ...recipientEmails.flatMap(emailsIn),
  ]);
  if (contact?.unsubscribed || normalizeDeliveryStatus(contact?.delivery_status) === "unsubscribed") {
    throw governanceError("contact_unsubscribed", "该联系人已退订，禁止发送邮件。", {
      brandId: text(brandId),
      contactId: text(contact?.id),
    });
  }
  if (parseFlag(contact?.blacklisted) || normalizeDeliveryStatus(contact?.delivery_status) === "blacklisted") {
    throw governanceError("contact_blacklisted", "该联系人已列入黑名单，禁止发送邮件。", {
      brandId: text(brandId),
      contactId: text(contact?.id),
      reason: text(contact?.blacklist_reason),
    });
  }
  if (policy.blockInvalid &&
      (text(contact?.validity) === "invalid" || normalizeDeliveryStatus(contact?.delivery_status) === "bounced")) {
    throw governanceError("contact_invalid", "该联系人邮箱已标记为无效或退信，禁止发送邮件。", {
      brandId: text(brandId),
      contactId: text(contact?.id),
    });
  }

  const cutoff = now.getTime() - policy.windowDays * 24 * 60 * 60 * 1000;
  const recentOutbound = outboundEventsFor(state, { brandId, personType, personId, contactId: text(contact?.id) })
    .filter((event) => {
      const timestamp = new Date(event.occurred_at || event.createdAt || "").getTime();
      if (!Number.isFinite(timestamp) || timestamp < cutoff) return false;
      if (targetEmails.size && !emailsIn(event.recipients).some((email) => targetEmails.has(email))) return false;
      return true;
    });
  if (recentOutbound.length >= policy.maxOutbound) {
    throw governanceError(
      "outreach_frequency_limited",
      `触达频率受限：近 ${policy.windowDays} 天已向该联系人发送 ${recentOutbound.length} 次，当前上限为 ${policy.maxOutbound} 次。`,
      {
        brandId: text(brandId),
        contactId: text(contact?.id),
        windowDays: policy.windowDays,
        maxOutbound: policy.maxOutbound,
        recentOutboundCount: recentOutbound.length,
      },
    );
  }
  return { allowed: true, policy, recentOutboundCount: recentOutbound.length };
}

function classifyDeliveryNotification(record = {}) {
  const subject = text(record.subject);
  const sender = text(record.sender);
  const body = text(record.body || record.excerpt);
  const source = `${subject}\n${sender}\n${body}`.toLowerCase();
  const dsnSignals = [
    /mailer-daemon/,
    /mail delivery subsystem/,
    /delivery status notification/,
    /undeliverable/,
    /delivery failure/,
    /returned mail/,
    /failure notice/,
    /退信/,
    /投递失败/,
    /无法投递/,
  ];
  if (!dsnSignals.some((pattern) => pattern.test(source))) {
    return { isDeliveryNotification: false };
  }
  const permanent = [
    /user unknown/,
    /mailbox unavailable/,
    /address rejected/,
    /does not exist/,
    /no such user/,
    /550\b/,
    /551\b/,
    /552\b/,
    /553\b/,
    /554\b/,
    /不存在/,
    /地址被拒绝/,
  ].some((pattern) => pattern.test(source));
  const code = source.match(/\b([245]\d{2})\b/)?.[1] || "";
  const failedRecipient = emailsIn(body).find((email) => !/mailer-daemon|postmaster/.test(email)) || "";
  return {
    isDeliveryNotification: true,
    status: permanent ? "bounced" : "failed",
    error: subject || "邮箱投递失败通知",
    code,
    failedRecipient,
    source: "imap_dsn",
  };
}

function notificationMessageIds(record = {}) {
  return new Set([
    normalizeMessageId(record.in_reply_to),
    ...(Array.isArray(record.references) ? record.references : [record.references]).flatMap((value) =>
      text(value).split(/[,\s]+/).map(normalizeMessageId).filter(Boolean),
    ),
  ].filter(Boolean));
}

function findDeliveryTarget(state, record, notification) {
  const ids = notificationMessageIds(record);
  const recipient = normalizeEmail(notification.failedRecipient);
  const candidates = (Array.isArray(state?.followUpEvents) ? state.followUpEvents : [])
    .filter((event) =>
      isOutboundEvent(event) &&
      (!text(event.mailbox_account_id) || text(event.mailbox_account_id) === text(record.mailbox_account_id)) &&
      (!text(event.brand_id) || !text(record.brand_id) || text(event.brand_id) === text(record.brand_id)),
    );
  const byReference = candidates.find((event) => ids.has(normalizeMessageId(event.message_id)));
  if (byReference) return byReference;
  if (!recipient) return null;
  const recipientCandidates = candidates
    .filter((event) => emailsIn(event.recipients).includes(recipient))
    .sort((left, right) => new Date(right.occurred_at || right.createdAt || 0) - new Date(left.occurred_at || left.createdAt || 0));
  const brands = new Set(recipientCandidates.map((event) => text(event.brand_id)).filter(Boolean));
  return brands.size <= 1 ? recipientCandidates[0] || null : null;
}

function applyDeliveryNotification(state, record, now = new Date().toISOString()) {
  const notification = classifyDeliveryNotification(record);
  if (!notification.isDeliveryNotification) return { handled: false, notification };
  const target = findDeliveryTarget(state, record, notification);
  if (!target) {
    return {
      handled: true,
      matched: false,
      notification,
      record: {
        ...record,
        delivery_status: notification.status,
        delivery_error: notification.error,
        delivery_code: notification.code,
        delivery_source: notification.source,
        delivery_event_at: now,
        delivery_message_id: "",
        delivery_match_status: "unmatched",
      },
    };
  }
  target.delivery_status = notification.status;
  target.delivery_error = notification.error;
  target.delivery_code = notification.code;
  target.delivery_source = notification.source;
  target.delivery_event_at = now;
  target.delivery_message_id = text(record.message_id);
  target.updatedAt = now;
  const contact = (Array.isArray(state?.contacts) ? state.contacts : [])
    .find((item) => text(item.id) === text(target.contact_id));
  if (contact) {
    contact.delivery_status = notification.status;
    contact.last_delivery_event_at = now;
    contact.last_delivery_error = notification.error;
    contact.updatedAt = now;
    if (notification.status === "bounced") contact.validity = "invalid";
  }
  return {
    handled: true,
    matched: true,
    targetEventId: text(target.id),
    notification,
    record: {
      ...record,
      brand_id: text(target.brand_id || record.brand_id),
      delivery_status: notification.status,
      delivery_error: notification.error,
      delivery_code: notification.code,
      delivery_source: notification.source,
      delivery_event_at: now,
      delivery_message_id: text(target.message_id),
      delivery_match_status: "matched",
      delivery_target_event_id: text(target.id),
    },
  };
}

function markContactUnsubscribed(contact, now = new Date().toISOString(), reason = "人工标记退订") {
  if (!contact || typeof contact !== "object") return null;
  contact.unsubscribed = true;
  contact.unsubscribed_at = text(contact.unsubscribed_at) || now;
  contact.delivery_status = "unsubscribed";
  contact.last_delivery_event_at = now;
  contact.last_delivery_error = text(reason);
  contact.updatedAt = now;
  return contact;
}

function markContactBlacklisted(contact, reason = "人工标记黑名单", now = new Date().toISOString()) {
  if (!contact || typeof contact !== "object") return null;
  contact.blacklisted = true;
  contact.blacklist_reason = text(reason);
  contact.blacklisted_at = now;
  contact.delivery_status = "blacklisted";
  contact.last_delivery_event_at = now;
  contact.last_delivery_error = text(reason);
  contact.updatedAt = now;
  return contact;
}

module.exports = {
  DELIVERY_STATUSES,
  DELIVERY_SOURCES,
  DEFAULT_DELIVERY_POLICY,
  text,
  emailsIn,
  normalizeMessageId,
  normalizeDeliveryStatus,
  normalizeDeliverySource,
  deliveryPolicy,
  governanceError,
  outboundEventsFor,
  evaluateSendPolicy,
  classifyDeliveryNotification,
  applyDeliveryNotification,
  markContactUnsubscribed,
  markContactBlacklisted,
};
