const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  routeMailRecord,
  cacheBodyOnExistingRecord,
  findKnownMailRecord,
  recordDedupKeys,
  createWaitingFollowUpForLead,
  promoteFollowUpLeadToCreator,
  normalizeMailSettings,
  publicMailSettings,
  formatEmailContent,
} = require("./mail-sync.cjs");

const rootDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const storageDir = path.join(os.tmpdir(), `resource-workbench-followup-test-${process.pid}-${Date.now()}`);
const port = 44000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let fakeAiServer;
let fakeAiBaseUrl = "";
const fakeAiRequests = [];

function emptyState() {
  return {
    meta: { version: 1, updatedAt: "2026-08-25T00:00:00.000Z" },
    brands: [],
    creators: [],
    resources: [],
    leads: [],
    products: [],
    cooperations: [],
    matches: [],
    followUps: [],
    followUpEvents: [],
    mailInbox: [],
    contactTracks: [],
    importHistory: [],
  };
}

function assertEmailFormatting() {
  const formatted = formatEmailContent(
    [
      "Hi creator,",
      "",
      "We would love to explore a collaboration.",
      "",
      "View the product: https://www.amazon.in/dp/B0GHR62CPZ?th=1",
      "",
      "Best Regards",
      "AI Generated Team",
    ].join("\n"),
    "Best Regards\nHSU Shop Team\n\nWebsite: https://hsushop.com/\n\nHappy Share Up",
  );
  assert.match(formatted.text, /HSU Shop Team/);
  assert.match(formatted.text, /Website: https:\/\/hsushop\.com\//);
  assert.doesNotMatch(formatted.text, /AI Generated Team/);
  assert.doesNotMatch(formatted.text, /<a |<\/div>/);
  assert.match(formatted.html, /View product/);
  assert.match(formatted.html, /href="https:\/\/www\.amazon\.in\/dp\/B0GHR62CPZ\?th=1"/);
  assert.match(formatted.html, /HSU Shop Team/);
  assert.equal((formatted.text.match(/Best Regards/g) || []).length, 1, "AI 签名和账户签名不能重复保存。");

  const settings = normalizeMailSettings({
    accounts: [{
      id: "MB-SIGNATURE",
      brand_ids: ["BR-A"],
      label: "测试官方邮箱",
      signatureText: "Best Regards\nBrand Team",
    }],
  }, {}, "signature-test-key");
  const publicSettings = publicMailSettings(settings);
  assert.equal(publicSettings.accounts[0].signatureText, "Best Regards\nBrand Team");
}

function assertContactTrackRouting() {
  const now = new Date().toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const singleBrandState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    leads: [{
      id: "LEAD-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "待开发达人 A",
      email: "lead-a@example.com",
      status: "已联系",
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "CT-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      person_type: "lead",
      person_id: "LEAD-A",
      person_name: "待开发达人 A",
      email: "lead-a@example.com",
      mailbox_account_id: "MB-A",
      last_outbound_at: now,
      status: "waiting_reply",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const singleAccount = { id: "MB-A", brand_ids: ["BR-A"] };
  const uniqueReply = routeMailRecord(singleBrandState, {
    id: "MAIL-A",
    sender: "待开发达人 A <lead-a@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "reply-a@example.com",
    fingerprint: "reply-a",
    mailbox_account_id: "MB-A",
  }, singleAccount, now);
  assert.equal(uniqueReply.kind, "followup", "唯一等待回复应直接归档到合作跟进。");
  assert.equal(uniqueReply.matched, "contact_track");
  assert.equal(uniqueReply.autoCreated, true, "首次唯一回复应准确标记为自动新建跟进。");
  assert.equal(singleBrandState.followUps.length, 1);
  assert.equal(singleBrandState.followUps[0].stage, "初步沟通");
  assert.equal(singleBrandState.creators.length, 1, "待开发达人收到唯一回复后应转入达人库。");
  assert.equal(singleBrandState.leads[0].status, "已转达人库");
  assert.equal(singleBrandState.contactTracks[0].person_type, "creator");
  assert.equal(singleBrandState.contactTracks[0].follow_up_id, singleBrandState.followUps[0].id);

  const sharedMailboxUniqueOutboundState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }, { id: "BR-B", name: "品牌 B" }],
    creators: [{
      id: "CR-UNIQUE",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "达人唯一",
      email: "unique@example.com",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const uniqueOutbound = routeMailRecord(sharedMailboxUniqueOutboundState, {
    id: "MAIL-UNIQUE-OUTBOUND",
    sender: "品牌团队 <outreach@example.com>",
    recipients: "达人唯一 <unique@example.com>",
    subject: "Collaboration",
    occurred_at: now,
    message_id: "outbound-unique@example.com",
    fingerprint: "outbound-unique",
    mailbox_account_id: "MB-SHARED",
  }, { id: "MB-SHARED", brand_ids: ["BR-A", "BR-B"] }, now);
  assert.equal(uniqueOutbound.kind, "tracked_outbound", "共享邮箱下唯一匹配的已发送邮件应自动建立待回复轨迹。");
  assert.equal(sharedMailboxUniqueOutboundState.contactTracks.length, 1);
  assert.equal(sharedMailboxUniqueOutboundState.contactTracks[0].brand_id, "BR-A");
  assert.equal(sharedMailboxUniqueOutboundState.contactTracks[0].status, "waiting_reply");
  assert.equal(sharedMailboxUniqueOutboundState.creators[0].last_outreach_at, now, "已发送邮件同步应回写达人最近首联/复联时间。");

  const sharedMailboxUniqueInboundState = {
    ...emptyState(),
    brands: [{ id: "BR-IN", name: "印度品牌" }, { id: "BR-JP", name: "日本品牌" }, { id: "BR-US", name: "欧美品牌" }],
    creators: [{
      id: "CR-JP",
      brand_id: "BR-JP",
      brand: "日本品牌",
      name: "日本达人",
      email: "jp-creator@example.com",
      last_outreach_at: fiveDaysAgo,
      createdAt: now,
      updatedAt: now,
    }],
  };
  const threeBrandAccount = { id: "MB-THREE", brand_ids: ["BR-IN", "BR-JP", "BR-US"] };
  const uniqueInbound = routeMailRecord(sharedMailboxUniqueInboundState, {
    id: "MAIL-JP-INBOUND",
    sender: "日本达人 <jp-creator@example.com>",
    recipients: "品牌团队 <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "jp-inbound@example.com",
    fingerprint: "jp-inbound",
    mailbox_account_id: "MB-THREE",
  }, threeBrandAccount, now);
  assert.equal(uniqueInbound.kind, "followup", "三品牌共享邮箱下，唯一匹配到日本达人的回信应自动进入日本品牌跟进。");
  assert.equal(uniqueInbound.followUp.brand_id, "BR-JP");
  assert.equal(sharedMailboxUniqueInboundState.followUps.length, 1);

  const unmatchedThreeBrand = routeMailRecord({
    ...emptyState(),
    brands: sharedMailboxUniqueInboundState.brands,
  }, {
    id: "MAIL-UNMATCHED",
    sender: "陌生发件人 <unknown@example.com>",
    recipients: "品牌团队 <outreach@example.com>",
    subject: "Hello",
    occurred_at: now,
    message_id: "unmatched@example.com",
    fingerprint: "unmatched",
    mailbox_account_id: "MB-THREE",
  }, threeBrandAccount, now);
  assert.equal(unmatchedThreeBrand.kind, "inbox");
  assert.equal(unmatchedThreeBrand.status, "unmatched", "未匹配邮件不能被错误归属到共享邮箱的首个品牌。");
  assert.equal(unmatchedThreeBrand.record.brand_id, "");
  assert.deepEqual(unmatchedThreeBrand.candidateBrandIds, ["BR-IN", "BR-JP", "BR-US"]);

  const sameBrandDuplicateState = {
    ...emptyState(),
    brands: [{ id: "BR-IN", name: "印度品牌" }, { id: "BR-JP", name: "日本品牌" }, { id: "BR-US", name: "欧美品牌" }],
    creators: [
      { id: "CR-IN-1", brand_id: "BR-IN", brand: "印度品牌", name: "印度达人 1", email: "duplicate@example.com", createdAt: now, updatedAt: now },
      { id: "CR-IN-2", brand_id: "BR-IN", brand: "印度品牌", name: "印度达人 2", email: "duplicate@example.com", createdAt: now, updatedAt: now },
    ],
  };
  const sameBrandDuplicate = routeMailRecord(sameBrandDuplicateState, {
    id: "MAIL-DUPLICATE",
    sender: "同邮箱达人 <duplicate@example.com>",
    recipients: "品牌团队 <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "duplicate@example.com",
    fingerprint: "duplicate",
    mailbox_account_id: "MB-THREE",
  }, threeBrandAccount, now);
  assert.equal(sameBrandDuplicate.kind, "inbox");
  assert.equal(sameBrandDuplicate.status, "ambiguous_creator", "同一品牌内的重复达人应只要求选择达人，不应误报品牌冲突。");
  assert.equal(sameBrandDuplicate.record.brand_id, "BR-IN");

  const profileWindowState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{
      id: "CR-PROFILE",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "资料时间达人",
      email: "profile-window@example.com",
      last_outreach_at: fiveDaysAgo,
      createdAt: now,
      updatedAt: now,
    }],
  };
  const profileWindowReply = routeMailRecord(profileWindowState, {
    id: "MAIL-PROFILE-WINDOW",
    sender: "资料时间达人 <profile-window@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "profile-window-reply@example.com",
    fingerprint: "profile-window-reply",
    mailbox_account_id: "MB-A",
  }, singleAccount, now);
  assert.equal(profileWindowReply.kind, "followup", "未建立待回复轨迹时，应以资料中的最近发件时间兜底匹配。");
  assert.equal(profileWindowReply.matched, "profile_outreach_window");
  assert.equal(profileWindowState.followUps.length, 1);
  assert.equal(profileWindowState.followUps[0].stage, "初步沟通");
  assert.equal(profileWindowState.contactTracks[0].last_outbound_at, fiveDaysAgo);

  const expiredProfileWindowState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{
      id: "CR-EXPIRED",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "过期窗口达人",
      email: "expired-window@example.com",
      last_outreach_at: thirtyOneDaysAgo,
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "CT-EXPIRED",
      brand_id: "BR-A",
      brand: "品牌 A",
      person_type: "creator",
      person_id: "CR-EXPIRED",
      person_name: "过期窗口达人",
      email: "expired-window@example.com",
      mailbox_account_id: "MB-A",
      last_outbound_at: thirtyOneDaysAgo,
      status: "waiting_reply",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const expiredProfileReply = routeMailRecord(expiredProfileWindowState, {
    id: "MAIL-EXPIRED-WINDOW",
    sender: "过期窗口达人 <expired-window@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "expired-window-reply@example.com",
    fingerprint: "expired-window-reply",
    mailbox_account_id: "MB-A",
  }, singleAccount, now);
  assert.equal(expiredProfileReply.kind, "inbox", "超过 30 天的回信不得自动进入合作跟进。");
  assert.equal(expiredProfileWindowState.followUps.length, 0);

  const longRunningFollowUpState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{
      id: "CR-LONG",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "长期跟进达人",
      email: "long-running@example.com",
      createdAt: now,
      updatedAt: now,
    }],
    followUps: [{
      id: "FU-LONG",
      brand_id: "BR-A",
      brand: "品牌 A",
      creator_id: "CR-LONG",
      creator_name: "长期跟进达人",
      stage: "合作协商",
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "CT-LONG",
      brand_id: "BR-A",
      brand: "品牌 A",
      person_type: "creator",
      person_id: "CR-LONG",
      person_name: "长期跟进达人",
      email: "long-running@example.com",
      mailbox_account_id: "MB-A",
      last_outbound_at: thirtyOneDaysAgo,
      status: "waiting_reply",
      follow_up_id: "FU-LONG",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const longRunningReply = routeMailRecord(longRunningFollowUpState, {
    id: "MAIL-LONG-RUNNING",
    sender: "长期跟进达人 <long-running@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "long-running-reply@example.com",
    fingerprint: "long-running-reply",
    mailbox_account_id: "MB-A",
  }, singleAccount, now);
  assert.equal(longRunningReply.kind, "followup", "已有活跃合作跟进即使超过 30 天也应继续归档回信。");
  assert.equal(longRunningReply.followUp.id, "FU-LONG");
  assert.equal(longRunningReply.followUp.stage, "合作协商", "长期跟进收到回信不得倒退阶段。");

  const promotedLeadState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{
      id: "CR-PROMOTED",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "已转库达人",
      email: "promoted@example.com",
      createdAt: now,
      updatedAt: now,
    }],
    leads: [{
      id: "LEAD-PROMOTED",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "旧待开发记录",
      email: "promoted@example.com",
      status: "已转达人库",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const promotedReply = routeMailRecord(promotedLeadState, {
    id: "MAIL-PROMOTED",
    sender: "已转库达人 <promoted@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Hello",
    occurred_at: now,
    message_id: "promoted@example.com",
    fingerprint: "promoted",
    mailbox_account_id: "MB-A",
  }, singleAccount, now);
  assert.equal(promotedReply.status, "needs_followup", "已转入达人库的旧线索不能继续参与邮箱身份匹配；正式达人命中但无跟进时应进入人工建跟进区。");
  assert.equal(promotedReply.record.brand_id, "BR-A");
  assert.equal(promotedReply.people.length, 1);
  assert.equal(promotedReply.people[0].person_type, "creator");

  const legacyThreadState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{ id: "CR-LEGACY", brand_id: "BR-A", brand: "品牌 A", name: "旧线程达人", email: "legacy-thread@example.com", createdAt: now, updatedAt: now }],
    followUps: [{ id: "FU-LEGACY", brand_id: "BR-A", brand: "品牌 A", creator_id: "CR-LEGACY", creator_name: "旧线程达人", stage: "初步沟通", createdAt: now, updatedAt: now }],
    followUpEvents: [{
      id: "EV-LEGACY",
      follow_up_id: "FU-LEGACY",
      type: "mail_sent",
      direction: "outbound",
      recipients: "旧线程达人 <legacy-thread@example.com>",
      message_id: "legacy-root@example.com",
      mailbox_account_id: "MB-A",
      occurred_at: now,
      createdAt: now,
      updatedAt: now,
    }],
  };
  const legacyThreadReply = routeMailRecord(legacyThreadState, {
    id: "MAIL-LEGACY-THREAD",
    sender: "旧线程达人 <legacy-thread@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    in_reply_to: "legacy-root@example.com",
    message_id: "legacy-reply@example.com",
    fingerprint: "legacy-reply",
    occurred_at: now,
    mailbox_account_id: "MB-A",
  }, singleAccount, now);
  assert.equal(legacyThreadReply.kind, "followup", "缺少历史事件品牌字段时应通过跟进品牌恢复线程归档。");

  const sharedMailboxState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }, { id: "BR-B", name: "品牌 B" }],
    creators: [
      { id: "CR-A", brand_id: "BR-A", brand: "品牌 A", name: "达人 A", email: "shared@example.com", createdAt: now, updatedAt: now },
      { id: "CR-B", brand_id: "BR-B", brand: "品牌 B", name: "达人 B", email: "shared@example.com", createdAt: now, updatedAt: now },
    ],
    contactTracks: [
      { id: "CT-A", brand_id: "BR-A", brand: "品牌 A", person_type: "creator", person_id: "CR-A", person_name: "达人 A", email: "shared@example.com", mailbox_account_id: "MB-SHARED", status: "waiting_reply", createdAt: now, updatedAt: now },
      { id: "CT-B", brand_id: "BR-B", brand: "品牌 B", person_type: "creator", person_id: "CR-B", person_name: "达人 B", email: "shared@example.com", mailbox_account_id: "MB-SHARED", status: "waiting_reply", createdAt: now, updatedAt: now },
    ],
  };
  const sharedReply = routeMailRecord(sharedMailboxState, {
    id: "MAIL-SHARED",
    sender: "Unknown Creator <shared@example.com>",
    recipients: "品牌团队 <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "reply-shared@example.com",
    fingerprint: "reply-shared",
    mailbox_account_id: "MB-SHARED",
  }, { id: "MB-SHARED", brand_ids: ["BR-A", "BR-B"] }, now);
  assert.equal(sharedReply.kind, "inbox", "共享邮箱歧义邮件应停留在待人工归档邮箱。");
  assert.equal(sharedReply.status, "needs_brand_confirmation");
  assert.equal(sharedMailboxState.followUps.length, 0, "共享邮箱有品牌歧义时不得自动创建合作跟进。");

  const referencesThreadState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{ id: "CR-THREAD", brand_id: "BR-A", brand: "品牌 A", name: "线程达人", email: "thread@example.com", createdAt: now, updatedAt: now }],
    followUps: [{ id: "FU-THREAD", brand_id: "BR-A", brand: "品牌 A", creator_id: "CR-THREAD", creator_name: "线程达人", stage: "合作协商", createdAt: now, updatedAt: now }],
    followUpEvents: [{
      id: "EV-THREAD",
      brand_id: "BR-A",
      follow_up_id: "FU-THREAD",
      type: "mail_sent",
      direction: "outbound",
      sender: "品牌 A <outreach@example.com>",
      recipients: "线程达人 <thread@example.com>",
      message_id: "root-thread@example.com",
      occurred_at: now,
      createdAt: now,
      updatedAt: now,
    }],
  };
  const referencesReply = routeMailRecord(referencesThreadState, {
    id: "MAIL-THREAD-REPLY",
    sender: "线程达人 <thread@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    references: "<root-thread@example.com>",
    message_id: "thread-reply@example.com",
    fingerprint: "thread-reply",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.equal(referencesReply.kind, "followup", "旧格式字符串 References 也应续接到原合作跟进。");
  assert.equal(referencesReply.matched, "thread");
  assert.equal(referencesReply.record.direction, "inbound", "达人回信在线程续接时必须保持收件方向。");
  assert.equal(referencesReply.followUp.has_unread_reply, true, "线程回信应在跟进卡片上保留新回复高亮。");
  assert.equal(referencesReply.stageAdvancedFromReply, false, "已经进入合作协商的跟进不得因回信倒退到初步沟通。");

  const waitingThreadState = {
    ...referencesThreadState,
    followUps: [{
      ...referencesThreadState.followUps[0],
      id: "FU-WAITING-THREAD",
      stage: "已联系待回复",
    }],
    followUpEvents: [{
      ...referencesThreadState.followUpEvents[0],
      id: "EV-WAITING-THREAD",
      follow_up_id: "FU-WAITING-THREAD",
      message_id: "waiting-root-thread@example.com",
    }],
    contactTracks: [{
      id: "CT-WAITING-THREAD",
      brand_id: "BR-A",
      brand: "品牌 A",
      person_type: "creator",
      person_id: "CR-THREAD",
      person_name: "线程达人",
      email: "thread@example.com",
      mailbox_account_id: "MB-A",
      last_outbound_at: now,
      status: "waiting_reply",
      follow_up_id: "FU-WAITING-THREAD",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const waitingThreadReply = routeMailRecord(waitingThreadState, {
    id: "MAIL-WAITING-THREAD-REPLY",
    sender: "线程达人 <thread@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    in_reply_to: "waiting-root-thread@example.com",
    message_id: "waiting-thread-reply@example.com",
    fingerprint: "waiting-thread-reply",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.equal(waitingThreadReply.kind, "followup");
  assert.equal(waitingThreadReply.stageAdvancedFromReply, true, "明确等待回复的线程收到达人回信后应进入初步沟通。");
  assert.equal(waitingThreadReply.followUp.stage, "初步沟通");
  assert.equal(waitingThreadReply.followUp.has_unread_reply, true);

  const outboundThread = routeMailRecord(referencesThreadState, {
    id: "MAIL-THREAD-OUTBOUND",
    sender: "品牌 A <outreach@example.com>",
    recipients: "线程达人 <thread@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    in_reply_to: "root-thread@example.com",
    message_id: "thread-outbound@example.com",
    fingerprint: "thread-outbound",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.equal(outboundThread.kind, "followup");
  assert.equal(outboundThread.matched, "thread");
  assert.equal(outboundThread.record.direction, "outbound", "我方已发送线程续接时必须保持发件方向，不能触发新回复提醒。");

  const threadedTrackState = {
    ...referencesThreadState,
    contactTracks: [{
      id: "CT-THREAD",
      brand_id: "BR-A",
      brand: "品牌 A",
      person_type: "creator",
      person_id: "CR-THREAD",
      person_name: "线程达人",
      email: "thread@example.com",
      mailbox_account_id: "MB-A",
      last_outbound_at: now,
      status: "waiting_reply",
      follow_up_id: "FU-THREAD",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const threadedInbound = routeMailRecord(threadedTrackState, {
    id: "MAIL-THREAD-INBOUND-TRACK",
    sender: "线程达人 <thread@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    in_reply_to: "root-thread@example.com",
    message_id: "thread-inbound-track@example.com",
    fingerprint: "thread-inbound-track",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.equal(threadedInbound.record.direction, "inbound");
  assert.equal(threadedTrackState.contactTracks[0].status, "replied", "已有跟进收到线程回信后，等待回复轨迹必须结束。");
  assert.equal(threadedInbound.followUp.has_unread_reply, true, "已有跟进收到线程回信后必须显示未读高亮。");

  const threadedOutbound = routeMailRecord(threadedTrackState, {
    id: "MAIL-THREAD-OUTBOUND-TRACK",
    sender: "品牌 A <outreach@example.com>",
    recipients: "线程达人 <thread@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    in_reply_to: "root-thread@example.com",
    message_id: "thread-outbound-track@example.com",
    fingerprint: "thread-outbound-track",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.equal(threadedOutbound.record.direction, "outbound");
  assert.equal(threadedTrackState.contactTracks[0].status, "waiting_reply", "外部邮箱发出线程跟进后，轨迹必须重新等待达人回复。");
  assert.equal(threadedTrackState.creators[0].last_outreach_at, now, "外部邮箱发出的线程跟进应回写达人最近发件时间。");

  const multiEmailState = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "品牌 A" }],
    creators: [{
      id: "CR-MULTI-EMAIL",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "多邮箱达人",
      email: "primary@example.com; backup@example.com",
      createdAt: now,
      updatedAt: now,
    }],
    followUps: [{
      id: "FU-MULTI-EMAIL",
      brand_id: "BR-A",
      brand: "品牌 A",
      creator_id: "CR-MULTI-EMAIL",
      creator_name: "多邮箱达人",
      stage: "初步沟通",
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "CT-MULTI-EMAIL",
      brand_id: "BR-A",
      brand: "品牌 A",
      person_type: "creator",
      person_id: "CR-MULTI-EMAIL",
      person_name: "多邮箱达人",
      email: "primary@example.com",
      mailbox_account_id: "MB-A",
      last_outbound_at: now,
      status: "waiting_reply",
      follow_up_id: "FU-MULTI-EMAIL",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const backupEmailReply = routeMailRecord(multiEmailState, {
    id: "MAIL-BACKUP-EMAIL-REPLY",
    sender: "多邮箱达人 <backup@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    message_id: "backup-email-reply@example.com",
    fingerprint: "backup-email-reply",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.equal(backupEmailReply.kind, "followup", "达人使用资料中的备用邮箱回信时仍应命中同一合作跟进。");
  assert.equal(backupEmailReply.followUp.id, "FU-MULTI-EMAIL");
  assert.equal(multiEmailState.contactTracks[0].status, "replied");
  assert.equal(multiEmailState.contactTracks[0].email, "primary@example.com; backup@example.com", "命中备用邮箱后应补齐并规范化达人全部邮箱。");

  const wrongThreadPersonState = {
    ...referencesThreadState,
    creators: [
      ...referencesThreadState.creators,
      { id: "CR-WRONG-PERSON", brand_id: "BR-A", brand: "品牌 A", name: "另一位达人", email: "other@example.com", createdAt: now, updatedAt: now },
    ],
  };
  const wrongThreadPerson = routeMailRecord(wrongThreadPersonState, {
    id: "MAIL-WRONG-THREAD-PERSON",
    sender: "另一位达人 <other@example.com>",
    recipients: "品牌 A <outreach@example.com>",
    subject: "Re: Collaboration",
    occurred_at: now,
    in_reply_to: "root-thread@example.com",
    message_id: "wrong-thread-person@example.com",
    fingerprint: "wrong-thread-person",
    mailbox_account_id: "MB-A",
  }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
  assert.notEqual(wrongThreadPerson.kind, "followup", "线程头命中历史 Message-ID 但收发人不是该达人时不得错误归档。");
  assert.equal(wrongThreadPerson.status, "needs_followup", "错误线程归属应退回待人工绑定，而不是静默写入错误跟进。");
  assert.equal(wrongThreadPerson.record.brand_id, "BR-A");

  for (const terminalStage of ["已结案", "暂停跟进", "未谈妥"]) {
    const terminalState = {
      ...emptyState(),
      brands: [{ id: "BR-A", name: "品牌 A" }],
      creators: [{ id: "CR-TERMINAL", brand_id: "BR-A", brand: "品牌 A", name: "终止状态达人", email: "terminal@example.com", createdAt: now, updatedAt: now }],
      followUps: [{
        id: `FU-${terminalStage}`,
        brand_id: "BR-A",
        brand: "品牌 A",
        creator_id: "CR-TERMINAL",
        creator_name: "终止状态达人",
        stage: terminalStage,
        createdAt: now,
        updatedAt: now,
      }],
      followUpEvents: [{
        id: `EV-${terminalStage}`,
        brand_id: "BR-A",
        follow_up_id: `FU-${terminalStage}`,
        type: "mail_sent",
        direction: "outbound",
        sender: "品牌 A <outreach@example.com>",
        recipients: "终止状态达人 <terminal@example.com>",
        message_id: `root-${terminalStage}@example.com`,
        occurred_at: now,
        createdAt: now,
        updatedAt: now,
      }],
    };
    const terminalReply = routeMailRecord(terminalState, {
      id: `MAIL-${terminalStage}`,
      sender: "终止状态达人 <terminal@example.com>",
      recipients: "品牌 A <outreach@example.com>",
      subject: "Re: Collaboration",
      occurred_at: now,
      in_reply_to: `root-${terminalStage}@example.com`,
      message_id: `reply-${terminalStage}@example.com`,
      fingerprint: `reply-${terminalStage}`,
      mailbox_account_id: "MB-A",
    }, { id: "MB-A", brand_ids: ["BR-A"] }, now);
    assert.equal(terminalReply.kind, "followup");
    assert.equal(terminalReply.terminalFollowUp, true, `${terminalStage} 收到相关回信时应保留待人工处理标记。`);
    assert.equal(terminalReply.stageAdvancedFromReply, false);
    assert.equal(terminalReply.followUp.stage, terminalStage, `${terminalStage} 不得被自动重新打开。`);
  }
}

function assertFrontendMailImportGuards() {
  assert.match(appSource, /function normalizeEmlMessageId\(value\)/, "前端 .eml 导入应标准化线程 Message-ID。");
  assert.match(appSource, /function emlMessageReferences\(value\)/, "前端 .eml 导入应解析 References 线程字段。");
  assert.match(appSource, /in_reply_to: inReplyTo,\s+references,\s+fingerprint:/, "前端 .eml 导入应保存 In-Reply-To 和 References。");
  assert.match(
    appSource,
    /async function confirmMailImport\(\)[\s\S]*?const snapshot = clone\(state\.data\)[\s\S]*?const allEvents = Array\.isArray\(state\.data\.followUpEvents\)/,
    "Foxmail 导入确认前应保存完整业务状态快照，并在全部事件中追加。",
  );
  assert.match(
    appSource,
    /state\.data\.followUpEvents = \[\.\.\.additions, \.\.\.allEvents\][\s\S]*?catch \(error\) \{[\s\S]*?state\.data = snapshot;/,
    "Foxmail 导入不得覆盖其他品牌历史，保存失败时应恢复内存状态。",
  );
  assert.match(
    appSource,
    /function followUpCreator\(row\)[\s\S]*?const creatorById[\s\S]*?const leadById[\s\S]*?if \(text\(row\?\.creator_id\)\) return null/,
    "跟进达人显示应优先稳定 ID，并避免 ID 失效后跨品牌同名误匹配。",
  );
  assert.match(
    appSource,
    /const followUpBrandId = text\(followUp\.brand_id\)[\s\S]*?const byCooperationId[\s\S]*?byFollowUp\.length === 0 && byCooperationId\.length === 1/,
    "结案合作记录应优先 follow_up_id，旧 cooperation_id 只能唯一且同品牌时回用。",
  );
  assert.match(
    appSource,
    /async function confirmPendingMailBrand\(mailId, brandId\)[\s\S]*?const snapshot = clone\(state\.data\)[\s\S]*?catch \(error\) \{\s*state\.data = snapshot;/,
    "品牌确认持久化失败时应恢复内存状态。",
  );
  assert.match(
    appSource,
    /function findActiveLeadFollowUp\(leadId, brandId\)[\s\S]*?text\(followUp\.lead_id\) === text\(leadId\)[\s\S]*?text\(followUp\.brand_id\) === text\(brandId\)/,
    "备用邮箱入口应按待开发达人 ID 和品牌 ID 查找活跃跟进，避免重复或跨品牌关联。",
  );
  assert.match(
    appSource,
    /function ensureLeadWaitingFollowUp\(lead,\s*now = new Date\(\)\.toISOString\(\)\)[\s\S]*?stage: "已联系待回复"[\s\S]*?follow_up_id: followUp\.id[\s\S]*?source: "manual_mail_client"/,
    "打开默认邮箱客户端并标记联系时应建立待回复跟进和人工联系轨迹。",
  );
  const persistLeadContactSource = appSource.match(/async function persistLeadContactStatus\([\s\S]*?\n\}/)?.[0] || "";
  assert.match(
    persistLeadContactSource,
    /const snapshot = clone\(state\.data\)[\s\S]*?ensureLeadWaitingFollowUp[\s\S]*?await persist\(\)[\s\S]*?state\.data = snapshot;/,
    "备用邮箱入口保存失败时应回滚，并在保存前确保待回复跟进。",
  );
  assert.match(
    persistLeadContactSource,
    /const ensured = ensureLeadWaitingFollowUp[\s\S]*?if \(!ensured\.followUp\)[\s\S]*?throw new Error/,
    "待开发达人未绑定品牌时不得只更新已联系状态而跳过合作跟进。",
  );
  assert.doesNotMatch(
    persistLeadContactSource,
    /mail_sent/,
    "仅打开默认邮箱客户端不得伪造 mail_sent 已发送事件。",
  );
  assert.match(
    appSource,
    /async function launchOutreachMail\([\s\S]*?if \(!account\)[\s\S]*?await persistLeadContactStatus\(lead\.id, "邮件客户端"\)[\s\S]*?if \(!saved\)[\s\S]*?window\.location\.href = `mailto:/,
    "AI 开发邮件没有 SMTP 时也必须先建立已联系待回复，再打开默认邮箱客户端。",
  );
}

function assertLeadOutreachFollowUpLifecycle() {
  const now = "2026-08-31T08:00:00.000Z";
  const externalState = {
    ...emptyState(),
    brands: [{ id: "BR-EXTERNAL", name: "外部首发品牌" }],
    leads: [{
      id: "LEAD-EXTERNAL",
      brand_id: "BR-EXTERNAL",
      brand: "外部首发品牌",
      name: "外部首发达人",
      email: "external-lead@example.com",
      status: "待开发",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const externalRoute = routeMailRecord(externalState, {
    id: "MAIL-EXTERNAL-SENT",
    sender: "外部首发品牌 <official@example.com>",
    recipients: "外部首发达人 <external-lead@example.com>",
    subject: "Initial outreach",
    occurred_at: now,
    message_id: "external-root@example.com",
    fingerprint: "external-root",
    mailbox_account_id: "MB-EXTERNAL",
  }, { id: "MB-EXTERNAL", brand_ids: ["BR-EXTERNAL"] }, now);
  assert.equal(externalRoute.kind, "followup", "Foxmail/官邮同步到的外部首发邮件应建立正式待回复跟进。");
  assert.equal(externalRoute.matched, "external_outbound_lead");
  assert.equal(externalRoute.followUp.stage, "已联系待回复");
  assert.equal(externalRoute.followUp.lead_id, "LEAD-EXTERNAL");
  assert.equal(externalRoute.followUp.creator_id, "");
  assert.equal(externalState.contactTracks[0].follow_up_id, externalRoute.followUp.id);
  assert.equal(externalState.leads[0].last_outreach_at, now, "外部首发同步应写入待开发达人的最近发件时间。");

  const state = {
    ...emptyState(),
    brands: [{ id: "BR-LEAD", name: "测试品牌" }],
    leads: [{
      id: "LEAD-OUTREACH",
      brand_id: "BR-LEAD",
      brand: "测试品牌",
      name: "首发达人",
      email: "lead-outreach@example.com",
      status: "已联系",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const lead = state.leads[0];
  const first = createWaitingFollowUpForLead(state, lead, now);
  assert.equal(first.created, true, "待开发达人首发成功后应创建正式合作跟进。");
  assert.equal(first.followUp.stage, "已联系待回复");
  assert.equal(first.followUp.lead_id, lead.id);
  assert.equal(state.followUps.length, 1);

  const repeated = createWaitingFollowUpForLead(state, lead, now);
  assert.equal(repeated.created, false, "同一待开发达人重复建立首发轨迹必须幂等。");
  assert.equal(state.followUps.length, 1);

  state.followUpEvents.unshift({
    id: "SMTP-LEAD-OUTREACH",
    follow_up_id: first.followUp.id,
    lead_id: lead.id,
    brand_id: "BR-LEAD",
    mailbox_account_id: "MB-LEAD",
    type: "mail_sent",
    direction: "outbound",
    sender: "测试品牌 <official@example.com>",
    recipients: "首发达人 <lead-outreach@example.com>",
    message_id: "lead-outreach-root@example.com",
    occurred_at: now,
    createdAt: now,
    updatedAt: now,
  });
  const track = {
    id: "CT-LEAD-OUTREACH",
    follow_up_id: first.followUp.id,
    brand_id: "BR-LEAD",
    brand: "测试品牌",
    person_type: "lead",
    person_id: lead.id,
    person_name: lead.name,
    email: lead.email,
    mailbox_account_id: "MB-LEAD",
    last_outbound_at: now,
    status: "waiting_reply",
    createdAt: now,
    updatedAt: now,
  };
  state.contactTracks.push(track);
  assert.equal(state.creators.length, 0, "首发邮件阶段不得提前转入达人库。");
  const reply = routeMailRecord(state, {
    id: "MAIL-LEAD-REPLY",
    sender: "首发达人 <lead-outreach@example.com>",
    recipients: "测试品牌 <official@example.com>",
    subject: "Re: Collaboration",
    occurred_at: "2026-08-31T10:00:00.000Z",
    in_reply_to: "lead-outreach-root@example.com",
    message_id: "lead-reply@example.com",
    fingerprint: "lead-reply",
    mailbox_account_id: "MB-LEAD",
  }, { id: "MB-LEAD", brand_ids: ["BR-LEAD"] }, "2026-08-31T10:00:00.000Z");
  assert.equal(reply.kind, "followup");
  assert.equal(reply.matched, "thread");
  assert.equal(reply.stageAdvancedFromReply, true);
  const promoted = reply.followUp.creator_id
    ? state.creators.find((creatorItem) => creatorItem.id === reply.followUp.creator_id)
    : null;
  assert.equal(promoted.id.startsWith("CR-"), true, "收到回信时应把待开发达人转入达人库。");
  assert.equal(first.followUp.creator_id, promoted.id);
  assert.equal(first.followUp.stage, "初步沟通", "收到达人回信后应从待回复推进到初步沟通。");
  assert.equal(state.leads[0].status, "已转达人库");
  assert.equal(state.contactTracks[0].person_type, "creator");
  assert.equal(state.contactTracks[0].person_id, promoted.id);
  assert.equal(state.followUpEvents[0].person_type, "creator");
  assert.equal(state.followUpEvents[0].follow_up_id, first.followUp.id);
}

function assertExistingLeadFollowUpAdvancesToWaiting() {
  const now = "2026-08-31T13:00:00.000Z";
  const state = {
    ...emptyState(),
    brands: [{ id: "BR-EXISTING", name: "已有品牌" }],
    leads: [{
      id: "LEAD-EXISTING",
      brand_id: "BR-EXISTING",
      brand: "已有品牌",
      name: "已有跟进达人",
      email: "existing-lead@example.com",
      status: "待开发",
      createdAt: now,
      updatedAt: now,
    }],
    followUps: [{
      id: "FU-EXISTING",
      brand_id: "BR-EXISTING",
      brand: "已有品牌",
      lead_id: "LEAD-EXISTING",
      creator_id: "",
      creator_name: "已有跟进达人",
      stage: "待开发",
      next_action: "",
      createdAt: now,
      updatedAt: now,
    }],
  };
  const result = createWaitingFollowUpForLead(state, state.leads[0], now);
  assert.equal(result.created, false, "已有待开发跟进应复用原记录，不应重复创建。");
  assert.equal(result.followUp.id, "FU-EXISTING");
  assert.equal(result.followUp.stage, "已联系待回复", "复用旧待开发跟进时应推进到已联系待回复。");
  assert.equal(result.followUp.next_action, "等待达人回复");
  assert.equal(state.followUps.length, 1);
}

function assertLeadPromotionReusesSameBrandCreator() {
  const now = "2026-08-31T12:00:00.000Z";
  const state = {
    ...emptyState(),
    creators: [{
      id: "CR-EXISTING-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "已有达人 A",
      social_url: "https://www.youtube.com/@existing-a/",
      email: "same-person@example.com",
      createdAt: now,
      updatedAt: now,
    }, {
      id: "CR-EXISTING-B",
      brand_id: "BR-B",
      brand: "品牌 B",
      name: "品牌 B 达人",
      social_url: "https://www.youtube.com/@brand-b/",
      email: "same-person@example.com",
      createdAt: now,
      updatedAt: now,
    }],
    leads: [{
      id: "LEAD-SAME-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "旧待开发记录",
      social_url: "https://www.youtube.com/@existing-a",
      email: "same-person@example.com",
      status: "已联系",
      createdAt: now,
      updatedAt: now,
    }],
    followUps: [{
      id: "FU-SAME-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      lead_id: "LEAD-SAME-A",
      creator_id: "",
      creator_name: "旧待开发记录",
      stage: "已联系待回复",
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "CT-SAME-A",
      brand_id: "BR-A",
      person_type: "lead",
      person_id: "LEAD-SAME-A",
      person_name: "旧待开发记录",
      email: "same-person@example.com",
      follow_up_id: "FU-SAME-A",
      mailbox_account_id: "MB-SHARED",
      status: "waiting_reply",
      last_outbound_at: now,
      createdAt: now,
      updatedAt: now,
    }],
    followUpEvents: [{
      id: "EV-SAME-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      lead_id: "LEAD-SAME-A",
      contact_track_id: "CT-SAME-A",
      follow_up_id: "FU-SAME-A",
      person_type: "lead",
      person_id: "LEAD-SAME-A",
      type: "email",
      occurred_at: now,
      subject: "首发开发",
      excerpt: "已有首发上下文",
    }],
  };

  const promoted = promoteFollowUpLeadToCreator(state, state.followUps[0], now);
  assert.equal(promoted.id, "CR-EXISTING-A", "同品牌相同邮箱或社媒地址应复用已有达人。");
  assert.equal(state.creators.length, 2, "复用已有达人时不得新增重复达人。");
  assert.equal(state.leads[0].status, "已转达人库");
  assert.equal(state.contactTracks[0].person_type, "creator");
  assert.equal(state.contactTracks[0].person_id, "CR-EXISTING-A");
  assert.equal(state.followUpEvents[0].person_type, "creator");
  assert.equal(state.followUpEvents[0].person_id, "CR-EXISTING-A");

  const crossBrandState = {
    ...emptyState(),
    creators: [{
      id: "CR-ONLY-B",
      brand_id: "BR-B",
      brand: "品牌 B",
      name: "另一个品牌达人",
      email: "same-person@example.com",
      createdAt: now,
      updatedAt: now,
    }],
    leads: [{
      id: "LEAD-CROSS-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      name: "品牌 A 待开发记录",
      email: "same-person@example.com",
      status: "已联系",
      createdAt: now,
      updatedAt: now,
    }],
    followUps: [{
      id: "FU-CROSS-A",
      brand_id: "BR-A",
      brand: "品牌 A",
      lead_id: "LEAD-CROSS-A",
      stage: "已联系待回复",
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "CT-CROSS-A",
      brand_id: "BR-A",
      person_type: "lead",
      person_id: "LEAD-CROSS-A",
      email: "same-person@example.com",
      follow_up_id: "FU-CROSS-A",
      status: "waiting_reply",
      last_outbound_at: now,
      createdAt: now,
      updatedAt: now,
    }],
  };
  const crossBrandPromoted = promoteFollowUpLeadToCreator(crossBrandState, crossBrandState.followUps[0], now);
  assert.notEqual(crossBrandPromoted.id, "CR-ONLY-B", "不同品牌相同邮箱不得跨品牌复用达人。");
  assert.equal(crossBrandPromoted.brand_id, "BR-A");
  assert.equal(crossBrandState.creators.length, 2);
}

function assertBodyRefreshAndDedup() {
  const now = new Date("2026-08-31T12:00:00.000Z");
  const summaryEvent = {
    id: "EV-BODY-SUMMARY",
    type: "email",
    mailbox_account_id: "MB-A",
    server_key: "imap.example.com|account@example.com|INBOX|42",
    message_id: "",
    fingerprint: "summary-fingerprint",
    body: "",
    excerpt: "这是一封邮件摘要。",
  };
  const fullRecord = {
    ...summaryEvent,
    fingerprint: "full-fingerprint",
    body: "第一段完整正文。\n\n第二段完整正文。",
    body_cached_at: "2026-08-31T12:00:00.000Z",
    body_retention_until: "2026-11-29T12:00:00.000Z",
    body_truncated: false,
  };
  const state = {
    followUpEvents: [summaryEvent],
    mailInbox: [],
  };
  assert.equal(cacheBodyOnExistingRecord(summaryEvent, fullRecord, now), true, "摘要事件再次同步到完整正文时应刷新原事件。");
  assert.equal(summaryEvent.body, fullRecord.body);
  assert.equal(summaryEvent.body_cached_at, fullRecord.body_cached_at);
  assert.equal(summaryEvent.body_retention_until, fullRecord.body_retention_until);
  assert.equal(findKnownMailRecord(state, fullRecord, "MB-A"), summaryEvent, "正文刷新不能因为摘要变化而新增重复事件。");
  assert.deepEqual(recordDedupKeys(summaryEvent, "MB-A"), [
    "server:imap.example.com|account@example.com|INBOX|42",
    "fingerprint:summary-fingerprint",
  ]);

  const pendingSummary = {
    id: "IN-BODY-SUMMARY",
    type: "email",
    mailbox_account_id: "MB-A",
    server_key: "imap.example.com|account@example.com|INBOX|43",
    message_id: "pending-body@example.com",
    fingerprint: "pending-summary",
    body: "",
    excerpt: "待处理邮件摘要。",
  };
  state.mailInbox = [pendingSummary];
  const pendingFull = {
    ...pendingSummary,
    body: "待处理邮件完整正文。",
    body_cached_at: "2026-08-31T12:00:00.000Z",
    body_retention_until: "2026-11-29T12:00:00.000Z",
  };
  assert.equal(cacheBodyOnExistingRecord(pendingSummary, pendingFull, now), true, "待处理收件箱事件也应支持摘要升级完整正文。");
  assert.equal(findKnownMailRecord(state, pendingFull, "MB-A"), pendingSummary);
  assert.equal(state.followUpEvents.length, 1, "摘要升级完整正文不得新增跟进事件。");
  assert.equal(state.mailInbox.length, 1, "摘要升级完整正文不得新增待处理邮件。");

  const truncatedEvent = {
    id: "EV-BODY-TRUNCATED",
    body: "较短的截断正文",
    body_truncated: true,
    body_cached_at: "2026-08-31T10:00:00.000Z",
    body_retention_until: "2026-11-29T10:00:00.000Z",
  };
  const laterFullRecord = {
    body: "较短的截断正文\n\n后续同步到的完整正文内容。",
    body_truncated: false,
    body_cached_at: "2026-08-31T12:00:00.000Z",
    body_retention_until: "2026-11-29T12:00:00.000Z",
  };
  assert.equal(cacheBodyOnExistingRecord(truncatedEvent, laterFullRecord, now), true, "后续完整正文应覆盖旧截断正文。");
  assert.equal(truncatedEvent.body, laterFullRecord.body);
  assert.equal(truncatedEvent.body_truncated, false);

  const completeEvent = {
    body: "已经缓存的完整正文",
    body_truncated: false,
  };
  assert.equal(cacheBodyOnExistingRecord(completeEvent, {
    body: "不应覆盖的另一份正文",
    body_truncated: false,
  }, now), false, "已有完整正文不应被普通重复同步覆盖。");
}

function fixtureState() {
  const now = new Date().toISOString();
  return {
    ...emptyState(),
    brands: [
      {
        id: "BR-A",
        name: "品牌 A",
        default_country: "美国",
        default_language: "English",
        currency: "USD",
        timezone: "America/Los_Angeles",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "BR-B",
        name: "品牌 B",
        default_country: "西班牙",
        default_language: "Spanish",
        currency: "EUR",
        timezone: "Europe/Madrid",
        createdAt: now,
        updatedAt: now,
      },
    ],
    creators: [
      {
        id: "CR-A",
        brand_id: "BR-A",
        brand: "品牌 A",
        name: "Creator A",
        email: "shared@example.com",
        social_url: "https://example.com/shared",
        last_outreach_at: "2026-08-20T00:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "CR-B",
        brand_id: "BR-B",
        brand: "品牌 B",
        name: "Creator B",
        email: "shared@example.com",
        social_url: "https://example.com/shared",
        createdAt: now,
        updatedAt: now,
      },
    ],
    products: [
      { id: "PR-A", brand_id: "BR-A", brand: "品牌 A", name: "Product A", createdAt: now, updatedAt: now },
      { id: "PR-B", brand_id: "BR-B", brand: "品牌 B", name: "Product B", createdAt: now, updatedAt: now },
    ],
    matches: [
      { id: "MA-A", brand_id: "BR-A", brand: "品牌 A", title: "Match A", createdAt: now, updatedAt: now },
      { id: "MA-B", brand_id: "BR-B", brand: "品牌 B", title: "Match B", createdAt: now, updatedAt: now },
    ],
    followUps: [
      {
        id: "FU-A",
        brand_id: "BR-A",
        brand: "品牌 A",
        creator_id: "CR-A",
        creator_name: "Creator A",
        product_id: "PR-A",
        stage: "初步沟通",
        priority: "中",
        cooperation_mode: "待确认",
        budget: 1234.5,
        has_unread_reply: true,
        next_action: "确认合作",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "FU-B",
        brand_id: "BR-B",
        brand: "品牌 B",
        creator_id: "CR-B",
        creator_name: "Creator B",
        product_id: "PR-B",
        stage: "初步沟通",
        priority: "中",
        cooperation_mode: "待确认",
        next_action: "确认合作",
        createdAt: now,
        updatedAt: now,
      },
    ],
    followUpEvents: [
      {
        id: "EV-A",
        brand_id: "BR-A",
        follow_up_id: "FU-A",
        type: "email",
        direction: "inbound",
        subject: "A inbound",
        excerpt: "A message summary",
        message_id: "same-message-id@example.com",
        fingerprint: "same-message-fingerprint",
        source: "fixture",
        occurred_at: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "EV-B",
        brand_id: "BR-B",
        follow_up_id: "FU-B",
        type: "email",
        direction: "inbound",
        subject: "B inbound",
        excerpt: "B message summary",
        message_id: "same-message-id@example.com",
        fingerprint: "same-message-fingerprint",
        source: "fixture",
        occurred_at: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    mailInbox: [
      {
        id: "IN-A",
        brand_id: "BR-A",
        mailbox_account_id: "MB-A",
        type: "email",
        subject: "A pending",
        excerpt: "A pending summary",
        message_id: "pending-a@example.com",
        fingerprint: "pending-a",
        status: "needs_followup",
        occurred_at: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "IN-B",
        brand_id: "BR-B",
        mailbox_account_id: "MB-B",
        type: "email",
        subject: "B pending",
        excerpt: "B pending summary",
        message_id: "pending-b@example.com",
        fingerprint: "pending-b",
        status: "needs_followup",
        occurred_at: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function cacheFixtureBodies(state) {
  const cachedAt = new Date().toISOString();
  const retentionUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const values = new Map([
    ["EV-A", "BRAND-A-CONTEXT-SECRET"],
    ["EV-B", "BRAND-B-CONTEXT-SECRET"],
  ]);
  state.followUpEvents.forEach((event) => {
    const body = values.get(event.id);
    if (!body) return;
    event.body = body;
    event.body_cached_at = cachedAt;
    event.body_retention_until = retentionUntil;
    event.body_truncated = false;
  });
  return state;
}

function fakeFollowUpAiPayload() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary_cn: "测试模型已收到受限的归档上下文。",
            suggested_stage: "初步沟通",
            confidence: "low",
            key_facts: ["测试事实"],
            recommended_options: [{ id: "reply", label: "回复", description: "测试回复建议" }],
            risk_notes: [],
            recommended_next_action: "测试下一步",
            recommended_follow_up_days: 3,
            warnings: [],
          }),
        },
      },
    ],
  };
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function startFakeAiServer() {
  return new Promise((resolve, reject) => {
    fakeAiServer = http.createServer(async (req, res) => {
      try {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw || "{}");
        const userMessage = Array.isArray(payload.messages) ? payload.messages.find((message) => message?.role === "user") : null;
        fakeAiRequests.push({
          method: req.method,
          pathname: req.url,
          prompt: String(userMessage?.content || ""),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fakeFollowUpAiPayload()));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: error.message } }));
      }
    });
    fakeAiServer.once("error", reject);
    fakeAiServer.listen(0, "127.0.0.1", () => {
      const address = fakeAiServer.address();
      fakeAiBaseUrl = `http://127.0.0.1:${address.port}/v1`;
      resolve();
    });
  });
}

function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/state`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // The process can need a few seconds to initialize SQLite.
      }
      if (Date.now() >= deadline) {
        reject(new Error("隔离测试服务启动超时。"));
        return;
      }
      setTimeout(check, 150);
    };
    void check();
  });
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function jsonOptions(method, value) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}

async function run() {
  fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(path.join(storageDir, "state.json"), JSON.stringify(emptyState(), null, 2), "utf8");
  assertEmailFormatting();
  assertFrontendMailImportGuards();
  assertContactTrackRouting();
  assertLeadOutreachFollowUpLifecycle();
  assertExistingLeadFollowUpAdvancesToWaiting();
  assertLeadPromotionReusesSameBrandCreator();
  assertBodyRefreshAndDedup();
  await startFakeAiServer();

  server = spawn(process.execPath, ["tools/local-server.cjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      RESOURCE_WORKBENCH_STORAGE_DIR: storageDir,
      WORKBENCH_CREDENTIAL_ENCRYPTION_KEY: "followup-isolation-test-key",
      HTTP_PROXY: "",
      HTTPS_PROXY: "",
      ALL_PROXY: "",
      http_proxy: "",
      https_proxy: "",
      all_proxy: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await waitForServer();

  let result = await request("/api/state", jsonOptions("POST", fixtureState()));
  assert.equal(result.response.status, 200, `写入隔离测试资料失败：${result.payload.error || output}`);

  result = await request("/api/state");
  assert.equal(result.response.status, 200, `读取隔离测试资料失败：${result.payload.error || output}`);
  assert.equal(result.payload.brands.length, 2);
  assert.deepEqual(
    result.payload.brands
      .map((brand) => [brand.id, brand.default_country, brand.default_language, brand.currency, brand.timezone])
      .sort((left, right) => left[0].localeCompare(right[0])),
    [
      ["BR-A", "美国", "English", "USD", "America/Los_Angeles"],
      ["BR-B", "西班牙", "Spanish", "EUR", "Europe/Madrid"],
    ],
    "品牌工作区的默认市场、语言、币种和时区应完整保存。",
  );
  assert.equal(result.payload.creators.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.creators.find((row) => row.id === "CR-A").last_outreach_at, "2026-08-20T00:00:00.000Z", "最近发件时间应经 SQLite 完整保存。");
  assert.equal(result.payload.creators.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.products.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.products.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.followUps.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.followUps.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.followUps.find((row) => row.id === "FU-A").budget, 1234.5, "跟进预算应经 SQLite 完整保存。");
  assert.equal(result.payload.followUps.find((row) => row.id === "FU-A").lead_id || "", "", "跟进的待开发达人关联字段应经 SQLite 完整保存。");
  assert.equal(result.payload.followUps.find((row) => row.id === "FU-A").has_unread_reply, true, "跟进的新回复高亮字段应经 SQLite 完整保存。");
  assert.equal(result.payload.followUpEvents.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.followUpEvents.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.mailInbox.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.mailInbox.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.followUpEvents.length, 2, "不同品牌的相同邮件标识不应互相去重。");

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", {
      accounts: [
        {
          id: "MB-A",
          brand_id: "BR-A",
          brand_name: "品牌 A",
          enabled: true,
          label: "A Mail",
          imap: { host: "", port: 993, secure: true, user: "a@example.com", password: "not-a-real-password" },
          smtp: { enabled: true, host: "127.0.0.1", port: 9, secure: true, user: "a@example.com", password: "", useImapPassword: true },
        },
        {
          id: "MB-B",
          brand_id: "BR-B",
          brand_name: "品牌 B",
          enabled: true,
          label: "B Mail",
          imap: { host: "", port: 993, secure: true, user: "b@example.com", password: "not-a-real-password" },
          smtp: { enabled: true, host: "127.0.0.1", port: 9, secure: true, user: "b@example.com", password: "", useImapPassword: true },
        },
        {
          id: "MB-SHARED",
          brand_ids: ["BR-A", "BR-B"],
          brand_name: "共用官方邮箱",
          enabled: false,
          label: "Shared Mail",
          imap: { host: "", port: 993, secure: true, user: "shared@example.com", password: "" },
          smtp: { enabled: false, host: "", port: 465, secure: true, user: "", password: "", useImapPassword: true },
        },
      ],
    }),
  );
  assert.equal(result.response.status, 200, `保存隔离邮箱设置失败：${result.payload.error || output}`);

  result = await request("/api/mail/settings");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.settings.accounts.length, 3);
  assert.equal(result.payload.settings.accounts.every((account) => account.imap.password === undefined && account.smtp.password === undefined), true);
  assert.deepEqual(
    result.payload.settings.accounts.filter((account) => account.id !== "MB-SHARED").map((account) => account.brand_id).sort(),
    ["BR-A", "BR-B"],
  );
  assert.deepEqual(
    result.payload.settings.accounts.find((account) => account.id === "MB-SHARED").brand_ids,
    ["BR-A", "BR-B"],
    "共享官方邮箱应完整返回全部品牌归属。",
  );

  result = await request("/api/mail/test", jsonOptions("POST", { accountId: "MB-A" }));
  assert.equal(result.response.status, 400, "未配置 IMAP 主机时应安全失败，不应建立外部连接。");

  const beforeStage = (await request("/api/state")).payload.followUps.find((row) => row.id === "FU-A").stage;
  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "仅测试失败保护" }));
  assert.equal(result.response.status, 400, "未配置 AI 时跟进分析应返回明确失败。");
  assert.match(String(result.payload.error || ""), /未配置|AI/);
  result = await request(
    "/api/ai/followup-draft",
    jsonOptions("POST", { followUpId: "FU-A", strategyId: "reply", customIntent: "仅测试失败保护" }),
  );
  assert.equal(result.response.status, 400, "未配置 AI 时跟进邮件草稿应返回明确失败。");
  assert.match(String(result.payload.error || ""), /未配置|AI/);
  const afterStage = (await request("/api/state")).payload.followUps.find((row) => row.id === "FU-A").stage;
  assert.equal(afterStage, beforeStage, "AI 分析失败或成功都不能自动修改合作阶段。");

  result = await request(
    "/api/ai/settings",
    jsonOptions("POST", {
      profiles: {
        special: {
          protocol: "openai",
          apiBaseUrl: fakeAiBaseUrl,
          apiKey: "test-key",
          keySource: "local",
          model: "test-model",
          proxyUrl: "",
        },
      },
      assignments: { followup: "special" },
    }),
  );
  assert.equal(result.response.status, 200, `保存隔离 AI 设置失败：${result.payload.error || output}`);

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", {
      contentPolicy: {
        cacheBodies: true,
        allowAiContext: false,
        retentionDays: 90,
      },
    }),
  );
  assert.equal(result.response.status, 200, `保存未授权正文策略失败：${result.payload.error || output}`);
  assert.equal(result.payload.settings.contentPolicy.cacheBodies, true);
  assert.equal(result.payload.settings.contentPolicy.allowAiContext, false);

  result = await request("/api/state", jsonOptions("POST", cacheFixtureBodies((await request("/api/state")).payload)));
  assert.equal(result.response.status, 200, `写入正文缓存测试资料失败：${result.payload.error || output}`);

  fakeAiRequests.length = 0;
  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "仅测试正文授权" }));
  assert.equal(result.response.status, 200, `未授权正文的 AI 分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1, "未授权正文时也应调用测试模型，但只能传递摘要。");
  assert.match(fakeAiRequests[0].pathname, /\/v1\/chat\/completions$/);
  assert.match(fakeAiRequests[0].prompt, /A message summary/);
  assert.doesNotMatch(fakeAiRequests[0].prompt, /BRAND-A-CONTEXT-SECRET/);
  assert.doesNotMatch(fakeAiRequests[0].prompt, /BRAND-B-CONTEXT-SECRET/);
  assert.match(result.payload.context_notice, /未授权给 AI/);

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", {
      contentPolicy: {
        cacheBodies: true,
        allowAiContext: true,
        retentionDays: 90,
      },
    }),
  );
  assert.equal(result.response.status, 200, `保存已授权正文策略失败：${result.payload.error || output}`);

  fakeAiRequests.length = 0;
  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "仅测试品牌隔离" }));
  assert.equal(result.response.status, 200, `已授权正文的 AI 分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1, "已授权正文时应调用一次测试模型。");
  assert.match(fakeAiRequests[0].prompt, /BRAND-A-CONTEXT-SECRET/);
  assert.doesNotMatch(fakeAiRequests[0].prompt, /BRAND-B-CONTEXT-SECRET/);
  assert.match(result.payload.context_notice, /其中 1 封为完整正文/);

  const longContextState = (await request("/api/state")).payload;
  const cachedAt = new Date().toISOString();
  const retentionUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  longContextState.followUpEvents = [
    ...longContextState.followUpEvents,
    ...Array.from({ length: 12 }, (_, index) => {
      const sequence = index + 1;
      const occurredAt = new Date(Date.now() - (12 - sequence) * 60 * 60 * 1000).toISOString();
      return {
        id: `EV-LONG-${sequence}`,
        brand_id: "BR-A",
        follow_up_id: "FU-A",
        type: "email",
        direction: sequence % 2 ? "inbound" : "outbound",
        subject: `Long context ${sequence}`,
        excerpt: `EARLIEST-EVENT-${sequence}`,
        body: `${sequence === 12 ? "LATEST-EVENT-12" : `BODY-EVENT-${sequence}`} ${"x".repeat(8000)}`,
        body_cached_at: cachedAt,
        body_retention_until: retentionUntil,
        body_truncated: false,
        message_id: `long-${sequence}@example.com`,
        fingerprint: `long-${sequence}`,
        source: "fixture",
        occurred_at: occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
    }),
  ];
  result = await request("/api/state", jsonOptions("POST", longContextState));
  assert.equal(result.response.status, 200, `写入完整上下文测试资料失败：${result.payload.error || output}`);
  fakeAiRequests.length = 0;
  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "仅测试全量上下文" }));
  assert.equal(result.response.status, 200, `超过 10 封邮件的 AI 分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1);
  assert.match(fakeAiRequests[0].prompt, /EARLIEST-EVENT-1/, "最早邮件摘要不能因固定条数限制而消失。");
  assert.match(fakeAiRequests[0].prompt, /LATEST-EVENT-12/, "最新邮件正文应优先纳入 AI 上下文。");
  assert.match(fakeAiRequests[0].prompt, /"total_events":\s*13/, "AI 上下文应报告全部事件数量。");
  assert.match(result.payload.context_notice, /共 13 封/);

  const expiredState = (await request("/api/state")).payload;
  const expiredEvent = expiredState.followUpEvents.find((row) => row.id === "EV-A");
  expiredEvent.body_retention_until = "2020-01-01T00:00:00.000Z";
  result = await request("/api/state", jsonOptions("POST", expiredState));
  assert.equal(result.response.status, 200, `写入过期正文测试资料失败：${result.payload.error || output}`);

  fakeAiRequests.length = 0;
  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "仅测试过期正文" }));
  assert.equal(result.response.status, 200, `过期正文的 AI 分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1);
  assert.doesNotMatch(fakeAiRequests[0].prompt, /BRAND-A-CONTEXT-SECRET/);
  assert.match(result.payload.context_notice, /过期/);

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", {
      contentPolicy: {
        cacheBodies: false,
        allowAiContext: false,
        retentionDays: 90,
      },
    }),
  );
  assert.equal(result.response.status, 200, `关闭正文缓存失败：${result.payload.error || output}`);
  const bodiesClearedState = (await request("/api/state")).payload;
  assert.equal(bodiesClearedState.followUpEvents.find((row) => row.id === "EV-A").body, "");
  assert.equal(bodiesClearedState.followUpEvents.find((row) => row.id === "EV-B").body, "");

  const eventCountBeforeBlockedSend = bodiesClearedState.followUpEvents.length;
  result = await request(
    "/api/mail/send",
    jsonOptions("POST", {
      accountId: "MB-A",
      followUpId: "FU-B",
      to: "shared@example.com",
      subject: "Cross-brand must be blocked",
      text: "This request must fail before any SMTP connection.",
    }),
  );
  assert.equal(result.response.status, 400, "跨品牌 SMTP 发信必须被服务端拦截。");
  assert.match(String(result.payload.error || ""), /不属于该品牌|跨品牌/);
  const finalState = (await request("/api/state")).payload;
  assert.equal(finalState.followUpEvents.length, eventCountBeforeBlockedSend, "被拦截的跨品牌发信不得产生时间线记录。");
  assert.equal(finalState.followUps.find((row) => row.id === "FU-B").stage, "初步沟通", "被拦截的跨品牌发信不得改动合作阶段。");

  console.log("PASS follow-up isolation regression: lead outreach follow-up lifecycle, 30-day outreach routing, contact-track routing, shared-mailbox confirmation, brand isolation, body authorization, expiry cleanup, protected AI failure, blocked cross-brand SMTP.");
}

async function cleanup() {
  if (server && !server.killed) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
  }
  if (fakeAiServer) {
    await new Promise((resolve) => fakeAiServer.close(resolve));
  }
  fs.rmSync(storageDir, { recursive: true, force: true });
}

run()
  .catch((error) => {
    console.error(`FAIL follow-up isolation regression: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
