const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  archiveTriageMail,
  createCase,
  createTriageCase,
  ignoreTriageMail,
  triageCandidateCases,
} = require("./crm-domain.cjs");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const now = "2026-09-11T16:00:00.000Z";

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

function caseRow(id, brandId, creatorId, stage = "初步沟通") {
  return createCase({
    id,
    brand_id: brandId,
    creator_id: creatorId,
    stage,
  }, now);
}

function mailRow(id, extra = {}) {
  return {
    id,
    brand_id: "BR-A",
    direction: "inbound",
    subject: "Re: Partnership",
    excerpt: "I would like to discuss the collaboration.",
    occurred_at: "2026-09-11T15:00:00.000Z",
    status: "needs_followup",
    candidate_creator_ids: ["CR-A"],
    candidate_case_ids: ["CASE-A"],
    match_disposition: "unique",
    match_score: 92,
    match_reasons: ["发件人邮箱、活跃 Case 与线程引用共同命中。"],
    match_candidates: [{
      brand_id: "BR-A",
      creator_id: "CR-A",
      case_id: "CASE-A",
      follow_up_id: "FU-A",
      score: 92,
      evidence: [{
        rule: "thread_reference",
        weight: 50,
        detail: "回复已知外联邮件线程。",
      }],
    }],
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function fixture() {
  return {
    creators: [
      { id: "CR-A", brand_id: "BR-A", name: "Creator A", email: "creator-a@example.com" },
      { id: "CR-B", brand_id: "BR-B", name: "Creator B", email: "creator-b@example.com" },
    ],
    cases: [
      caseRow("CASE-A", "BR-A", "CR-A"),
      caseRow("CASE-A-OTHER", "BR-A", "CR-A"),
      caseRow("CASE-B", "BR-B", "CR-B"),
      caseRow("CASE-A-CLOSED", "BR-A", "CR-A", "已结案"),
    ],
    followUpEvents: [],
    mailInbox: [mailRow("MAIL-A")],
  };
}

function testArchiveCandidateRules() {
  const state = fixture();
  assert.deepEqual(
    triageCandidateCases(state, state.mailInbox[0]).map((item) => item.id),
    ["CASE-A"],
    "候选列表只展示同品牌、未结案且在邮件候选范围内的 Case。",
  );

  const result = archiveTriageMail(state, {
    mail_id: "MAIL-A",
    case_id: "CASE-A",
    actor_name: "运营 A",
    reason: "人工确认线程归属。",
  }, now);
  assert.equal(result.mail.triage_status, "archived");
  assert.equal(result.mail.triage_reason, "人工确认线程归属。");
  assert.equal(result.mail.triage_resolved_by, "运营 A");
  assert.equal(state.followUpEvents.length, 1);
  assert.equal(state.followUpEvents[0].case_id, "CASE-A");

  assert.throws(
    () => archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-A" }, now),
    /已归档/,
    "同一邮件归档后不得重复写入时间线。",
  );
}

function testNoCrossBrandOrOutOfRangeArchive() {
  const crossBrandState = fixture();
  assert.throws(
    () => archiveTriageMail(crossBrandState, { mail_id: "MAIL-A", case_id: "CASE-B" }, now),
    /品牌不一致/,
    "分诊不能跨品牌归档。",
  );

  const outsideCandidateState = fixture();
  assert.throws(
    () => archiveTriageMail(outsideCandidateState, { mail_id: "MAIL-A", case_id: "CASE-A-OTHER" }, now),
    /候选范围/,
    "同品牌但不在候选范围的 Case 也不得归档。",
  );

  const noCandidateState = fixture();
  noCandidateState.mailInbox[0].candidate_case_ids = [];
  assert.deepEqual(triageCandidateCases(noCandidateState, noCandidateState.mailInbox[0]), []);
  assert.throws(
    () => archiveTriageMail(noCandidateState, { mail_id: "MAIL-A", case_id: "CASE-A" }, now),
    /候选范围/,
    "没有候选 Case 时不得退化为任意同品牌 Case。",
  );
}

function testIgnoreKeepsMailOutsideTimeline() {
  const state = fixture();
  const ignored = ignoreTriageMail(state, {
    mail_id: "MAIL-A",
    actor_name: "运营 A",
    reason: "系统通知，不是合作往来。",
  }, now);
  assert.equal(ignored.mail.triage_status, "ignored");
  assert.equal(ignored.mail.triage_reason, "系统通知，不是合作往来。");
  assert.equal(state.mailInbox.length, 1, "忽略必须保留原邮件。");
  assert.equal(state.followUpEvents.length, 0, "忽略不得写入 Case/FollowUp 时间线。");

  assert.throws(
    () => ignoreTriageMail(state, { mail_id: "MAIL-A", reason: "再次处理" }, now),
    /已忽略/,
  );
  assert.throws(
    () => archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-A" }, now),
    /已忽略/,
    "已忽略邮件不可再次归档。",
  );

  const missingReasonState = fixture();
  assert.throws(
    () => ignoreTriageMail(missingReasonState, { mail_id: "MAIL-A" }, now),
    /必须填写原因/,
  );
}

function testNewCaseRequiresUniqueExistingCreator() {
  const state = fixture();
  state.cases = state.cases.filter((item) => !["CASE-A", "CASE-A-OTHER"].includes(item.id));
  state.mailInbox[0].candidate_case_ids = [];
  const created = createTriageCase(state, {
    mail_id: "MAIL-A",
    creator_id: "CR-A",
    case_id: "CASE-NEW",
    priority: "高",
    next_action: "人工阅读邮件并确认合作意向",
    actor_name: "运营 A",
  }, now);
  assert.equal(created.case.id, "CASE-NEW");
  assert.equal(created.case.stage, "初步沟通", "新建 Case 必须从初步沟通开始。");
  assert.equal(created.mail.triage_status, "archived");
  assert.equal(state.followUpEvents.filter((item) => item.case_id === "CASE-NEW").length, 1);

  const ambiguousCreatorState = fixture();
  ambiguousCreatorState.cases = ambiguousCreatorState.cases.filter((item) => !["CASE-A", "CASE-A-OTHER"].includes(item.id));
  ambiguousCreatorState.mailInbox[0].candidate_creator_ids = ["CR-A", "CR-B"];
  ambiguousCreatorState.mailInbox[0].candidate_case_ids = [];
  assert.throws(
    () => createTriageCase(ambiguousCreatorState, {
      mail_id: "MAIL-A",
      creator_id: "CR-A",
      case_id: "CASE-AMBIGUOUS",
    }, now),
    /唯一识别/,
    "多达人候选时不得直接新建 Case。",
  );

  const crossBrandCreatorState = fixture();
  crossBrandCreatorState.cases = crossBrandCreatorState.cases.filter((item) => !["CASE-A", "CASE-A-OTHER"].includes(item.id));
  crossBrandCreatorState.mailInbox[0].candidate_creator_ids = ["CR-B"];
  crossBrandCreatorState.mailInbox[0].candidate_case_ids = [];
  assert.throws(
    () => createTriageCase(crossBrandCreatorState, {
      mail_id: "MAIL-A",
      creator_id: "CR-B",
      case_id: "CASE-CROSS",
    }, now),
    /品牌不一致/,
    "跨品牌达人不得用于新建 Case。",
  );

  const activeCaseState = fixture();
  activeCaseState.mailInbox[0].candidate_case_ids = [];
  assert.throws(
    () => createTriageCase(activeCaseState, {
      mail_id: "MAIL-A",
      creator_id: "CR-A",
      case_id: "CASE-DUPLICATE",
    }, now),
    /已有活跃 Case/,
    "已有活跃 Case 时必须归档到既有 Case，不能重复新建。",
  );
}

function testSQLiteRoundTrip() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-mail-triage-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const payload = {
      meta: { version: 1, updatedAt: now },
      mailInbox: [mailRow("MAIL-SQLITE", {
        triage_status: "ignored",
        triage_reason: "已由人工确认不是合作邮件。",
        triage_resolved_at: now,
        triage_resolved_by: "运营 A",
      })],
    };
    const python = resolvePython();
    runBridge(python, "save_state", dbPath, statePath, payload);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    const row = loaded.mailInbox.find((item) => item.id === "MAIL-SQLITE");
    assert.deepEqual(
      {
        triage_status: row.triage_status,
        triage_reason: row.triage_reason,
        triage_resolved_at: row.triage_resolved_at,
        triage_resolved_by: row.triage_resolved_by,
        match_reasons: row.match_reasons,
        candidate_case_ids: row.candidate_case_ids,
        match_candidates: row.match_candidates,
      },
      {
        triage_status: "ignored",
        triage_reason: "已由人工确认不是合作邮件。",
        triage_resolved_at: now,
        triage_resolved_by: "运营 A",
        match_reasons: payload.mailInbox[0].match_reasons,
        candidate_case_ids: ["CASE-A"],
        match_candidates: payload.mailInbox[0].match_candidates,
      },
      "SQLite 往返必须完整保留分诊决定、匹配理由、候选 Case 与逐条规则证据。",
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

testArchiveCandidateRules();
testNoCrossBrandOrOutOfRangeArchive();
testIgnoreKeepsMailOutsideTimeline();
testNewCaseRequiresUniqueExistingCreator();
testSQLiteRoundTrip();
console.log("PASS mail triage console regression");
