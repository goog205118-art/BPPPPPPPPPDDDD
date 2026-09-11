const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scoreMailRouting } = require("./mail-routing-domain.cjs");
const { routeMailRecord } = require("./mail-sync.cjs");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");

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

function emptyState() {
  return {
    brands: [],
    creators: [],
    leads: [],
    cases: [],
    followUps: [],
    followUpEvents: [],
    contactTracks: [],
  };
}

function creator(id, brandId, email) {
  return {
    id,
    brand_id: brandId,
    brand: brandId,
    name: id,
    email,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function caseRow(id, brandId, creatorId) {
  return {
    id,
    brand_id: brandId,
    creator_id: creatorId,
    stage: "初步沟通",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function followUp(id, brandId, creatorId, caseId) {
  return {
    id,
    brand_id: brandId,
    creator_id: creatorId,
    case_id: caseId,
    stage: "初步沟通",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function inbound(email, extra = {}) {
  return {
    id: `MAIL-${email}`,
    sender: `Creator <${email}>`,
    recipients: "Brand Team <outreach@example.com>",
    direction: "inbound",
    occurred_at: "2026-09-11T08:00:00.000Z",
    ...extra,
  };
}

function assertUniqueThreadRoute() {
  const state = {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "A" }, { id: "BR-B", name: "B" }],
    creators: [creator("CR-A", "BR-A", "thread@example.com")],
    cases: [caseRow("CASE-A", "BR-A", "CR-A")],
    followUps: [followUp("FU-A", "BR-A", "CR-A", "CASE-A")],
    followUpEvents: [{
      id: "EV-A",
      brand_id: "BR-A",
      case_id: "CASE-A",
      follow_up_id: "FU-A",
      message_id: "root@example.com",
      direction: "outbound",
    }],
  };
  const result = scoreMailRouting(state, inbound("thread@example.com", {
    in_reply_to: "<root@example.com>",
  }), { id: "MAILBOX", brand_ids: ["BR-A", "BR-B"] });

  assert.equal(result.disposition, "unique");
  assert.equal(result.brand_id, "BR-A");
  assert.equal(result.creator_id, "CR-A");
  assert.equal(result.follow_up_id, "FU-A");
  assert.equal(result.case_id, "CASE-A");
  assert.ok(result.score >= 100);
  assert.ok(result.candidates[0].evidence.some((item) => item.rule === "thread_reference"));
  assert.deepEqual(result.candidate_brand_ids, ["BR-A"]);
}

function assertSharedMailboxAmbiguity() {
  const state = {
    ...emptyState(),
    creators: [
      creator("CR-A", "BR-A", "shared@example.com"),
      creator("CR-B", "BR-B", "shared@example.com"),
    ],
    cases: [
      caseRow("CASE-A", "BR-A", "CR-A"),
      caseRow("CASE-B", "BR-B", "CR-B"),
    ],
    followUps: [
      followUp("FU-A", "BR-A", "CR-A", "CASE-A"),
      followUp("FU-B", "BR-B", "CR-B", "CASE-B"),
    ],
  };
  const result = scoreMailRouting(state, inbound("shared@example.com"), {
    id: "MAILBOX",
    brand_ids: ["BR-A", "BR-B"],
  });

  assert.equal(result.disposition, "ambiguous");
  assert.equal(result.brand_id, "");
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidate_brand_ids, ["BR-A", "BR-B"]);
  assert.match(result.reasons[0], /人工确认/);
}

function assertThirtyDayWindowAndWeakIdentity() {
  const state = {
    ...emptyState(),
    creators: [{
      ...creator("CR-WINDOW", "BR-A", "window@example.com"),
      last_outreach_at: "2026-09-06T08:00:00.000Z",
    }, creator("CR-STALE", "BR-A", "stale@example.com")],
  };
  const account = { id: "MAILBOX", brand_ids: ["BR-A"] };
  const windowResult = scoreMailRouting(state, inbound("window@example.com"), account);
  const staleResult = scoreMailRouting(state, inbound("stale@example.com"), account);

  assert.equal(windowResult.disposition, "unique");
  assert.ok(windowResult.candidates[0].evidence.some((item) => item.rule === "first_outreach_reply_window"));
  assert.equal(staleResult.disposition, "unmatched", "仅邮箱命中但没有活跃 Case、线程或首联窗口时不得自动归档。");
  assert.ok(staleResult.candidates[0].evidence.some((item) => item.rule === "contact_identity"));
}

function assertTwoActiveCasesRemainAmbiguous() {
  const state = {
    ...emptyState(),
    creators: [creator("CR-A", "BR-A", "repeat@example.com")],
    cases: [
      caseRow("CASE-1", "BR-A", "CR-A"),
      caseRow("CASE-2", "BR-A", "CR-A"),
    ],
    followUps: [
      followUp("FU-1", "BR-A", "CR-A", "CASE-1"),
      followUp("FU-2", "BR-A", "CR-A", "CASE-2"),
    ],
  };
  const result = scoreMailRouting(state, inbound("repeat@example.com"), {
    id: "MAILBOX",
    brand_ids: ["BR-A"],
  });

  assert.equal(result.disposition, "ambiguous");
  assert.deepEqual(result.candidate_case_ids, ["CASE-1", "CASE-2"]);
  assert.equal(result.brand_id, "BR-A", "同品牌歧义可保留品牌范围，但不得选择具体 Case。");
}

function assertRouteCarriesExplainableMatch() {
  const state = {
    ...emptyState(),
    creators: [creator("CR-A", "BR-A", "route@example.com")],
    cases: [caseRow("CASE-A", "BR-A", "CR-A")],
    followUps: [followUp("FU-A", "BR-A", "CR-A", "CASE-A")],
  };
  const routed = routeMailRecord(state, inbound("route@example.com"), {
    id: "MAILBOX",
    brand_ids: ["BR-A"],
  });

  assert.equal(routed.kind, "followup");
  assert.equal(routed.match.disposition, "unique");
  assert.equal(routed.match.case_id, "CASE-A");
  assert.ok(routed.match.candidates[0].evidence.length >= 2);
}

function assertSQLitePreservesRoutingEvidence() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-mail-routing-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const payload = {
      meta: { version: 1, updatedAt: "2026-09-11T12:00:00.000Z" },
      mailInbox: [{
        id: "INBOX-ROUTE-A",
        brand_id: "BR-A",
        case_id: "",
        mailbox_account_id: "MAILBOX-A",
        type: "email",
        occurred_at: "2026-09-11T08:00:00.000Z",
        direction: "inbound",
        subject: "合作咨询",
        sender: "Creator <shared@example.com>",
        recipients: "Brand Team <outreach@example.com>",
        excerpt: "想继续了解合作。",
        body: "",
        status: "needs_followup",
        candidate_creator_ids: ["CR-A", "CR-B"],
        candidate_brand_ids: ["BR-A", "BR-B"],
        candidate_follow_up_ids: ["FU-A", "FU-B"],
        candidate_case_ids: ["CASE-A", "CASE-B"],
        match_disposition: "ambiguous",
        match_score: 85,
        match_reasons: ["最高分候选与其他候选分差不足，必须人工确认归属。"],
        match_candidates: [{
          brand_id: "BR-A",
          creator_id: "CR-A",
          lead_id: "",
          follow_up_id: "FU-A",
          case_id: "CASE-A",
          score: 85,
          evidence: [
            { rule: "contact_identity", weight: 35, detail: "邮件发件人命中已登记联系人邮箱。" },
            { rule: "active_follow_up", weight: 30, detail: "联系人关联当前品牌的活跃合作跟进。" },
            { rule: "active_case", weight: 20, detail: "联系人关联当前品牌的活跃合作 Case。" },
          ],
        }],
        createdAt: "2026-09-11T08:00:00.000Z",
        updatedAt: "2026-09-11T08:00:00.000Z",
      }],
    };
    const python = resolvePython();
    runBridge(python, "save_state", dbPath, statePath, payload);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    assert.equal(loaded.mailInbox.length, 1);
    assert.deepEqual(
      {
        disposition: loaded.mailInbox[0].match_disposition,
        score: loaded.mailInbox[0].match_score,
        reasons: loaded.mailInbox[0].match_reasons,
        candidateCaseIds: loaded.mailInbox[0].candidate_case_ids,
        candidates: loaded.mailInbox[0].match_candidates,
      },
      {
        disposition: "ambiguous",
        score: 85,
        reasons: ["最高分候选与其他候选分差不足，必须人工确认归属。"],
        candidateCaseIds: ["CASE-A", "CASE-B"],
        candidates: payload.mailInbox[0].match_candidates,
      },
      "待归档邮件的评分、候选 Case 与逐条证据必须在 SQLite 往返后完整保留。",
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

assertUniqueThreadRoute();
assertSharedMailboxAmbiguity();
assertThirtyDayWindowAndWeakIdentity();
assertTwoActiveCasesRemainAmbiguous();
assertRouteCarriesExplainableMatch();
assertSQLitePreservesRoutingEvidence();
console.log("PASS mail routing score regression");
