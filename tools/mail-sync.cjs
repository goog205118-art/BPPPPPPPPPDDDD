const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const DEFAULT_MAIL_SETTINGS = {
  account: {
    enabled: false,
    label: "官邮 IMAP",
    host: "",
    port: 993,
    secure: true,
    user: "",
    passwordEncrypted: "",
    inboxFolder: "INBOX",
    sentFolder: "Sent",
    syncDays: 30,
  },
  lastSyncAt: "",
  lastSyncStatus: "",
  lastSyncSummary: null,
};

function text(value) {
  return String(value ?? "").trim();
}

function clampNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function emailsIn(value) {
  return [...new Set(String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.map(normalizeEmail) || [])];
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

function normalizeMailSettings(raw = {}, existing = {}, keyMaterial) {
  const source = raw && typeof raw === "object" ? raw : {};
  const accountInput = source.account && typeof source.account === "object" ? source.account : source;
  const oldSettings = existing && typeof existing === "object" ? existing : {};
  const oldAccount = oldSettings.account && typeof oldSettings.account === "object" ? oldSettings.account : {};
  const password = text(accountInput.password);
  const clearPassword = accountInput.clearPassword === true;
  const previousEncrypted = text(oldAccount.passwordEncrypted);

  return {
    ...DEFAULT_MAIL_SETTINGS,
    ...oldSettings,
    account: {
      ...DEFAULT_MAIL_SETTINGS.account,
      ...oldAccount,
      enabled: accountInput.enabled === undefined ? Boolean(oldAccount.enabled) : Boolean(accountInput.enabled),
      label: text(accountInput.label || oldAccount.label || DEFAULT_MAIL_SETTINGS.account.label).slice(0, 80),
      host: text(accountInput.host || oldAccount.host).replace(/^imap:\/\//i, "").replace(/\/.*$/, "").slice(0, 255),
      port: clampNumber(accountInput.port ?? oldAccount.port, DEFAULT_MAIL_SETTINGS.account.port, 1, 65535),
      secure: accountInput.secure === undefined ? oldAccount.secure !== false : Boolean(accountInput.secure),
      user: text(accountInput.user || oldAccount.user).slice(0, 320),
      passwordEncrypted: password ? encryptSecret(password, keyMaterial) : clearPassword ? "" : previousEncrypted,
      inboxFolder: text(accountInput.inboxFolder || oldAccount.inboxFolder || "INBOX").slice(0, 160),
      sentFolder: text(accountInput.sentFolder || oldAccount.sentFolder || "Sent").slice(0, 160),
      syncDays: clampNumber(accountInput.syncDays ?? oldAccount.syncDays, DEFAULT_MAIL_SETTINGS.account.syncDays, 1, 90),
    },
    lastSyncAt: text(oldSettings.lastSyncAt),
    lastSyncStatus: text(oldSettings.lastSyncStatus),
    lastSyncSummary: oldSettings.lastSyncSummary && typeof oldSettings.lastSyncSummary === "object" ? oldSettings.lastSyncSummary : null,
  };
}

function publicMailSettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  const rawAccount = source.account && typeof source.account === "object" ? source.account : {};
  const account = {
    ...DEFAULT_MAIL_SETTINGS.account,
    ...rawAccount,
  };
  return {
    account: {
      enabled: Boolean(account.enabled),
      label: text(account.label || DEFAULT_MAIL_SETTINGS.account.label),
      host: text(account.host),
      port: clampNumber(account.port, DEFAULT_MAIL_SETTINGS.account.port, 1, 65535),
      secure: account.secure !== false,
      user: text(account.user),
      hasPassword: Boolean(account.passwordEncrypted),
      inboxFolder: text(account.inboxFolder || DEFAULT_MAIL_SETTINGS.account.inboxFolder),
      sentFolder: text(account.sentFolder || DEFAULT_MAIL_SETTINGS.account.sentFolder),
      syncDays: clampNumber(account.syncDays, DEFAULT_MAIL_SETTINGS.account.syncDays, 1, 90),
    },
    lastSyncAt: text(source.lastSyncAt),
    lastSyncStatus: text(source.lastSyncStatus),
    lastSyncSummary: source.lastSyncSummary && typeof source.lastSyncSummary === "object" ? source.lastSyncSummary : null,
  };
}

function resolveMailAccount(settings, keyMaterial) {
  const normalized = normalizeMailSettings({ account: settings?.account || {} }, settings || {}, keyMaterial);
  const account = normalized.account;
  const password = account.passwordEncrypted ? decryptSecret(account.passwordEncrypted, keyMaterial) : "";
  if (!account.host) throw new Error("请先填写 IMAP 服务器地址。");
  if (!account.user) throw new Error("请先填写邮箱账号。");
  if (!password) throw new Error("请先填写邮箱授权码或专用密码。");
  return { ...account, password };
}

function createImapClient(account) {
  return new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure !== false,
    auth: { user: account.user, pass: account.password },
    logger: false,
    socketTimeout: 25000,
    greetingTimeout: 25000,
    connectionTimeout: 25000,
    tls: { minVersion: "TLSv1.2" },
  });
}

async function testMailConnection(settings, keyMaterial) {
  const account = resolveMailAccount(settings, keyMaterial);
  const client = createImapClient(account);
  try {
    await client.connect();
    const inbox = await client.mailboxOpen(account.inboxFolder, { readOnly: true });
    return {
      ok: true,
      mailbox: account.inboxFolder,
      messageCount: Number(inbox.exists || 0),
      account: account.user,
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

function findCreatorMatches(state, emailAddresses) {
  const all = new Set(emailAddresses.map(normalizeEmail).filter(Boolean));
  if (!all.size) return [];
  return (Array.isArray(state.creators) ? state.creators : []).filter((creator) => emailsIn(creator.email).some((email) => all.has(email)));
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

function knownMessageKeys(state) {
  return new Set(
    [...(Array.isArray(state.followUpEvents) ? state.followUpEvents : []), ...(Array.isArray(state.mailInbox) ? state.mailInbox : [])]
      .flatMap((event) => [text(event.message_id), text(event.fingerprint), text(event.server_key)])
      .filter(Boolean),
  );
}

function makeMailRecord(parsed, message, mailbox, account, creator, now) {
  const sender = addressText(parsed.from);
  const recipients = [addressText(parsed.to), addressText(parsed.cc)].filter(Boolean).join("；");
  const senderEmails = addressEmails(parsed.from);
  const recipientEmails = [...addressEmails(parsed.to), ...addressEmails(parsed.cc)];
  const occurred = parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : message.internalDate instanceof Date ? message.internalDate : now;
  const occurredAt = occurred.toISOString();
  const subject = text(parsed.subject).slice(0, 500);
  const messageId = text(parsed.messageId).replace(/[<>]/g, "");
  const excerpt = cleanExcerpt(parsed.text || parsed.html || "");
  const uid = text(message.uid || message.seq || "");
  const serverKey = `${account.host}|${account.user}|${mailbox}|${uid}`;
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
    source: `IMAP · ${account.label || account.user}`,
    mailbox,
    server_key: serverKey,
    imap_uid: uid,
    createdAt: now.toISOString(),
  };
}

async function syncMailAccount(settings, state, keyMaterial, options = {}) {
  const account = resolveMailAccount(settings, keyMaterial);
  const client = createImapClient(account);
  const now = new Date();
  const maxPerFolder = clampNumber(options.maxPerFolder, 120, 1, 250);
  const since = new Date(now.getTime() - account.syncDays * 24 * 60 * 60 * 1000);
  const folders = [...new Set([account.inboxFolder, account.sentFolder].map(text).filter(Boolean))];
  const summary = {
    scanned: 0,
    added: 0,
    matched: 0,
    pending: 0,
    skipped: 0,
    warnings: [],
    folders: {},
  };
  const knownKeys = knownMessageKeys(state);
  state.followUpEvents = Array.isArray(state.followUpEvents) ? state.followUpEvents : [];
  state.mailInbox = Array.isArray(state.mailInbox) ? state.mailInbox : [];

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
          const candidates = findCreatorMatches(state, allEmails);
          const creator = candidates.length === 1 ? candidates[0] : null;
          const record = makeMailRecord(parsed, message, folder, account, creator, now);
          const keys = [record.message_id, record.fingerprint, record.server_key].filter(Boolean);
          if (keys.some((key) => knownKeys.has(key))) {
            summary.skipped += 1;
            continue;
          }
          keys.forEach((key) => knownKeys.add(key));
          if (creator) {
            const followUps = activeFollowUps(state, creator.id);
            if (followUps.length === 1) {
              const followUp = followUps[0];
              const event = { ...record, follow_up_id: followUp.id };
              state.followUpEvents.unshift(event);
              followUp.last_email_at = record.occurred_at;
              followUp.updatedAt = now.toISOString();
              summary.added += 1;
              summary.matched += 1;
              summary.folders[folder].added += 1;
              continue;
            }
          }

          const status = candidates.length > 1 ? "ambiguous_creator" : creator ? "needs_followup" : "unmatched";
          state.mailInbox.unshift({
            ...record,
            status,
            matched_creator_id: creator?.id || "",
            matched_creator_name: creator?.name || "",
            candidate_creator_ids: candidates.map((item) => item.id),
            candidate_follow_up_ids: creator ? activeFollowUps(state, creator.id).map((item) => item.id) : [],
          });
          summary.added += 1;
          summary.pending += 1;
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

module.exports = {
  DEFAULT_MAIL_SETTINGS,
  normalizeMailSettings,
  publicMailSettings,
  testMailConnection,
  syncMailAccount,
};
