const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  archiveTriageMail,
  createCase,
  reconcileCaseTasks,
} = require("./crm-domain.cjs");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const now = "2026-09-11T16:00:00.000Z";
const inboundAt = "2026-09-11T15:00:00.000Z";

function resolvePython() {
  const configured = String(process.env.PYTHON_EXECUTABLE || process.env.PYTHON || "").trim();
  const candidates = [
    ...(configured ? [{ command: configured, args: [] }] : []),
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
  ];
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.args, "--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("测试需要 Python 3，但当前环境未找到 Python。");
}

function runBridge(candidate, command, dbPath, statePath, input) {
  const result = spawnSync(candidate.command, [
    ...candidate.args,
    sqliteBridge,
    command,
    dbPath,
    statePath,
  ], {
    cwd: rootDir,
    encoding: "utf8",
    input: input ? JSON.stringify(input) : "",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  assert.equal(result.status, 0, `SQLite bridge ${command} 失败：${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mailRow(id, extra = {}) {
  return {
    id,
    brand_id: "BR-A",
    direction: "inbound",
    subject: "Re: HSU partnership",
    sender: "Creator A <creator-a@example.com>",
    recipients: "outreach@hsu.example",
    excerpt: "I am interested. Could you share the collaboration details?",
    body: "Hello, I am interested in discussing a collaboration. Please share the next steps.",
    body_cached_at: inboundAt,
    body_retention_until: "2026-10-11T15:00:00.000Z",
    body_truncated: false,
    message_id: "<reply-a@example.com>",
    in_reply_to: "<outreach-a@example.com>",
    references: ["<outreach-a@example.com>"],
    fingerprint: "reply-a-fingerprint",
    mailbox_account_id: "MAILBOX-A",
    mailbox: "INBOX",
    server_key: "mail.example/INBOX/501",
    imap_uid: "501",
    occurred_at: inboundAt,
    status: "needs_followup",
    candidate_creator_ids: ["CR-A"],
    candidate_follow_up_ids: ["FU-A"],
    candidate_case_ids: ["CASE-A"],
    match_disposition: "unique",
    match_score: 96,
    match_reasons: ["线程引用、达人邮箱与唯一活跃 Case 一致。"],
    match_candidates: [{
      brand_id: "BR-A",
      creator_id: "CR-A",
      follow_up_id: "FU-A",
      case_id: "CASE-A",
      score: 96,
      evidence: [{ rule: "thread_reference", weight: 50, detail: "回复已知首联线程。" }],
    }],
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function fixture(extraMail = {}) {
  return {
    brands: [
      { id: "BR-A", name: "HSU" },
      { id: "BR-B", name: "Other" },
    ],
    creators: [
      { id: "CR-A", brand_id: "BR-A", name: "Creator A", email: "creator-a@example.com" },
      { id: "CR-B", brand_id: "BR-B", name: "Creator B", email: "creator-b@example.com" },
    ],
    cases: [
      createCase({
        id: "CASE-A",
        brand_id: "BR-A",
        creator_id: "CR-A",
        stage: "已联系待回复",
        last_outreach_at: "2026-09-10T10:00:00.000Z",
      }, now),
      createCase({
        id: "CASE-B",
        brand_id: "BR-B",
        creator_id: "CR-B",
        stage: "已联系待回复",
      }, now),
    ],
    followUps: [{
      id: "FU-A",
      brand_id: "BR-A",
      creator_id: "CR-A",
      case_id: "CASE-A",
      stage: "已联系待回复",
      has_unread_reply: false,
      last_email_at: "2026-09-10T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    }],
    contactTracks: [{
      id: "TRACK-A",
      brand_id: "BR-A",
      person_type: "creator",
      person_id: "CR-A",
      email: "creator-a@example.com",
      follow_up_id: "FU-A",
      case_id: "CASE-A",
      status: "sent",
      createdAt: now,
      updatedAt: now,
    }],
    followUpEvents: [],
    actionTasks: [],
    actionTaskEvents: [],
    mailInbox: [mailRow("MAIL-A", extraMail)],
  };
}

function taskByType(state, type) {
  return state.actionTasks.filter((task) => task.type === type && task.case_id === "CASE-A");
}

function testInboundArchiveUpdatesCaseAndTask() {
  const state = fixture();
  const result = archiveTriageMail(state, {
    mail_id: "MAIL-A",
    case_id: "CASE-A",
    actor_name: "运营 A",
    reason: "人工确认达人回复属于当前合作。",
  }, now);

  assert.equal(result.mail.triage_status, "archived");
  assert.equal(result.mail.case_id, "CASE-A");
  assert.equal(result.followUp.has_unread_reply, true);
  assert.equal(result.followUp.last_email_at, inboundAt);
  assert.equal(result.followUp.stage, "初步沟通");
  assert.equal(result.case.stage, "初步沟通");
  assert.equal(result.stageAdvanced, true);
  assert.equal(result.contactTrack.status, "replied");
  assert.equal(result.contactTrack.replied_at, inboundAt);

  assert.equal(state.followUpEvents.length, 1);
  const event = state.followUpEvents[0];
  assert.deepEqual(
    {
      mail_inbox_id: event.mail_inbox_id,
      follow_up_id: event.follow_up_id,
      case_id: event.case_id,
      message_id: event.message_id,
      in_reply_to: event.in_reply_to,
      references: event.references,
      fingerprint: event.fingerprint,
      server_key: event.server_key,
      imap_uid: event.imap_uid,
      source: event.source,
    },
    {
      mail_inbox_id: "MAIL-A",
      follow_up_id: "FU-A",
      case_id: "CASE-A",
      message_id: "<reply-a@example.com>",
      in_reply_to: "<outreach-a@example.com>",
      references: ["<outreach-a@example.com>"],
      fingerprint: "reply-a-fingerprint",
      server_key: "mail.example/INBOX/501",
      imap_uid: "501",
      source: "manual_triage",
    },
    "归档时间线必须保存完整的邮件身份与 Case/FollowUp 关联。",
  );

  assert.equal(taskByType(state, "new_reply").length, 1, "新回信只能创建一个今日推进待办。");
  reconcileCaseTasks(state, now);
  assert.equal(taskByType(state, "new_reply").length, 1, "重复重算不得重复创建新回信待办。");
}

function testCrossBrandArchiveDoesNotMutate() {
  const state = fixture();
  const before = clone(state);
  assert.throws(
    () => archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-B" }, now),
    /品牌不一致/,
  );
  assert.deepEqual(state, before, "跨品牌归档被拒绝后不得写入邮件、Case、FollowUp、联系人或待办。");
}

function testOutboundArchiveDoesNotCreateUnreadReply() {
  const state = fixture({ direction: "outbound", sender: "outreach@hsu.example", recipients: "creator-a@example.com" });
  const result = archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-A" }, now);
  assert.equal(result.followUp.has_unread_reply, false);
  assert.equal(result.followUp.stage, "已联系待回复");
  assert.equal(result.case.stage, "已联系待回复");
  assert.equal(taskByType(state, "new_reply").length, 0);
}

function testReadInvalidatesGeneratedReplyTask() {
  const state = fixture();
  archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-A" }, now);
  state.followUps[0].has_unread_reply = false;
  reconcileCaseTasks(state, "2026-09-11T17:00:00.000Z");
  const task = taskByType(state, "new_reply")[0];
  assert.equal(task.status, "已失效");
  assert.equal(state.cases[0].stage, "初步沟通", "标记已读只能关闭待办，不能回退或推进 Case。");
}

function testSqliteRoundTripPreservesArchiveLinkage() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-triage-case-actions-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const state = fixture();
    archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-A" }, now);
    const python = resolvePython();
    runBridge(python, "save_state", dbPath, statePath, state);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    const event = loaded.followUpEvents.find((item) => item.mail_inbox_id === "MAIL-A");
    const inbox = loaded.mailInbox.find((item) => item.id === "MAIL-A");
    const task = loaded.actionTasks.find((item) => item.type === "new_reply");

    assert.equal(loaded.followUps.find((item) => item.id === "FU-A").case_id, "CASE-A");
    assert.equal(event.follow_up_id, "FU-A");
    assert.equal(event.case_id, "CASE-A");
    assert.equal(event.message_id, "<reply-a@example.com>");
    assert.equal(event.in_reply_to, "<outreach-a@example.com>");
    assert.deepEqual(event.references, ["<outreach-a@example.com>"]);
    assert.equal(event.fingerprint, "reply-a-fingerprint");
    assert.equal(event.server_key, "mail.example/INBOX/501");
    assert.equal(event.imap_uid, "501");
    assert.equal(inbox.triage_status, "archived");
    assert.equal(inbox.in_reply_to, "<outreach-a@example.com>");
    assert.deepEqual(inbox.references, ["<outreach-a@example.com>"]);
    assert.equal(task.case_id, "CASE-A");
    assert.equal(task.type, "new_reply");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

testInboundArchiveUpdatesCaseAndTask();
testCrossBrandArchiveDoesNotMutate();
testOutboundArchiveDoesNotCreateUnreadReply();
testReadInvalidatesGeneratedReplyTask();
testSqliteRoundTripPreservesArchiveLinkage();
console.log("PASS mail triage Case/action-task regression");
