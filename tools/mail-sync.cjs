const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");

const DEFAULT_MAIL_ACCOUNT = {
  id: "",
  brand_id: "",
  brand_name: "",
  brand_ids: [],
  enabled: false,
  label: "官方邮箱",
  fromName: "",
  imap: {
    host: "",
    port: 993,
    secure: true,
    user: "",
    passwordEncrypted: "",
    inboxFolder: "INBOX",
    sentFolder: "Sent",
    syncDays: 30,
  },
  smtp: {
    enabled: true,
    host: "",
    port: 465,
    secure: true,
    user: "",
    passwordEncrypted: "",
    useImapPassword: true,
  },
  lastSyncAt: "",
  lastSyncStatus: "",
  lastSyncSummary: null,
  createdAt: "",
  updatedAt: "",
};
const DEFAULT_MAIL_SETTINGS = {
  accounts: [],
  contentPolicy: {
    cacheBodies: false,
    allowAiContext: false,
    retentionDays: 90,
  },
};
const REPLY_WINDOW_DAYS = 30;
const REPLY_WINDOW_MS = REPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function text(value) {
  return String(value ?? "").trim();
}

function clampNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function normalizeContentPolicy(input = {}, previous = {}) {
  const source = input && typeof input === "object" ? input : {};
  const old = previous && typeof previous === "object" ? previous : {};
  const cacheBodies = source.cacheBodies === undefined ? Boolean(old.cacheBodies) : Boolean(source.cacheBodies);
  return {
    ...DEFAULT_MAIL_SETTINGS.contentPolicy,
    cacheBodies,
    allowAiContext: cacheBodies && (source.allowAiContext === undefined ? Boolean(old.allowAiContext) : Boolean(source.allowAiContext)),
    retentionDays: clampNumber(
      source.retentionDays ?? old.retentionDays,
      DEFAULT_MAIL_SETTINGS.contentPolicy.retentionDays,
      1,
      365,
    ),
  };
}

function mailContentPolicy(settings = {}) {
  return normalizeContentPolicy(settings?.contentPolicy, DEFAULT_MAIL_SETTINGS.contentPolicy);
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function uniqueTextList(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;；\n]/) : [];
  return [...new Set(values.map(text).filter(Boolean))];
}

function accountBrandIds(account = {}) {
  const ids = uniqueTextList(account.brand_ids);
  const legacy = text(account.brand_id);
  return legacy && !ids.includes(legacy) ? [legacy, ...ids] : ids;
}

function emailsIn(value) {
  return [...new Set(String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.map(normalizeEmail) || [])];
}

function dateTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function isWithinReplyWindow(lastOutboundAt, inboundOccurredAt) {
  const outbound = dateTimestamp(lastOutboundAt);
  const inbound = dateTimestamp(inboundOccurredAt);
  return Number.isFinite(outbound) &&
    Number.isFinite(inbound) &&
    inbound >= outbound &&
    inbound - outbound <= REPLY_WINDOW_MS;
}

function credentialKey(keyMaterial) {
  const material = text(keyMaterial);
  if (!material) throw new Error("邮箱凭据加密密钥未配置。请设置 WORKBENCH_CREDENTIAL_ENCRYPTION_KEY 后重试。");
  return createHash("sha256").update(material, "utf8").digest();
}

function encryptSecret(value, keyMaterial) {
  const plainText = text(value);
  if (!plainText) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(keyMaterial), iv);
  const content = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${content.toString("base64url")}`;
}

function decryptSecret(value, keyMaterial) {
  const parts = text(value).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("已保存的邮箱凭据无法读取，请重新填写邮箱授权码。");
  try {
    const decipher = createDecipheriv("aes-256-gcm", credentialKey(keyMaterial), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("已保存的邮箱凭据无法读取，请重新填写邮箱授权码。");
  }
}

function makeAccountId() {
  return `MAIL-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function legacyAccountToModern(account = {}, settings = {}) {
  const source = account && typeof account === "object" ? account : {};
  if (!Object.keys(source).length) return null;
  return {
    ...DEFAULT_MAIL_ACCOUNT,
    id: text(source.id) || makeAccountId(),
    enabled: Boolean(source.enabled),
    label: text(source.label || "官邮 IMAP").slice(0, 80),
    fromName: text(source.fromName).slice(0, 120),
    brand_id: text(source.brand_id),
    brand_name: text(source.brand_name),
    brand_ids: uniqueTextList(source.brand_ids || source.brand_id),
    imap: {
      ...DEFAULT_MAIL_ACCOUNT.imap,
      host: text(source.host).replace(/^imap:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(source.port, DEFAULT_MAIL_ACCOUNT.imap.port, 1, 65535),
      secure: source.secure !== false,
      user: text(source.user).slice(0, 320),
      passwordEncrypted: text(source.passwordEncrypted),
      inboxFolder: text(source.inboxFolder || "INBOX").slice(0, 160),
      sentFolder: text(source.sentFolder || "Sent").slice(0, 160),
      syncDays: clampNumber(source.syncDays, DEFAULT_MAIL_ACCOUNT.imap.syncDays, 1, 90),
    },
    smtp: {
      ...DEFAULT_MAIL_ACCOUNT.smtp,
      host: text(source.smtpHost || ""),
      port: clampNumber(source.smtpPort, DEFAULT_MAIL_ACCOUNT.smtp.port, 1, 65535),
      secure: source.smtpSecure !== false,
      user: text(source.smtpUser || ""),
      passwordEncrypted: text(source.smtpPasswordEncrypted || ""),
      useImapPassword: source.smtpUseImapPassword !== false,
    },
    lastSyncAt: text(source.lastSyncAt || settings.lastSyncAt),
    lastSyncStatus: text(source.lastSyncStatus || settings.lastSyncStatus),
    lastSyncSummary: source.lastSyncSummary || settings.lastSyncSummary || null,
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
  };
}

function existingAccounts(settings = {}) {
  if (Array.isArray(settings?.accounts)) return settings.accounts;
  const legacy = legacyAccountToModern(settings?.account, settings);
  return legacy ? [legacy] : [];
}

function normalizeAccount(input = {}, previous = {}, keyMaterial) {
  const source = input && typeof input === "object" ? input : {};
  const old = previous && typeof previous === "object" ? previous : {};
  const oldImap = old.imap && typeof old.imap === "object" ? old.imap : legacyAccountToModern(old)?.imap || {};
  const oldSmtp = old.smtp && typeof old.smtp === "object" ? old.smtp : {};
  const imapInput = source.imap && typeof source.imap === "object" ? source.imap : source;
  const smtpInput = source.smtp && typeof source.smtp === "object" ? source.smtp : {};
  const imapPassword = text(imapInput.password);
  const smtpPassword = text(smtpInput.password);
  const now = new Date().toISOString();

  return {
    ...DEFAULT_MAIL_ACCOUNT,
    ...old,
    id: text(source.id || old.id) || makeAccountId(),
    brand_ids: uniqueTextList(source.brand_ids ?? old.brand_ids ?? source.brand_id ?? old.brand_id),
    brand_id: "",
    brand_name: text(source.brand_name ?? old.brand_name).slice(0, 120),
    enabled: source.enabled === undefined ? Boolean(old.enabled) : Boolean(source.enabled),
    label: text(source.label || old.label || DEFAULT_MAIL_ACCOUNT.label).slice(0, 80),
    fromName: text(source.fromName ?? old.fromName).slice(0, 120),
    imap: {
      ...DEFAULT_MAIL_ACCOUNT.imap,
      ...oldImap,
      host: text(imapInput.host ?? oldImap.host).replace(/^imap:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(imapInput.port ?? oldImap.port, DEFAULT_MAIL_ACCOUNT.imap.port, 1, 65535),
      secure: imapInput.secure === undefined ? oldImap.secure !== false : Boolean(imapInput.secure),
      user: text(imapInput.user ?? oldImap.user).slice(0, 320),
      passwordEncrypted: imapPassword
        ? encryptSecret(imapPassword, keyMaterial)
        : imapInput.clearPassword === true
          ? ""
          : text(oldImap.passwordEncrypted),
      inboxFolder: text(imapInput.inboxFolder ?? oldImap.inboxFolder ?? "INBOX").slice(0, 160),
      sentFolder: text(imapInput.sentFolder ?? oldImap.sentFolder ?? "Sent").slice(0, 160),
      syncDays: clampNumber(imapInput.syncDays ?? oldImap.syncDays, DEFAULT_MAIL_ACCOUNT.imap.syncDays, 1, 90),
    },
    smtp: {
      ...DEFAULT_MAIL_ACCOUNT.smtp,
      ...oldSmtp,
      enabled: smtpInput.enabled === undefined ? oldSmtp.enabled !== false : Boolean(smtpInput.enabled),
      host: text(smtpInput.host ?? oldSmtp.host).replace(/^smtps?:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(smtpInput.port ?? oldSmtp.port, DEFAULT_MAIL_ACCOUNT.smtp.port, 1, 65535),
      secure: smtpInput.secure === undefined ? oldSmtp.secure !== false : Boolean(smtpInput.secure),
      user: text(smtpInput.user ?? oldSmtp.user).slice(0, 320),
      passwordEncrypted: smtpPassword
        ? encryptSecret(smtpPassword, keyMaterial)
        : smtpInput.clearPassword === true
          ? ""
          : text(oldSmtp.passwordEncrypted),
      useImapPassword: smtpInput.useImapPassword === undefined ? oldSmtp.useImapPassword !== false : Boolean(smtpInput.useImapPassword),
    },
    lastSyncAt: text(old.lastSyncAt),
    lastSyncStatus: text(old.lastSyncStatus),
    lastSyncSummary: old.lastSyncSummary && typeof old.lastSyncSummary === "object" ? old.lastSyncSummary : null,
    createdAt: text(old.createdAt || now),
    updatedAt: now,
  };
}

function normalizeMailSettings(raw = {}, existing = {}, keyMaterial) {
  const source = raw && typeof raw === "object" ? raw : {};
  const previous = existingAccounts(existing);
  const incoming = Array.isArray(source.accounts)
    ? source.accounts
    : source.account && typeof source.account === "object"
      ? [source.account]
      : Object.keys(source).some((key) => ["enabled", "host", "user", "label"].includes(key))
        ? [source]
        : previous;
  const previousById = new Map(previous.map((account) => [text(account.id), account]));
  const accounts = (Array.isArray(incoming) ? incoming : [])
    .filter((account) => account && typeof account === "object")
    .slice(0, 24)
    .map((account) => normalizeAccount(account, previousById.get(text(account.id)) || {}, keyMaterial));

  return {
    ...DEFAULT_MAIL_SETTINGS,
    accounts,
    contentPolicy: normalizeContentPolicy(source.contentPolicy, existing?.contentPolicy),
  };
}

function publicMailSettings(settings = {}) {
  const accounts = existingAccounts(settings).map((raw) => {
    const account = normalizeAccount(raw, raw, "__public_mail_settings__");
    const brandIds = accountBrandIds(account);
    return {
      id: account.id,
      brand_id: brandIds[0] || "",
      brand_name: text(account.brand_name),
      brand_ids: brandIds,
      enabled: Boolean(account.enabled),
      label: text(account.label),
      fromName: text(account.fromName),
      imap: {
        host: text(account.imap.host),
        port: account.imap.port,
        secure: account.imap.secure !== false,
        user: text(account.imap.user),
        hasPassword: Boolean(account.imap.passwordEncrypted),
        inboxFolder: text(account.imap.inboxFolder),
        sentFolder: text(account.imap.sentFolder),
        syncDays: account.imap.syncDays,
      },
      smtp: {
        enabled: account.smtp.enabled !== false,
        host: text(account.smtp.host),
        port: account.smtp.port,
        secure: account.smtp.secure !== false,
        user: text(account.smtp.user),
        hasPassword: Boolean(account.smtp.passwordEncrypted),
        useImapPassword: account.smtp.useImapPassword !== false,
      },
      lastSyncAt: text(account.lastSyncAt),
      lastSyncStatus: text(account.lastSyncStatus),
      lastSyncSummary: account.lastSyncSummary && typeof account.lastSyncSummary === "object" ? account.lastSyncSummary : null,
    };
  });
  return {
    accounts,
    contentPolicy: mailContentPolicy(settings),
  };
}

function selectedAccount(settings, accountId) {
  const accounts = existingAccounts(settings);
  const id = text(accountId);
  const account = (id ? accounts.find((item) => text(item.id) === id) : accounts.find((item) => item.enabled)) || accounts[0];
  if (!account) throw new Error("请先新增并保存至少一个官方邮箱账户。");
  return account;
}

function resolveMailAccount(settings, keyMaterial, accountId, purpose = "imap") {
  const raw = selectedAccount(settings, accountId);
  const account = normalizeAccount(raw, raw, keyMaterial);
  const imapPassword = account.imap.passwordEncrypted ? decryptSecret(account.imap.passwordEncrypted, keyMaterial) : "";
  if (purpose === "smtp") {
    const smtp = account.smtp;
    const password = smtp.useImapPassword !== false ? imapPassword : smtp.passwordEncrypted ? decryptSecret(smtp.passwordEncrypted, keyMaterial) : "";
    const host = text(smtp.host || account.imap.host).replace(/^smtps?:\/\//i, "");
    const user = text(smtp.user || account.imap.user);
    if (!smtp.enabled) throw new Error("该账户尚未启用 SMTP 发信。");
    if (!host) throw new Error("请先填写 SMTP 服务器地址。");
    if (!user) throw new Error("请先填写 SMTP 邮箱账号。");
    if (!password) throw new Error("请先填写 SMTP 授权码，或启用“使用 IMAP 授权码”。");
    return { ...account, smtp: { ...smtp, host, user, password } };
  }
  if (!account.imap.host) throw new Error("请先填写 IMAP 服务器地址。");
  if (!account.imap.user) throw new Error("请先填写邮箱账号。");
  if (!imapPassword) throw new Error("请先填写邮箱授权码或专用密码。");
  return { ...account, imap: { ...account.imap, password: imapPassword } };
}

function createImapClient(account) {
  return new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure !== false,
    auth: { user: account.imap.user, pass: account.imap.password },
    logger: false,
    socketTimeout: 25000,
    greetingTimeout: 25000,
    connectionTimeout: 25000,
    tls: { minVersion: "TLSv1.2" },
  });
}

async function testMailConnection(settings, keyMaterial, accountId) {
  const account = resolveMailAccount(settings, keyMaterial, accountId);
  const client = createImapClient(account);
  try {
    await client.connect();
    const inbox = await client.mailboxOpen(account.imap.inboxFolder, { readOnly: true });
    return {
      ok: true,
      mailbox: account.imap.inboxFolder,
      messageCount: Number(inbox.exists || 0),
      account: account.imap.user,
      accountId: account.id,
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

function cleanExcerpt(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .filter((line) => !/^\s*(>|On .+wrote:|在.+写道：)/i.test(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 1600);
}

function cleanMailBody(value, maxChars = 12000) {
  const normalized = String(value || "")
    .replace(/\r/g, "")
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .filter((line) => !/^\s*(?:View in browser|Unsubscribe|Manage preferences)\s*$/i.test(line))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  const limit = clampNumber(maxChars, 12000, 1000, 24000);
  return {
    body: normalized.slice(0, limit),
    truncated: normalized.length > limit,
  };
}

function retentionUntil(now, retentionDays) {
  const until = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return until.toISOString();
}

function clearCachedMailBody(event) {
  const hadBody = Boolean(text(event?.body));
  event.body = "";
  event.body_cached_at = "";
  event.body_retention_until = "";
  event.body_truncated = false;
  return hadBody;
}

function isExpiredMailBody(event, nowMs) {
  const retentionUntil = Date.parse(text(event?.body_retention_until));
  return Number.isFinite(retentionUntil) && retentionUntil <= nowMs;
}

function applyMailContentPolicy(state, settings, now = new Date()) {
  const policy = mailContentPolicy(settings);
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const collections = ["followUpEvents", "mailInbox"];
  const result = { cleared: 0, expired: 0, migrated: 0, policy };

  collections.forEach((key) => {
    if (!Array.isArray(state?.[key])) return;
    state[key].forEach((event) => {
      if (!text(event?.body)) return;
      if (!policy.cacheBodies) {
        if (clearCachedMailBody(event)) result.cleared += 1;
        return;
      }
      if (isExpiredMailBody(event, nowMs)) {
        if (clearCachedMailBody(event)) result.expired += 1;
        return;
      }
      if (!text(event.body_retention_until)) {
        event.body_cached_at = text(event.body_cached_at) || nowIso;
        event.body_retention_until = retentionUntil(now, policy.retentionDays);
        event.body_truncated = Boolean(event.body_truncated);
        event.updatedAt = nowIso;
        result.migrated += 1;
      }
    });
  });

  return result;
}

function addressText(addresses) {
  return text(addresses?.text);
}

function addressEmails(addresses) {
  const values = Array.isArray(addresses?.value) ? addresses.value : [];
  return [...new Set(values.map((entry) => normalizeEmail(entry.address)).filter(Boolean))];
}

function stableFingerprint(parts) {
  return createHash("sha256").update(parts.map((part) => text(part).toLowerCase()).join("|"), "utf8").digest("hex").slice(0, 32);
}

function syncEventId(mailbox, uid, fingerprint) {
  return `IM-${createHash("sha1").update(`${mailbox}|${uid}|${fingerprint}`).digest("hex").slice(0, 12).toUpperCase()}`;
}

function findCreatorMatches(state, emailAddresses, brandId = "") {
  const all = new Set(emailAddresses.map(normalizeEmail).filter(Boolean));
  if (!all.size) return [];
  return (Array.isArray(state.creators) ? state.creators : []).filter((creator) => {
    if (text(brandId) && text(creator.brand_id) !== text(brandId)) return false;
    return emailsIn(creator.email).some((email) => all.has(email));
  });
}

function findLeadMatches(state, emailAddresses, brandId = "") {
  const all = new Set(emailAddresses.map(normalizeEmail).filter(Boolean));
  if (!all.size) return [];
  return (Array.isArray(state.leads) ? state.leads : []).filter((lead) => {
    if (text(brandId) && text(lead.brand_id) !== text(brandId)) return false;
    return emailsIn(lead.email).some((email) => all.has(email));
  });
}

function findPeopleMatches(state, emailAddresses, brandIds = []) {
  const scope = uniqueTextList(brandIds);
  const people = [];
  for (const brandId of scope) {
    findCreatorMatches(state, emailAddresses, brandId).forEach((person) => people.push({ ...person, person_type: "creator" }));
    findLeadMatches(state, emailAddresses, brandId).forEach((person) => people.push({ ...person, person_type: "lead" }));
  }
  return people;
}

function activeFollowUps(state, creatorId) {
  const terminal = new Set(["已结案", "暂停跟进", "未谈妥"]);
  return (Array.isArray(state.followUps) ? state.followUps : [])
    .filter((row) => text(row.creator_id) === text(creatorId) && !terminal.has(text(row.stage)))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

function directionFor(creator, senderEmails, recipientEmails) {
  const creatorEmails = emailsIn(creator?.email);
  if (creatorEmails.some((email) => senderEmails.includes(email))) return "inbound";
  if (creatorEmails.some((email) => recipientEmails.includes(email))) return "outbound";
  return "unknown";
}

function messageReferences(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => messageReferences(item)))];
  }
  return [...new Set(
    String(value || "")
      .match(/<([^>]+)>/g)
      ?.map((item) => item.slice(1, -1).trim())
      .filter(Boolean) || [],
  )];
}

function recordDedupKeys(record = {}, accountId = "") {
  const keys = [];
  const serverKey = text(record.server_key);
  const mailboxAccountId = text(record.mailbox_account_id);
  if (serverKey) keys.push(`server:${serverKey}`);
  if (!accountId || mailboxAccountId === text(accountId)) {
    const messageId = text(record.message_id);
    const fingerprint = text(record.fingerprint);
    if (messageId) keys.push(`message:${messageId}`);
    if (fingerprint) keys.push(`fingerprint:${fingerprint}`);
  }
  return keys;
}

function knownMessageKeys(state, accountId = "") {
  return new Set(
    [...(Array.isArray(state.followUpEvents) ? state.followUpEvents : []), ...(Array.isArray(state.mailInbox) ? state.mailInbox : [])]
      .flatMap((event) => recordDedupKeys(event, accountId)),
  );
}

function makeMailRecord(parsed, message, mailbox, account, creator, now, policy = mailContentPolicy()) {
  const sender = addressText(parsed.from);
  const recipients = [addressText(parsed.to), addressText(parsed.cc)].filter(Boolean).join("；");
  const senderEmails = addressEmails(parsed.from);
  const recipientEmails = [...addressEmails(parsed.to), ...addressEmails(parsed.cc)];
  const occurred = parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : message.internalDate instanceof Date ? message.internalDate : now;
  const occurredAt = occurred.toISOString();
  const subject = text(parsed.subject).slice(0, 500);
  const messageId = text(parsed.messageId).replace(/[<>]/g, "");
  const excerpt = cleanExcerpt(parsed.text || parsed.html || "");
  const bodyResult = policy.cacheBodies ? cleanMailBody(parsed.text || parsed.html || "") : { body: "", truncated: false };
  const uid = text(message.uid || message.seq || "");
  const serverKey = `${account.imap.host}|${account.imap.user}|${mailbox}|${uid}`;
  const fingerprint = stableFingerprint([occurredAt, sender, recipients, subject, excerpt]);
  return {
    id: syncEventId(mailbox, uid, fingerprint),
    type: "email",
    occurred_at: occurredAt,
    direction: directionFor(creator, senderEmails, recipientEmails),
    subject,
    sender,
    recipients,
    excerpt,
    message_id: messageId,
    fingerprint,
    source: `IMAP · ${account.label || account.imap.user}`,
    mailbox,
    brand_id: "",
    candidate_brand_ids: accountBrandIds(account),
    mailbox_account_id: text(account.id),
    in_reply_to: text(parsed.inReplyTo).replace(/[<>]/g, ""),
    references: messageReferences(parsed.references),
    body: bodyResult.body,
    body_cached_at: bodyResult.body ? now.toISOString() : "",
    body_retention_until: bodyResult.body ? retentionUntil(now, policy.retentionDays) : "",
    body_truncated: bodyResult.truncated,
    server_key: serverKey,
    imap_uid: uid,
    createdAt: now.toISOString(),
  };
}

function findContactTrackMatches(state, emailAddresses, account, direction, occurredAt = "") {
  const scope = new Set(accountBrandIds(account));
  const addresses = new Set(emailAddresses.map(normalizeEmail).filter(Boolean));
  if (!addresses.size) return [];
  return (Array.isArray(state.contactTracks) ? state.contactTracks : [])
    .filter((track) => {
      if (!scope.has(text(track.brand_id))) return false;
      if (text(track.mailbox_account_id) && text(track.mailbox_account_id) !== text(account.id)) return false;
      if (direction === "inbound" && !["waiting_reply", "replied"].includes(text(track.status))) return false;
      if (direction === "inbound" && !isWithinReplyWindow(track.last_outbound_at, occurredAt)) return false;
      return emailsIn(track.email).some((email) => addresses.has(email));
    })
    .sort((a, b) => new Date(b.last_outbound_at || b.updatedAt || 0) - new Date(a.last_outbound_at || a.updatedAt || 0));
}

function updatePersonOutreachTimestamp(state, person, occurredAt, now = new Date().toISOString()) {
  const timestamp = dateTimestamp(occurredAt);
  if (!Number.isFinite(timestamp)) return false;
  const collectionKey = text(person?.person_type) === "lead" ? "leads" : "creators";
  const collection = Array.isArray(state[collectionKey]) ? state[collectionKey] : [];
  const source = collection.find((row) => text(row.id) === text(person?.id));
  if (!source) return false;
  const previous = dateTimestamp(source.last_outreach_at);
  if (Number.isFinite(previous) && previous >= timestamp) return false;
  source.last_outreach_at = new Date(timestamp).toISOString();
  source.updatedAt = now;
  return true;
}

function createId(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function ensureCreatorForContactTrack(state, track, now) {
  const existing = (Array.isArray(state.creators) ? state.creators : []).find((row) => text(row.id) === text(track.person_id));
  if (existing) return existing;
  const lead = (Array.isArray(state.leads) ? state.leads : []).find((row) => text(row.id) === text(track.person_id));
  if (!lead) return null;
  const creator = {
    ...lead,
    id: createId("CR"),
    name: text(lead.name || track.person_name || lead.handle || "未命名达人"),
    email: text(lead.email || track.email),
    brand_id: text(track.brand_id || lead.brand_id),
    brand: text(track.brand || lead.brand),
    source_lead_id: lead.id,
    createdAt: now,
    updatedAt: now,
  };
  state.creators = [creator, ...(Array.isArray(state.creators) ? state.creators : [])];
  lead.status = "已转达人库";
  lead.updatedAt = now;
  track.person_type = "creator";
  track.person_id = creator.id;
  track.person_name = creator.name;
  return creator;
}

function createFollowUpForTrack(state, track, record, now) {
  const creator = ensureCreatorForContactTrack(state, track, now);
  if (!creator) return null;
  const existing = activeFollowUps(state, creator.id)[0];
  if (existing) return { followUp: existing, created: false };
  const followUp = {
    id: createId("FU"),
    brand_id: text(track.brand_id || creator.brand_id),
    brand: text(track.brand || creator.brand),
    creator_id: creator.id,
    creator_name: creator.name,
    stage: "初步沟通",
    priority: "中",
    cooperation_mode: "待确认",
    next_action: "阅读最新回复并确认合作方向",
    shipping_status: "未寄样",
    last_email_at: record.occurred_at,
    notes: "由官邮同步的已联系达人回复自动创建。",
    createdAt: now,
    updatedAt: now,
  };
  state.followUps = [followUp, ...(Array.isArray(state.followUps) ? state.followUps : [])];
  return { followUp, created: true };
}

function upsertContactTrack(state, input = {}, now = new Date().toISOString()) {
  state.contactTracks = Array.isArray(state.contactTracks) ? state.contactTracks : [];
  const email = normalizeEmail(input.email);
  if (!email || !text(input.brand_id)) return null;
  const found = state.contactTracks.find((track) =>
    text(track.brand_id) === text(input.brand_id) &&
    text(track.person_type) === text(input.person_type) &&
    text(track.person_id) === text(input.person_id) &&
    normalizeEmail(track.email) === email &&
    text(track.mailbox_account_id) === text(input.mailbox_account_id),
  );
  const inputOutboundAt = text(input.last_outbound_at);
  const foundOutboundAt = text(found?.last_outbound_at);
  const shouldRefreshOutbound = !found ||
    !Number.isFinite(dateTimestamp(foundOutboundAt)) ||
    (Number.isFinite(dateTimestamp(inputOutboundAt)) && dateTimestamp(inputOutboundAt) >= dateTimestamp(foundOutboundAt));
  const next = {
    id: found?.id || createId("CT"),
    brand_id: text(input.brand_id),
    brand: text(input.brand),
    person_type: text(input.person_type) || "creator",
    person_id: text(input.person_id),
    person_name: text(input.person_name),
    email,
    mailbox_account_id: text(input.mailbox_account_id),
    last_outbound_at: shouldRefreshOutbound ? text(inputOutboundAt || foundOutboundAt || now) : foundOutboundAt,
    last_outbound_subject: shouldRefreshOutbound
      ? text(input.last_outbound_subject || found?.last_outbound_subject)
      : text(found?.last_outbound_subject),
    status: shouldRefreshOutbound ? text(input.status || found?.status || "waiting_reply") : text(found?.status || input.status || "waiting_reply"),
    follow_up_id: text(input.follow_up_id || found?.follow_up_id),
    source: text(input.source || found?.source || "smtp"),
    createdAt: text(found?.createdAt || now),
    updatedAt: now,
  };
  if (found) Object.assign(found, next);
  else state.contactTracks.unshift(next);
  return found || next;
}

function routeMailRecord(state, record, account, now = new Date().toISOString()) {
  const scope = accountBrandIds(account);
  const senderEmails = emailsIn(record.sender);
  const recipientEmails = emailsIn(record.recipients);
  const directions = [];
  const people = findPeopleMatches(state, [...senderEmails, ...recipientEmails], scope);
  const inboundPeople = people.filter((person) => emailsIn(person.email).some((email) => senderEmails.includes(email)));
  const outboundPeople = people.filter((person) => emailsIn(person.email).some((email) => recipientEmails.includes(email)));
  const inboundTracks = findContactTrackMatches(state, senderEmails, account, "inbound", record.occurred_at);
  const threadEvent = text(record.in_reply_to)
    ? (Array.isArray(state.followUpEvents) ? state.followUpEvents : []).find((event) => text(event.message_id) === text(record.in_reply_to) && scope.includes(text(event.brand_id)))
    : null;

  if (threadEvent?.follow_up_id) {
    const followUp = (Array.isArray(state.followUps) ? state.followUps : []).find((item) => text(item.id) === text(threadEvent.follow_up_id));
    if (followUp) {
      return { kind: "followup", followUp, record: { ...record, direction: "inbound", brand_id: followUp.brand_id, brand: followUp.brand }, matched: "thread" };
    }
  }

  if (inboundTracks.length === 1) {
    const track = inboundTracks[0];
    const existingFollowUp = text(track.follow_up_id)
      ? (Array.isArray(state.followUps) ? state.followUps : []).find((item) => text(item.id) === text(track.follow_up_id))
      : null;
    const followUpResult = existingFollowUp
      ? { followUp: existingFollowUp, created: false }
      : createFollowUpForTrack(state, track, record, now);
    const followUp = followUpResult?.followUp;
    if (followUp) {
      track.status = "replied";
      track.follow_up_id = followUp.id;
      track.replied_at = now;
      track.updatedAt = now;
      return {
        kind: "followup",
        followUp,
        autoCreated: Boolean(followUpResult.created),
        record: { ...record, direction: "inbound", brand_id: followUp.brand_id, brand: followUp.brand },
        matched: "contact_track",
      };
    }
  }

  if (inboundTracks.length > 1) directions.push("contact_track");
  if (inboundPeople.length === 1) {
    const person = inboundPeople[0];
    if (isWithinReplyWindow(person.last_outreach_at, record.occurred_at)) {
      const track = upsertContactTrack(state, {
        brand_id: person.brand_id,
        brand: person.brand,
        person_type: person.person_type,
        person_id: person.id,
        person_name: person.name,
        email: emailsIn(person.email)[0],
        mailbox_account_id: account.id,
        last_outbound_at: person.last_outreach_at,
        status: "waiting_reply",
        source: "profile_outreach_window",
      }, now);
      const followUpResult = createFollowUpForTrack(state, track, record, now);
      const followUp = followUpResult?.followUp;
      if (followUp) {
        track.status = "replied";
        track.follow_up_id = followUp.id;
        track.replied_at = now;
        track.updatedAt = now;
        return {
          kind: "followup",
          followUp,
          autoCreated: Boolean(followUpResult.created),
          record: { ...record, direction: "inbound", brand_id: followUp.brand_id, brand: followUp.brand },
          matched: "profile_outreach_window",
        };
      }
    }
    return {
      kind: "inbox",
      status: "needs_followup",
      record: { ...record, direction: "inbound", brand_id: person.brand_id, brand: person.brand },
      people: [person],
    };
  }

  if (outboundPeople.length === 1) {
    const person = outboundPeople[0];
    const track = upsertContactTrack(state, {
      brand_id: person.brand_id,
      brand: person.brand,
      person_type: person.person_type,
      person_id: person.id,
      person_name: person.name,
      email: emailsIn(person.email)[0],
      mailbox_account_id: account.id,
      last_outbound_at: record.occurred_at,
      last_outbound_subject: record.subject,
      status: "waiting_reply",
      source: "imap_sent",
    }, now);
    updatePersonOutreachTimestamp(state, person, record.occurred_at, now);
    return { kind: "tracked_outbound", track, record: { ...record, direction: "outbound", brand_id: person.brand_id, brand: person.brand }, people: [person] };
  }

  const candidates = inboundPeople.length ? inboundPeople : outboundPeople;
  const candidateBrandIds = [...new Set(candidates.map((person) => text(person.brand_id)).filter(Boolean))];
  const hasMultipleCandidateBrands = candidateBrandIds.length > 1;
  const hasMultipleCandidates = candidates.length > 1;
  return {
    kind: "inbox",
    status: hasMultipleCandidateBrands ? "needs_brand_confirmation" : hasMultipleCandidates ? "ambiguous_creator" : "unmatched",
    record: { ...record, direction: inboundPeople.length ? "inbound" : outboundPeople.length ? "outbound" : record.direction, brand_id: candidateBrandIds.length === 1 ? candidateBrandIds[0] : "" },
    people: candidates,
    candidateBrandIds: candidateBrandIds.length ? candidateBrandIds : scope,
    reason: directions.join(","),
  };
}

function findKnownMailRecord(state, record, accountId = "") {
  const keys = new Set(recordDedupKeys(record, accountId));
  if (!keys.size) return null;
  const candidates = [...(Array.isArray(state?.followUpEvents) ? state.followUpEvents : []), ...(Array.isArray(state?.mailInbox) ? state.mailInbox : [])];
  return candidates.find((event) => recordDedupKeys(event, accountId).some((key) => keys.has(key))) || null;
}

function cacheBodyOnExistingRecord(existing, record, now) {
  if (!existing || !text(record?.body) || text(existing.body)) return false;
  existing.body = record.body;
  existing.body_cached_at = record.body_cached_at || now.toISOString();
  existing.body_retention_until = record.body_retention_until;
  existing.body_truncated = Boolean(record.body_truncated);
  existing.updatedAt = now.toISOString();
  return true;
}

async function syncMailAccount(settings, state, keyMaterial, options = {}) {
  const account = resolveMailAccount(settings, keyMaterial, options.accountId);
  const client = createImapClient(account);
  const now = new Date();
  const maxPerFolder = clampNumber(options.maxPerFolder, 120, 1, 250);
  const since = new Date(now.getTime() - account.imap.syncDays * 24 * 60 * 60 * 1000);
  const folders = [...new Set([account.imap.inboxFolder, account.imap.sentFolder].map(text).filter(Boolean))];
  const summary = {
    scanned: 0,
    added: 0,
    matched: 0,
    pending: 0,
    waitingReplyMatched: 0,
    routedToFollowUps: 0,
    autoCreatedFollowUps: 0,
    needsBrandConfirmation: 0,
    skipped: 0,
    cachedBodies: 0,
    refreshedBodies: 0,
    clearedBodies: 0,
    expiredBodies: 0,
    warnings: [],
    folders: {},
  };
  const policy = mailContentPolicy(settings);
  const policyResult = applyMailContentPolicy(state, settings, now);
  summary.clearedBodies = policyResult.cleared;
  summary.expiredBodies = policyResult.expired;
  const knownKeys = knownMessageKeys(state, account.id);
  state.followUpEvents = Array.isArray(state.followUpEvents) ? state.followUpEvents : [];
  state.mailInbox = Array.isArray(state.mailInbox) ? state.mailInbox : [];
  state.contactTracks = Array.isArray(state.contactTracks) ? state.contactTracks : [];

  try {
    await client.connect();
    for (const folder of folders) {
      try {
        await client.mailboxOpen(folder, { readOnly: true });
        const sequenceIds = await client.search({ since });
        const selected = sequenceIds.slice(-maxPerFolder);
        summary.folders[folder] = { scanned: selected.length, added: 0 };
        for await (const message of client.fetch(selected, { uid: true, source: true, internalDate: true })) {
          summary.scanned += 1;
          const parsed = await simpleParser(message.source);
          const allEmails = [...addressEmails(parsed.from), ...addressEmails(parsed.to), ...addressEmails(parsed.cc)];
          const people = findPeopleMatches(state, allEmails, accountBrandIds(account));
          const likelyCreator = people.length === 1 && people[0].person_type === "creator" ? people[0] : null;
          const record = makeMailRecord(parsed, message, folder, account, likelyCreator, now, policy);
          const keys = recordDedupKeys(record, account.id);
          if (keys.some((key) => knownKeys.has(key))) {
            const existing = findKnownMailRecord(state, record, account.id);
            if (cacheBodyOnExistingRecord(existing, record, now)) summary.refreshedBodies += 1;
            summary.skipped += 1;
            continue;
          }
          keys.forEach((key) => knownKeys.add(key));
          const routed = routeMailRecord(state, record, account, now.toISOString());
          if (routed.kind === "followup") {
            const followUp = routed.followUp;
            const event = { ...routed.record, follow_up_id: followUp.id, brand_id: text(followUp.brand_id), brand: text(followUp.brand), updatedAt: now.toISOString() };
            state.followUpEvents.unshift(event);
            followUp.last_email_at = record.occurred_at;
            followUp.has_unread_reply = routed.record.direction === "inbound";
            followUp.updatedAt = now.toISOString();
            summary.added += 1;
            summary.matched += 1;
            summary.routedToFollowUps += 1;
            if (routed.matched === "contact_track") summary.waitingReplyMatched += 1;
            if (routed.autoCreated) summary.autoCreatedFollowUps += 1;
            if (record.body) summary.cachedBodies += 1;
            summary.folders[folder].added += 1;
            continue;
          }
          if (routed.kind === "tracked_outbound") {
            summary.added += 1;
            summary.waitingReplyMatched += 1;
            if (record.body) summary.cachedBodies += 1;
            summary.folders[folder].added += 1;
            continue;
          }

          const candidates = routed.people || [];
          const creator = candidates.length === 1 && candidates[0].person_type === "creator" ? candidates[0] : null;
          const status = routed.status || (candidates.length > 1 ? "ambiguous_creator" : creator ? "needs_followup" : "unmatched");
          state.mailInbox.unshift({
            ...routed.record,
            status,
            brand_id: text(routed.record.brand_id),
            matched_creator_id: creator?.id || "",
            matched_creator_name: creator?.name || "",
            candidate_creator_ids: candidates.filter((item) => item.person_type === "creator").map((item) => item.id),
            candidate_lead_ids: candidates.filter((item) => item.person_type === "lead").map((item) => item.id),
            candidate_brand_ids: routed.candidateBrandIds || [...new Set(candidates.map((item) => item.brand_id).filter(Boolean))],
            candidate_follow_up_ids: creator ? activeFollowUps(state, creator.id).map((item) => item.id) : [],
          });
          summary.added += 1;
          summary.pending += 1;
          if (status === "needs_brand_confirmation") summary.needsBrandConfirmation += 1;
          if (record.body) summary.cachedBodies += 1;
          summary.folders[folder].added += 1;
        }
      } catch (error) {
        summary.warnings.push(`${folder}：${error.message || "同步失败"}`);
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  if (!summary.scanned && summary.warnings.length === folders.length) {
    throw new Error(summary.warnings.join("；"));
  }
  return summary;
}

function createSmtpTransport(account) {
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure !== false,
    auth: { user: account.smtp.user, pass: account.smtp.password },
    connectionTimeout: 25000,
    greetingTimeout: 25000,
    socketTimeout: 25000,
    tls: { minVersion: "TLSv1.2" },
  });
}

async function testSmtpConnection(settings, keyMaterial, accountId) {
  const account = resolveMailAccount(settings, keyMaterial, accountId, "smtp");
  const transport = createSmtpTransport(account);
  await transport.verify();
  return { ok: true, accountId: account.id, account: account.smtp.user, transport: `${account.smtp.host}:${account.smtp.port}` };
}

function recipientList(value) {
  const recipients = emailsIn(value);
  if (!recipients.length) throw new Error("请填写有效的收件人邮箱。");
  return recipients;
}

function compactBody(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim().slice(0, 16000);
}

function replyHeaderMessageId(value) {
  const id = text(value).replace(/[<>]/g, "");
  return id ? `<${id}>` : "";
}

async function sendMailAccount(settings, state, keyMaterial, input = {}) {
  const account = resolveMailAccount(settings, keyMaterial, input.accountId, "smtp");
  const to = recipientList(input.to);
  const subject = text(input.subject).slice(0, 500);
  const body = compactBody(input.text);
  const followUpId = text(input.followUpId);
  const brandId = text(input.brandId);
  if (!subject) throw new Error("请填写邮件主题。");
  if (!body) throw new Error("请填写邮件正文。");
  const nowDate = new Date();
  const policy = mailContentPolicy(settings);
  applyMailContentPolicy(state, settings, nowDate);

  const followUp = (Array.isArray(state.followUps) ? state.followUps : []).find((item) => text(item.id) === followUpId);
  if (!followUp) throw new Error("未找到对应合作跟进，无法保存发信记录。");
  const creator = (Array.isArray(state.creators) ? state.creators : []).find((item) => text(item.id) === text(followUp.creator_id));
  const followUpBrandId = text(followUp.brand_id || creator?.brand_id);
  if (brandId && brandId !== followUpBrandId) {
    throw new Error("发信品牌与当前合作跟进不一致，已阻止发送。");
  }
  if (!accountBrandIds(account).includes(followUpBrandId)) {
    throw new Error("所选官方邮箱不属于该品牌工作区，无法跨品牌发送。");
  }

  const replyToEvent = (Array.isArray(state.followUpEvents) ? state.followUpEvents : []).find((item) => text(item.id) === text(input.replyToEventId));
  const referenceId = replyHeaderMessageId(replyToEvent?.message_id);
  const transport = createSmtpTransport(account);
  const from = account.fromName ? `"${account.fromName.replace(/["\\]/g, "")}" <${account.smtp.user}>` : account.smtp.user;
  const result = await transport.sendMail({
    from,
    to,
    subject,
    text: body,
    inReplyTo: referenceId || undefined,
    references: referenceId || undefined,
  });

  const now = nowDate.toISOString();
  const event = {
    id: `SMTP-${randomBytes(6).toString("hex").toUpperCase()}`,
    follow_up_id: followUp.id,
    type: "mail_sent",
    occurred_at: now,
    direction: "outbound",
    subject,
    sender: from,
    recipients: to.join("; "),
    excerpt: cleanExcerpt(body).slice(0, 1600),
    body: policy.cacheBodies ? body : "",
    body_cached_at: policy.cacheBodies ? now : "",
    body_retention_until: policy.cacheBodies ? retentionUntil(nowDate, policy.retentionDays) : "",
    body_truncated: false,
    message_id: text(result.messageId).replace(/[<>]/g, ""),
    fingerprint: stableFingerprint([now, from, to.join(";"), subject, body]),
    source: `SMTP · ${account.label || account.smtp.user}`,
    mailbox: account.imap.sentFolder || "Sent",
    brand_id: followUpBrandId,
    mailbox_account_id: account.id,
    createdAt: now,
    updatedAt: now,
  };
  state.followUpEvents = [event, ...(Array.isArray(state.followUpEvents) ? state.followUpEvents : [])];
  upsertContactTrack(state, {
    brand_id: followUpBrandId,
    brand: text(followUp.brand || creator?.brand),
    person_type: "creator",
    person_id: text(creator?.id || followUp.creator_id),
    person_name: text(creator?.name || followUp.creator_name),
    email: to[0],
    mailbox_account_id: account.id,
    last_outbound_at: now,
    last_outbound_subject: subject,
    status: "waiting_reply",
    follow_up_id: followUp.id,
    source: "smtp",
  }, now);
  if (creator) updatePersonOutreachTimestamp(state, { ...creator, person_type: "creator" }, now, now);
  followUp.last_email_at = now;
  followUp.has_unread_reply = false;
  followUp.updatedAt = now;
  return { ok: true, accountId: account.id, event };
}

module.exports = {
  DEFAULT_MAIL_SETTINGS,
  normalizeMailSettings,
  publicMailSettings,
  mailContentPolicy,
  applyMailContentPolicy,
  testMailConnection,
  syncMailAccount,
  testSmtpConnection,
  sendMailAccount,
  upsertContactTrack,
  routeMailRecord,
  accountBrandIds,
};
