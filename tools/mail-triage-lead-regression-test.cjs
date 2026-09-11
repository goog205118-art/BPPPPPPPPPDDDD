const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createTriageLead } = require("./crm-domain.cjs");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const now = "2026-09-11T18:00:00.000Z";

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
    brand: "HSU",
    direction: "inbound",
    subject: "Collaboration inquiry",
    sender: "New Creator <new.creator@example.com>",
    recipients: "outreach@hsu.example",
    excerpt: "I am interested in collaborating with your brand.",
    occurred_at: "2026-09-11T17:30:00.000Z",
    message_id: "<new-message@example.com>",
    fingerprint: "new-mail-fingerprint",
    server_key: "mail.example/INBOX/802",
    imap_uid: "802",
    status: "unmatched",
    candidate_creator_ids: [],
    candidate_lead_ids: [],
    candidate_case_ids: [],
    candidate_follow_up_ids: [],
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
    creators: [],
    leads: [],
    cases: [],
    followUps: [],
    followUpEvents: [],
    actionTasks: [],
    actionTaskEvents: [],
    mailInbox: [mailRow("MAIL-LEAD", extraMail)],
  };
}

function testCreateLeadPreservesMailIdentityWithoutWorkflowSideEffects() {
  const state = fixture();
  const result = createTriageLead(state, {
    mail_id: "MAIL-LEAD",
    name: "New Creator",
    handle: "@newcreator",
    social_url: "https://www.youtube.com/@newcreator/",
    notes: "达人主动来信，待人工确认账号信息。",
    actor_name: "运营 A",
  }, now);

  assert.equal(state.leads.length, 1);
  assert.equal(result.lead.status, "待开发");
  assert.equal(result.lead.email, "new.creator@example.com");
  assert.equal(result.lead.email_source, "邮件来信：Collaboration inquiry");
  assert.deepEqual(
    {
      source_mail_inbox_id: result.lead.source_mail_inbox_id,
      source_mail_message_id: result.lead.source_mail_message_id,
      source_mail_sender: result.lead.source_mail_sender,
      source_mail_occurred_at: result.lead.source_mail_occurred_at,
      source_mail_subject: result.lead.source_mail_subject,
      source_mail_fingerprint: result.lead.source_mail_fingerprint,
      source_mail_server_key: result.lead.source_mail_server_key,
      source_mail_imap_uid: result.lead.source_mail_imap_uid,
    },
    {
      source_mail_inbox_id: "MAIL-LEAD",
      source_mail_message_id: "<new-message@example.com>",
      source_mail_sender: "New Creator <new.creator@example.com>",
      source_mail_occurred_at: "2026-09-11T17:30:00.000Z",
      source_mail_subject: "Collaboration inquiry",
      source_mail_fingerprint: "new-mail-fingerprint",
      source_mail_server_key: "mail.example/INBOX/802",
      source_mail_imap_uid: "802",
    },
  );
  assert.equal(result.mail.lead_id, result.lead.id);
  assert.equal(result.mail.triage_status, "lead_created");
  assert.equal(result.mail.triage_resolved_by, "运营 A");
  assert.equal(state.cases.length, 0, "创建线索不能顺带创建 Case。");
  assert.equal(state.followUps.length, 0, "创建线索不能顺带创建合作跟进。");
  assert.equal(state.followUpEvents.length, 0, "创建线索不能写入合作时间线。");
  assert.equal(state.actionTasks.length, 0, "创建线索不能生成今日推进待办。");
}

function testDuplicateLeadAndCreatorRejectWithoutMutation() {
  const leadState = fixture();
  leadState.leads.push({ id: "LEAD-EXISTING", brand_id: "BR-A", name: "Existing lead", email: "new.creator@example.com" });
  const leadBefore = clone(leadState);
  assert.throws(
    () => createTriageLead(leadState, { mail_id: "MAIL-LEAD" }, now),
    (error) => error.code === "duplicate_identity" && /待开发达人/.test(error.message),
  );
  assert.deepEqual(leadState, leadBefore, "同品牌待开发达人重复时不得变更邮件或创建资料。");

  const creatorState = fixture();
  creatorState.creators.push({ id: "CR-EXISTING", brand_id: "BR-A", name: "Existing creator", email: "new.creator@example.com" });
  const creatorBefore = clone(creatorState);
  assert.throws(
    () => createTriageLead(creatorState, { mail_id: "MAIL-LEAD" }, now),
    (error) => error.code === "duplicate_identity" && /达人库/.test(error.message),
  );
  assert.deepEqual(creatorState, creatorBefore, "同品牌达人库重复时不得变更邮件或创建资料。");
}

function testCrossBrandAndUnsafeMailRejectWithoutMutation() {
  const crossBrandState = fixture();
  const crossBefore = clone(crossBrandState);
  assert.throws(
    () => createTriageLead(crossBrandState, { mail_id: "MAIL-LEAD", brand_id: "BR-B" }, now),
    /品牌不一致/,
  );
  assert.deepEqual(crossBrandState, crossBefore);

  const outboundState = fixture({ direction: "outbound" });
  const outboundBefore = clone(outboundState);
  assert.throws(() => createTriageLead(outboundState, { mail_id: "MAIL-LEAD" }, now), /入站邮件/);
  assert.deepEqual(outboundState, outboundBefore);

  const knownCreatorState = fixture({ matched_creator_id: "CR-A", candidate_creator_ids: ["CR-A"] });
  const knownCreatorBefore = clone(knownCreatorState);
  assert.throws(() => createTriageLead(knownCreatorState, { mail_id: "MAIL-LEAD" }, now), /已有达人/);
  assert.deepEqual(knownCreatorState, knownCreatorBefore);

  const activeCaseCandidateState = fixture({ candidate_case_ids: ["CASE-A"] });
  const activeCaseBefore = clone(activeCaseCandidateState);
  assert.throws(() => createTriageLead(activeCaseCandidateState, { mail_id: "MAIL-LEAD" }, now), /活跃合作候选/);
  assert.deepEqual(activeCaseCandidateState, activeCaseBefore);
}

function testSecondExecutionIsRejected() {
  const state = fixture();
  createTriageLead(state, { mail_id: "MAIL-LEAD" }, now);
  const afterFirst = clone(state);
  assert.throws(() => createTriageLead(state, { mail_id: "MAIL-LEAD" }, now), /已创建待开发达人/);
  assert.deepEqual(state, afterFirst, "重复处理同一邮件时不得新增第二条线索。");
}

function testSqliteRoundTripPreservesSourceAndLinkage() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-triage-lead-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const state = fixture();
    const result = createTriageLead(state, {
      mail_id: "MAIL-LEAD",
      social_url: "https://instagram.com/newcreator",
    }, now);
    const python = resolvePython();
    runBridge(python, "save_state", dbPath, statePath, state);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    const lead = loaded.leads.find((item) => item.id === result.lead.id);
    const mail = loaded.mailInbox.find((item) => item.id === "MAIL-LEAD");
    assert.equal(lead.source_mail_inbox_id, "MAIL-LEAD");
    assert.equal(lead.source_mail_message_id, "<new-message@example.com>");
    assert.equal(lead.source_mail_server_key, "mail.example/INBOX/802");
    assert.equal(lead.source_mail_imap_uid, "802");
    assert.equal(mail.lead_id, lead.id);
    assert.equal(mail.triage_status, "lead_created");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

testCreateLeadPreservesMailIdentityWithoutWorkflowSideEffects();
testDuplicateLeadAndCreatorRejectWithoutMutation();
testCrossBrandAndUnsafeMailRejectWithoutMutation();
testSecondExecutionIsRejected();
testSqliteRoundTripPreservesSourceAndLinkage();
console.log("PASS mail triage lead regression");
