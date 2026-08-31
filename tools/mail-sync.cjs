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
  signatureText: "",
  signatureImageUrl: "",
  signatureImageData: "",
  signatureImageAlt: "HSU Shop",
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

function parseFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = text(value).toLowerCase();
  if (["true", "1", "yes", "y", "是", "有", "已开启", "开启"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "否", "无", "未开启", "关闭", ""].includes(normalized)) return false;
  return Boolean(value);
}

function clampNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function normalizeContentPolicy(input = {}, previous = {}) {
  const source = input && typeof input === "object" ? input : {};
  const old = previous && typeof previous === "object" ? previous : {};
  const cacheBodies = source.cacheBodies === undefined ? parseFlag(old.cacheBodies) : parseFlag(source.cacheBodies);
  return {
    ...DEFAULT_MAIL_SETTINGS.contentPolicy,
    cacheBodies,
    allowAiContext: cacheBodies && (source.allowAiContext === undefined ? parseFlag(old.allowAiContext) : parseFlag(source.allowAiContext)),
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
    enabled: parseFlag(source.enabled),
    label: text(source.label || "官邮 IMAP").slice(0, 80),
    fromName: text(source.fromName).slice(0, 120),
    signatureText: compactBody(source.signatureText).slice(0, 4000),
    signatureImageUrl: normalizeSignatureImageUrl(source.signatureImageUrl),
    signatureImageData: normalizeSignatureImageData(source.signatureImageData),
    signatureImageAlt: text(source.signatureImageAlt || "HSU Shop").slice(0, 160),
    brand_id: text(source.brand_id),
    brand_name: text(source.brand_name),
    brand_ids: uniqueTextList(source.brand_ids || source.brand_id),
    imap: {
      ...DEFAULT_MAIL_ACCOUNT.imap,
      host: text(source.host).replace(/^imap:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(source.port, DEFAULT_MAIL_ACCOUNT.imap.port, 1, 65535),
      secure: source.secure === undefined ? true : parseFlag(source.secure),
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
      secure: source.smtpSecure === undefined ? true : parseFlag(source.smtpSecure),
      user: text(source.smtpUser || ""),
      passwordEncrypted: text(source.smtpPasswordEncrypted || ""),
      useImapPassword: source.smtpUseImapPassword === undefined ? true : parseFlag(source.smtpUseImapPassword),
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
    enabled: source.enabled === undefined ? parseFlag(old.enabled) : parseFlag(source.enabled),
    label: text(source.label || old.label || DEFAULT_MAIL_ACCOUNT.label).slice(0, 80),
    fromName: text(source.fromName ?? old.fromName).slice(0, 120),
    signatureText: compactBody(source.signatureText ?? old.signatureText).slice(0, 4000),
    signatureImageUrl: normalizeSignatureImageUrl(source.signatureImageUrl ?? old.signatureImageUrl),
    signatureImageData: normalizeSignatureImageData(source.signatureImageData ?? old.signatureImageData),
    signatureImageAlt: text(source.signatureImageAlt ?? old.signatureImageAlt ?? "HSU Shop").slice(0, 160),
    imap: {
      ...DEFAULT_MAIL_ACCOUNT.imap,
      ...oldImap,
      host: text(imapInput.host ?? oldImap.host).replace(/^imap:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(imapInput.port ?? oldImap.port, DEFAULT_MAIL_ACCOUNT.imap.port, 1, 65535),
      secure: imapInput.secure === undefined ? oldImap.secure !== false : parseFlag(imapInput.secure),
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
      enabled: smtpInput.enabled === undefined ? oldSmtp.enabled !== false : parseFlag(smtpInput.enabled),
      host: text(smtpInput.host ?? oldSmtp.host).replace(/^smtps?:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(smtpInput.port ?? oldSmtp.port, DEFAULT_MAIL_ACCOUNT.smtp.port, 1, 65535),
      secure: smtpInput.secure === undefined ? oldSmtp.secure !== false : parseFlag(smtpInput.secure),
      user: text(smtpInput.user ?? oldSmtp.user).slice(0, 320),
      passwordEncrypted: smtpPassword
        ? encryptSecret(smtpPassword, keyMaterial)
        : smtpInput.clearPassword === true
          ? ""
          : text(oldSmtp.passwordEncrypted),
      useImapPassword: smtpInput.useImapPassword === undefined ? oldSmtp.useImapPassword !== false : parseFlag(smtpInput.useImapPassword),
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
      enabled: parseFlag(account.enabled),
      label: text(account.label),
      fromName: text(account.fromName),
      signatureText: text(account.signatureText),
      signatureImageUrl: text(account.signatureImageUrl),
      signatureImageData: text(account.signatureImageData),
      signatureImageAlt: text(account.signatureImageAlt || "HSU Shop"),
      imap: {
        host: text(account.imap.host),
        port: account.imap.port,
        secure: parseFlag(account.imap.secure),
        user: text(account.imap.user),
        hasPassword: Boolean(account.imap.passwordEncrypted),
        inboxFolder: text(account.imap.inboxFolder),
        sentFolder: text(account.imap.sentFolder),
        syncDays: account.imap.syncDays,
      },
      smtp: {
        enabled: parseFlag(account.smtp.enabled),
        host: text(account.smtp.host),
        port: account.smtp.port,
        secure: parseFlag(account.smtp.secure),
        user: text(account.smtp.user),
        hasPassword: Boolean(account.smtp.passwordEncrypted),
        useImapPassword: parseFlag(account.smtp.useImapPassword),
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
    // A promoted lead is retained for history, but it must no longer compete
    // with the creator record during mailbox routing.
    if (text(lead.status) === "已转达人库") return false;
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

function directionForFollowUp(state, followUp, record) {
  if (["inbound", "outbound"].includes(text(record?.direction))) return text(record.direction);
  const person = (Array.isArray(state?.creators) ? state.creators : [])
    .find((item) => text(item.id) === text(followUp?.creator_id)) ||
    (Array.isArray(state?.leads) ? state.leads : [])
      .find((item) => text(item.id) === text(followUp?.lead_id));
  return directionFor(person, emailsIn(record?.sender), emailsIn(record?.recipients));
}

const FOLLOW_UP_TERMINAL_STAGES = new Set(["已结案", "暂停跟进", "未谈妥"]);
const FOLLOW_UP_WAITING_REPLY_STAGES = new Set(["已联系待回复", "待回复"]);

function normalizeMessageId(value) {
  return text(value)
    .replace(/[<>]/g, "")
    .trim();
}

function updateFollowUpAfterInboundReply(followUp, now) {
  if (!followUp || FOLLOW_UP_TERMINAL_STAGES.has(text(followUp.stage))) {
    if (followUp) {
      followUp.has_unread_reply = true;
      followUp.updatedAt = now;
    }
    return { stageAdvanced: false, terminal: true };
  }
  followUp.has_unread_reply = true;
  const currentStage = text(followUp.stage);
  const waitingForReply = FOLLOW_UP_WAITING_REPLY_STAGES.has(currentStage) ||
    !currentStage;
  if (!waitingForReply) return { stageAdvanced: false, terminal: false };
  if (currentStage !== "初步沟通") {
    followUp.stage = "初步沟通";
    followUp.updatedAt = now;
    return { stageAdvanced: true, terminal: false };
  }
  return { stageAdvanced: false, terminal: false };
}

function updateFollowUpContactTrack(state, followUp, record, account, direction, now) {
  const creator = (Array.isArray(state?.creators) ? state.creators : [])
    .find((person) => text(person.id) === text(followUp?.creator_id));
  if (!creator || !text(creator.email)) return null;
  const creatorEmails = emailsIn(creator.email);
  const email = creatorEmails.join("; ");
  const existing = (Array.isArray(state.contactTracks) ? state.contactTracks : []).find((track) =>
    text(track.brand_id) === text(followUp.brand_id) &&
    text(track.person_type) === "creator" &&
    text(track.person_id) === text(creator.id) &&
    (!text(track.mailbox_account_id) || text(track.mailbox_account_id) === text(account?.id)) &&
    emailsIn(track.email).some((candidate) => creatorEmails.includes(candidate)),
  );
  if (direction === "inbound") {
    if (existing) {
      existing.email = email;
      existing.status = "replied";
      existing.follow_up_id = followUp.id;
      existing.replied_at = text(record.occurred_at) || now;
      existing.updatedAt = now;
      return existing;
    }
    return upsertContactTrack(state, {
      brand_id: followUp.brand_id,
      brand: followUp.brand,
      person_type: "creator",
      person_id: creator.id,
      person_name: creator.name,
      email,
      mailbox_account_id: account.id,
      last_outbound_at: "",
      status: "replied",
      follow_up_id: followUp.id,
      replied_at: text(record.occurred_at) || now,
      source: "imap_reply_thread",
    }, now);
  }
  return upsertContactTrack(state, {
    brand_id: followUp.brand_id,
    brand: followUp.brand,
    person_type: "creator",
    person_id: creator.id,
    person_name: creator.name,
    email,
    mailbox_account_id: account.id,
    last_outbound_at: record.occurred_at,
    last_outbound_subject: record.subject,
    status: "waiting_reply",
    follow_up_id: followUp.id,
    source: "imap_sent_thread",
  }, now);
}

function messageReferences(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => messageReferences(item)))];
  }
  const raw = String(value || "").trim();
  if (!raw) return [];
  const angleIds = [...raw.matchAll(/<([^>]+)>/g)].map((match) => normalizeMessageId(match[1]));
  const plainIds = raw
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .map(normalizeMessageId);
  return [...new Set([...angleIds, ...plainIds].filter(Boolean))];
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
   const messageId = normalizeMessageId(parsed.messageId);
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
     in_reply_to: normalizeMessageId(parsed.inReplyTo),
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
  const followUpsById = new Map(
    (Array.isArray(state.followUps) ? state.followUps : [])
      .map((followUp) => [text(followUp.id), followUp])
      .filter(([id]) => id),
  );
  return (Array.isArray(state.contactTracks) ? state.contactTracks : [])
    .filter((track) => {
      if (!scope.has(text(track.brand_id))) return false;
      if (text(track.mailbox_account_id) && text(track.mailbox_account_id) !== text(account.id)) return false;
      if (direction === "inbound" && !["waiting_reply", "replied"].includes(text(track.status))) return false;
      if (direction === "inbound") {
        const linkedFollowUp = followUpsById.get(text(track.follow_up_id));
        const hasActiveFollowUp = linkedFollowUp && !FOLLOW_UP_TERMINAL_STAGES.has(text(linkedFollowUp.stage));
        // The 30-day window is only for recovering a missing first-outreach
        // track. An already linked active follow-up can continue indefinitely.
        if (!hasActiveFollowUp && !isWithinReplyWindow(track.last_outbound_at, occurredAt)) return false;
      }
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
  source.first_contacted_at = text(source.first_contacted_at) || source.last_outreach_at;
  source.last_contacted_at = source.last_outreach_at;
  source.contact_channel = text(source.contact_channel) || "官邮";
  source.updatedAt = now;
  return true;
}

function createId(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function normalizeIdentityUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

function sameBrand(left, right) {
  const leftBrandId = text(left?.brand_id);
  const rightBrandId = text(right?.brand_id);
  return Boolean(leftBrandId && rightBrandId && leftBrandId === rightBrandId);
}

function findExistingCreatorForLead(state, lead, track) {
  const brandId = text(track?.brand_id || lead?.brand_id);
  if (!brandId) return null;
  const leadEmails = new Set(emailsIn(lead?.email || track?.email));
  const leadSocialUrl = normalizeIdentityUrl(lead?.social_url);
  return (Array.isArray(state?.creators) ? state.creators : []).find((creator) => {
    if (!sameBrand({ brand_id: brandId }, creator)) return false;
    const emailMatches = leadEmails.size && emailsIn(creator.email).some((email) => leadEmails.has(email));
    const socialMatches = leadSocialUrl && leadSocialUrl === normalizeIdentityUrl(creator.social_url);
    return emailMatches || socialMatches;
  }) || null;
}

function ensureCreatorForContactTrack(state, track, now) {
  const lead = (Array.isArray(state.leads) ? state.leads : []).find((row) => text(row.id) === text(track.person_id));
  const trackBrandId = text(track?.brand_id || lead?.brand_id);
  const existing = (Array.isArray(state.creators) ? state.creators : []).find((row) =>
    text(row.id) === text(track.person_id) &&
    (!trackBrandId || text(row.brand_id) === trackBrandId),
  );
  if (existing) return existing;
  if (!lead) return null;
  const matchedCreator = findExistingCreatorForLead(state, lead, track);
  if (matchedCreator) {
    lead.status = "已转达人库";
    lead.updatedAt = now;
    track.person_type = "creator";
    track.person_id = matchedCreator.id;
    track.person_name = matchedCreator.name;
    return matchedCreator;
  }
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

function findFollowUpForLead(state, leadId, brandId = "") {
  return (Array.isArray(state?.followUps) ? state.followUps : [])
    .filter((followUp) =>
      text(followUp.lead_id) === text(leadId) &&
      (!brandId || text(followUp.brand_id) === text(brandId)) &&
      !FOLLOW_UP_TERMINAL_STAGES.has(text(followUp.stage)),
    )
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
}

function createWaitingFollowUpForLead(state, lead, now = new Date().toISOString()) {
  if (!lead?.id || !text(lead.brand_id)) return null;
  const existing = findFollowUpForLead(state, lead.id, lead.brand_id);
  if (existing) {
    if (["", "待开发", "待回复"].includes(text(existing.stage))) {
      existing.stage = "已联系待回复";
      existing.next_action = "等待达人回复";
      existing.updatedAt = now;
    }
    return { followUp: existing, created: false };
  }
  const followUp = {
    id: createId("FU"),
    brand_id: text(lead.brand_id),
    brand: text(lead.brand),
    lead_id: text(lead.id),
    creator_id: "",
    creator_name: text(lead.name || lead.handle || lead.social_url || "待开发达人"),
    stage: "已联系待回复",
    priority: "中",
    cooperation_mode: "待确认",
    next_action: "等待达人回复",
    shipping_status: "未寄样",
    last_email_at: "",
    has_unread_reply: false,
    notes: "由待开发达人首发开发邮件自动建立，收到回复后转入达人库并进入初步沟通。",
    createdAt: now,
    updatedAt: now,
  };
  state.followUps = [followUp, ...(Array.isArray(state.followUps) ? state.followUps : [])];
  return { followUp, created: true };
}

function promoteFollowUpLeadToCreator(state, followUp, now = new Date().toISOString()) {
  if (!followUp) return null;
  const existingCreator = (Array.isArray(state?.creators) ? state.creators : [])
    .find((creator) =>
      text(creator.id) === text(followUp.creator_id) &&
      (!text(followUp.brand_id) || text(creator.brand_id) === text(followUp.brand_id)),
    );
  if (existingCreator) return existingCreator;
  const leadId = text(followUp.lead_id) ||
    (Array.isArray(state?.contactTracks) ? state.contactTracks : [])
      .find((track) => text(track.follow_up_id) === text(followUp.id) && text(track.person_type) === "lead")?.person_id;
  const lead = (Array.isArray(state?.leads) ? state.leads : []).find((item) => text(item.id) === leadId);
  if (!lead) return null;
  const track = (Array.isArray(state?.contactTracks) ? state.contactTracks : [])
    .find((item) => text(item.follow_up_id) === text(followUp.id) && text(item.person_type) === "lead") || {
      id: "",
      brand_id: text(followUp.brand_id || lead.brand_id),
      brand: text(followUp.brand || lead.brand),
      person_type: "lead",
      person_id: lead.id,
      person_name: lead.name,
      email: lead.email,
      mailbox_account_id: "",
    };
  const creator = ensureCreatorForContactTrack(state, track, now);
  if (!creator) return null;
  followUp.lead_id = lead.id;
  followUp.creator_id = creator.id;
  followUp.creator_name = creator.name;
  followUp.brand_id = text(followUp.brand_id || creator.brand_id);
  followUp.brand = text(followUp.brand || creator.brand);
  followUp.updatedAt = now;
  migrateLeadEventsToFollowUp(state, followUp, track, lead.id, creator.id, now);
  return creator;
}

function createFollowUpForTrack(state, track, record, now) {
  const sourceLeadId = text(track?.person_type) === "lead" ? text(track.person_id) : "";
  const creator = ensureCreatorForContactTrack(state, track, now);
  if (!creator) return null;
  const existing = activeFollowUps(state, creator.id)[0];
  if (existing) {
    migrateLeadEventsToFollowUp(state, existing, track, sourceLeadId, creator.id, now);
    return { followUp: existing, created: false };
  }
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
  migrateLeadEventsToFollowUp(state, followUp, track, sourceLeadId, creator.id, now);
  return { followUp, created: true };
}

function migrateLeadEventsToFollowUp(state, followUp, track, sourceLeadId, creatorId, now) {
  const trackId = text(track?.id);
  const brandId = text(followUp?.brand_id || track?.brand_id);
  if (!Array.isArray(state.followUpEvents)) return;
  state.followUpEvents.forEach((event) => {
    const sameTrack = trackId && text(event.contact_track_id) === trackId;
    const sameLead = sourceLeadId && text(event.lead_id) === sourceLeadId && text(event.brand_id) === brandId;
    if (!sameTrack && !sameLead) return;
    event.follow_up_id = followUp.id;
    event.person_type = "creator";
    event.person_id = creatorId;
    event.lead_id = sourceLeadId || text(event.lead_id);
    event.contact_track_id = trackId || text(event.contact_track_id);
    event.brand_id = brandId;
    event.brand = text(followUp.brand || event.brand);
    event.updatedAt = now;
  });
}

function upsertContactTrack(state, input = {}, now = new Date().toISOString()) {
  state.contactTracks = Array.isArray(state.contactTracks) ? state.contactTracks : [];
  const emails = emailsIn(input.email);
  const email = emails.join("; ");
  if (!emails.length || !text(input.brand_id)) return null;
  const found = state.contactTracks.find((track) =>
    text(track.brand_id) === text(input.brand_id) &&
    text(track.person_type) === text(input.person_type) &&
    text(track.person_id) === text(input.person_id) &&
    emailsIn(track.email).some((candidate) => emails.includes(candidate)) &&
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
  const threadIds = new Set([
    normalizeMessageId(record.in_reply_to),
    ...messageReferences(record.references),
  ].filter(Boolean));
  const threadEvent = threadIds.size
    ? (Array.isArray(state.followUpEvents) ? state.followUpEvents : []).find((event) => {
        if (!threadIds.has(normalizeMessageId(event.message_id))) return false;
        if (text(event.mailbox_account_id) && text(event.mailbox_account_id) !== text(account.id)) return false;
        const linkedFollowUp = (Array.isArray(state.followUps) ? state.followUps : [])
          .find((item) => text(item.id) === text(event.follow_up_id));
        const eventBrandId = text(event.brand_id);
        const followUpBrandId = text(linkedFollowUp?.brand_id);
        const resolvedBrandId = followUpBrandId || eventBrandId;
        // Legacy events may not have brand_id, so resolve through the follow-up.
        // Either way, the linked follow-up must belong to this mailbox scope.
        if (!linkedFollowUp ||
          !scope.includes(resolvedBrandId) ||
          (eventBrandId && followUpBrandId && eventBrandId !== followUpBrandId)) return false;
        // A thread header is only a routing hint. The actual sender/recipient
        // must still match the person attached to the follow-up.
        return directionForFollowUp(state, linkedFollowUp, record) !== "unknown";
      })
    : null;

  if (threadEvent?.follow_up_id) {
    const followUp = (Array.isArray(state.followUps) ? state.followUps : []).find((item) => text(item.id) === text(threadEvent.follow_up_id));
    const threadBrandId = text(threadEvent.brand_id);
    const followUpBrandId = text(followUp?.brand_id);
    const threadBrandMatches = !threadBrandId || !followUpBrandId || threadBrandId === followUpBrandId;
    const followUpInMailboxScope = scope.includes(followUpBrandId);
    if (followUp && threadBrandMatches && followUpInMailboxScope) {
      const direction = directionForFollowUp(state, followUp, record);
      if (direction === "inbound") promoteFollowUpLeadToCreator(state, followUp, now);
      const contactTrack = updateFollowUpContactTrack(state, followUp, record, account, direction, now);
      const replyProgress = direction === "inbound"
        ? updateFollowUpAfterInboundReply(followUp, now)
        : { stageAdvanced: false, terminal: false };
      if (direction === "outbound") {
        const creator = (Array.isArray(state.creators) ? state.creators : [])
          .find((person) => text(person.id) === text(followUp.creator_id));
        if (creator) updatePersonOutreachTimestamp(state, { ...creator, person_type: "creator" }, record.occurred_at, now);
      }
      return {
        kind: "followup",
        followUp,
        record: {
          ...record,
          direction,
          brand_id: followUp.brand_id,
          brand: followUp.brand,
        },
        matched: "thread",
        stageAdvancedFromReply: Boolean(replyProgress.stageAdvanced),
        terminalFollowUp: Boolean(replyProgress.terminal),
      };
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
      promoteFollowUpLeadToCreator(state, followUp, now);
      track.status = "replied";
      track.follow_up_id = followUp.id;
      track.replied_at = now;
      track.updatedAt = now;
      const replyProgress = updateFollowUpAfterInboundReply(followUp, now);
      return {
        kind: "followup",
        followUp,
        autoCreated: Boolean(followUpResult.created),
        record: { ...record, direction: "inbound", brand_id: followUp.brand_id, brand: followUp.brand },
        matched: "contact_track",
        stageAdvancedFromReply: Boolean(replyProgress.stageAdvanced),
        terminalFollowUp: Boolean(replyProgress.terminal),
      };
    }
  }

  if (inboundTracks.length > 1) directions.push("contact_track");
  if (inboundPeople.length === 1) {
    const person = inboundPeople[0];
    if (person.person_type === "creator") {
      const active = activeFollowUps(state, person.id);
      if (active.length === 1) {
        const followUp = active[0];
        const contactTrack = updateFollowUpContactTrack(state, followUp, record, account, "inbound", now);
        const replyProgress = updateFollowUpAfterInboundReply(followUp, now);
        return {
          kind: "followup",
          followUp,
          autoCreated: false,
          record: { ...record, direction: "inbound", brand_id: followUp.brand_id, brand: followUp.brand },
          matched: "active_followup_person",
          contactTrack,
          stageAdvancedFromReply: Boolean(replyProgress.stageAdvanced),
          terminalFollowUp: Boolean(replyProgress.terminal),
        };
      }
    }
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
        const replyProgress = updateFollowUpAfterInboundReply(followUp, now);
        return {
          kind: "followup",
          followUp,
          autoCreated: Boolean(followUpResult.created),
          record: { ...record, direction: "inbound", brand_id: followUp.brand_id, brand: followUp.brand },
          matched: "profile_outreach_window",
          stageAdvancedFromReply: Boolean(replyProgress.stageAdvanced),
          terminalFollowUp: Boolean(replyProgress.terminal),
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
    if (person.person_type === "lead") {
      const followUpResult = createWaitingFollowUpForLead(state, person, now);
      const followUp = followUpResult?.followUp;
      if (followUp) {
        track.follow_up_id = followUp.id;
        track.updatedAt = now;
        followUp.last_email_at = record.occurred_at;
        followUp.has_unread_reply = false;
        followUp.updatedAt = now;
        return {
          kind: "followup",
          followUp,
          autoCreated: Boolean(followUpResult.created),
          record: { ...record, direction: "outbound", lead_id: person.id, brand_id: followUp.brand_id, brand: followUp.brand },
          matched: "external_outbound_lead",
          stageAdvancedFromReply: false,
          terminalFollowUp: false,
        };
      }
    }
    if (person.person_type === "creator") {
      const active = activeFollowUps(state, person.id);
      if (active.length === 1) {
        const followUp = active[0];
        track.follow_up_id = followUp.id;
        track.updatedAt = now;
        followUp.last_email_at = record.occurred_at;
        followUp.has_unread_reply = false;
        followUp.updatedAt = now;
        return {
          kind: "followup",
          followUp,
          record: { ...record, direction: "outbound", brand_id: followUp.brand_id, brand: followUp.brand },
          matched: "external_outbound_followup",
          stageAdvancedFromReply: false,
          terminalFollowUp: false,
        };
      }
    }
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
  const incomingBody = text(record?.body);
  if (!existing || !incomingBody) return false;
  const existingBody = text(existing.body);
  const incomingTruncated = parseFlag(record.body_truncated);
  const existingTruncated = parseFlag(existing.body_truncated);
  const shouldRefresh = !existingBody || (existingTruncated && !incomingTruncated);
  if (!shouldRefresh) return false;
  existing.body = incomingBody;
  existing.body_cached_at = record.body_cached_at || now.toISOString();
  existing.body_retention_until = record.body_retention_until;
  existing.body_truncated = incomingTruncated;
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
    repliesMarkedUnread: 0,
    stagesAdvancedFromReplies: 0,
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
            if (routed.record.direction === "inbound") summary.repliesMarkedUnread += 1;
            if (routed.stageAdvancedFromReply) summary.stagesAdvancedFromReplies += 1;
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

function normalizeSignatureImageUrl(value) {
  const source = text(value);
  return /^https:\/\/[^\s<>"']+$/i.test(source) ? source.slice(0, 4000000) : "";
}

function normalizeSignatureImageData(value) {
  const source = text(value);
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source) && source.length <= 4000000
    ? source.replace(/\s/g, "")
    : "";
}

function removeGeneratedSignature(value) {
  const lines = compactBody(value).split("\n");
  const marker = lines.findIndex((line) =>
    /^\s*(best regards|best wishes|kind regards|warm regards|regards|sincerely|yours sincerely|感谢|此致|敬礼)\s*[,:]?\s*$/i.test(line),
  );
  return compactBody(marker >= 0 ? lines.slice(0, marker).join("\n") : lines.join("\n"));
}

function emailLinkLabel(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    if (/(amazon\.[a-z.]+|amzn\.to)$/i.test(hostname)) return "View product";
    return `Open ${hostname}`;
  } catch {
    return "Open link";
  }
}

function escapeEmailHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkifyEmailHtml(value) {
  const escaped = escapeEmailHtml(value);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const trailing = url.match(/[),.!?;:]+$/)?.[0] || "";
    const href = url.slice(0, url.length - trailing.length);
    return `<a href="${href}" style="color:#1565c0;text-decoration:underline;">${emailLinkLabel(href)}</a>${trailing}`;
  });
}

function signatureImageDetails(source = {}) {
  const imageData = normalizeSignatureImageData(source.signatureImageData);
  const imageUrl = normalizeSignatureImageUrl(source.signatureImageUrl);
  if (imageData) {
    const match = imageData.match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,(.+)$/i);
    if (match) {
      const cid = `signature-${createHash("sha256").update(imageData).digest("hex").slice(0, 16)}@resource-workbench`;
      return {
        src: `cid:${cid}`,
        cid,
        attachment: {
          filename: `signature.${match[1].split("/")[1].replace("jpeg", "jpg")}`,
          content: Buffer.from(match[2], "base64"),
          cid,
          contentType: match[1],
        },
      };
    }
  }
  return imageUrl ? { src: imageUrl, cid: "", attachment: null } : { src: "", cid: "", attachment: null };
}

function buildEmailHtml(body, signature = "", signatureImage = {}) {
  const bodyParagraphs = removeGeneratedSignature(body).split(/\n\s*\n/).filter(Boolean);
  const paragraphHtml = bodyParagraphs
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6;">${linkifyEmailHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const signatureText = compactBody(signature).slice(0, 4000);
  const image = signatureImageDetails(signatureImage);
  const imageHtml = image.src
    ? `<div style="margin-top:16px;"><img src="${escapeEmailHtml(image.src)}" alt="${escapeEmailHtml(signatureImage.signatureImageAlt || "Email signature")}" style="display:block;max-width:600px;height:auto;border:0;" /></div>`
    : "";
  const textHtml = signatureText
    ? `<div style="margin-top:20px;line-height:1.55;">${linkifyEmailHtml(signatureText).replace(/\n/g, "<br>")}</div>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;color:#111827;">${paragraphHtml || "<p></p>"}${imageHtml}${textHtml}</div>`;
}

function formatEmailContent(body, signature = "", signatureImage = {}) {
  const cleanBody = removeGeneratedSignature(body);
  const cleanSignature = compactBody(signature).slice(0, 4000);
  const plainText = [cleanBody, cleanSignature].filter(Boolean).join("\n\n");
  const image = signatureImageDetails(signatureImage);
  return {
    text: plainText,
    html: buildEmailHtml(cleanBody, cleanSignature, signatureImage),
    attachments: image.attachment ? [image.attachment] : [],
  };
}

function replyHeaderMessageId(value) {
  const id = text(value).replace(/[<>]/g, "");
  return id ? `<${id}>` : "";
}

async function sendMailAccount(settings, state, keyMaterial, input = {}) {
  const account = resolveMailAccount(settings, keyMaterial, input.accountId, "smtp");
  const subject = text(input.subject).slice(0, 500);
  const formatted = formatEmailContent(input.text, account.signatureText, account);
  const body = formatted.text;
  const followUpId = text(input.followUpId);
  const leadId = text(input.leadId);
  const brandId = text(input.brandId);
  if (!subject) throw new Error("请填写邮件主题。");
  if (!body) throw new Error("请填写邮件正文。");
  const nowDate = new Date();
  const policy = mailContentPolicy(settings);
  applyMailContentPolicy(state, settings, nowDate);

  let followUp = (Array.isArray(state.followUps) ? state.followUps : []).find((item) => text(item.id) === followUpId);
  const lead = (Array.isArray(state.leads) ? state.leads : []).find((item) => text(item.id) === leadId);
  if (!followUp && lead) followUp = findFollowUpForLead(state, lead.id, lead.brand_id);
  if (!followUp && !lead) throw new Error("未找到对应达人或合作跟进，无法保存发信记录。");
  const creator = followUp
    ? (Array.isArray(state.creators) ? state.creators : []).find((item) => text(item.id) === text(followUp.creator_id))
    : null;
  const target = followUp || lead;
  const targetBrandId = text(target.brand_id || creator?.brand_id);
  if (brandId && brandId !== targetBrandId) {
    throw new Error("发信品牌与当前达人或合作跟进不一致，已阻止发送。");
  }
  if (!accountBrandIds(account).includes(targetBrandId)) {
    throw new Error("所选官方邮箱不属于当前品牌工作区，无法跨品牌发送。");
  }
  const to = lead ? recipientList(lead.email) : recipientList(input.to);
  if (lead && text(lead.status) === "已转达人库") {
    throw new Error("该待开发达人已转入达人库，请从合作跟进中继续发信。");
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
    html: formatted.html,
    attachments: formatted.attachments,
    inReplyTo: referenceId || undefined,
    references: referenceId || undefined,
  });

  const now = nowDate.toISOString();
  if (lead && !followUp) {
    followUp = createWaitingFollowUpForLead(state, lead, now)?.followUp || null;
  }
  const track = lead
    ? upsertContactTrack(state, {
        brand_id: targetBrandId,
        brand: text(lead.brand),
        person_type: "lead",
        person_id: lead.id,
        person_name: text(lead.name || lead.handle || lead.social_url),
        email: to[0],
        mailbox_account_id: account.id,
        last_outbound_at: now,
        last_outbound_subject: subject,
        status: "waiting_reply",
        source: "smtp_lead_outreach",
        follow_up_id: followUp?.id || "",
      }, now)
    : null;
  const event = {
    id: `SMTP-${randomBytes(6).toString("hex").toUpperCase()}`,
    follow_up_id: followUp?.id || "",
    lead_id: lead?.id || "",
    person_type: lead ? "lead" : "creator",
    person_id: lead?.id || text(creator?.id || followUp?.creator_id),
    contact_track_id: track?.id || "",
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
    in_reply_to: text(replyToEvent?.message_id),
    references: referenceId ? [text(replyToEvent?.message_id)] : [],
    fingerprint: stableFingerprint([now, from, to.join(";"), subject, body]),
    source: `SMTP · ${account.label || account.smtp.user}`,
    mailbox: account.imap.sentFolder || "Sent",
    brand_id: targetBrandId,
    mailbox_account_id: account.id,
    createdAt: now,
    updatedAt: now,
  };
  state.followUpEvents = [event, ...(Array.isArray(state.followUpEvents) ? state.followUpEvents : [])];
  if (lead) {
    lead.status = "已联系";
    lead.first_contacted_at = text(lead.first_contacted_at) || now;
    lead.last_contacted_at = now;
    lead.last_outreach_at = now;
    lead.contact_channel = "SMTP 官方邮箱";
    lead.updatedAt = now;
    if (track) track.updatedAt = now;
    if (followUp) {
      followUp.last_email_at = now;
      followUp.has_unread_reply = false;
      followUp.updatedAt = now;
    }
  } else {
    upsertContactTrack(state, {
      brand_id: targetBrandId,
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
  }
  return { ok: true, accountId: account.id, leadId: lead?.id || "", followUpId: followUp?.id || "", event };
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
  createWaitingFollowUpForLead,
  promoteFollowUpLeadToCreator,
  upsertContactTrack,
  routeMailRecord,
  accountBrandIds,
  cacheBodyOnExistingRecord,
  findKnownMailRecord,
  recordDedupKeys,
  formatEmailContent,
  buildEmailHtml,
};
