const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  applyRetention,
  previewRetention,
} = require("./compliance-retention-domain.cjs");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");

function resolvePython() {
  const candidates = [
    ...(process.env.PYTHON_EXECUTABLE ? [{ command: process.env.PYTHON_EXECUTABLE, args: [] }] : []),
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
  ];
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.args, "--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  throw new Error("测试需要 Python 3，但当前环境未找到 Python。");
}

function bridge(python, command, dbPath, statePath, payload) {
  const result = spawnSync(
    python.command,
    [...python.args, sqliteBridge, command, dbPath, statePath],
    {
      cwd: rootDir,
      encoding: "utf8",
      input: payload === undefined ? "" : JSON.stringify(payload),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    },
  );
  assert.equal(result.status, 0, `SQLite bridge ${command} 失败：${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function normalize(state) {
  return {
    meta: { version: 1, ...(state?.meta || {}) },
    brands: Array.isArray(state?.brands) ? state.brands : [],
    creators: Array.isArray(state?.creators) ? state.creators : [],
    resources: Array.isArray(state?.resources) ? state.resources : [],
    leads: Array.isArray(state?.leads) ? state.leads : [],
    products: Array.isArray(state?.products) ? state.products : [],
    cooperations: Array.isArray(state?.cooperations) ? state.cooperations : [],
    matches: Array.isArray(state?.matches) ? state.matches : [],
    followUps: Array.isArray(state?.followUps) ? state.followUps : [],
    cases: Array.isArray(state?.cases) ? state.cases : [],
    actionTasks: Array.isArray(state?.actionTasks) ? state.actionTasks : [],
    actionTaskEvents: Array.isArray(state?.actionTaskEvents) ? state.actionTaskEvents : [],
    followUpEvents: Array.isArray(state?.followUpEvents) ? state.followUpEvents : [],
    contacts: Array.isArray(state?.contacts) ? state.contacts : [],
    contactTracks: Array.isArray(state?.contactTracks) ? state.contactTracks : [],
    mailInbox: Array.isArray(state?.mailInbox) ? state.mailInbox : [],
    importHistory: Array.isArray(state?.importHistory) ? state.importHistory : [],
    complianceAudit: Array.isArray(state?.complianceAudit) ? state.complianceAudit : [],
  };
}

function fixture() {
  return normalize({
    meta: { version: 3 },
    brands: [
      { id: "BR-A", name: "HSU" },
      { id: "BR-B", name: "ALT" },
    ],
    creators: [{ id: "CR-A", brand_id: "BR-A", brand: "HSU", name: "Creator A" }],
    leads: [{ id: "LEAD-A", brand_id: "BR-A", brand: "HSU", name: "Lead A" }],
    cases: [{ id: "CASE-A", brand_id: "BR-A", creator_id: "CR-A", stage: "初步沟通" }],
    cooperations: [{ id: "COOP-A", brand_id: "BR-A", creator_id: "CR-A", result: "合作中" }],
    followUps: [{ id: "FU-A", brand_id: "BR-A", case_id: "CASE-A", creator_id: "CR-A", stage: "初步沟通" }],
    contacts: [{
      id: "CONTACT-A",
      brand_id: "BR-A",
      person_type: "creator",
      person_id: "CR-A",
      name: "Creator A",
      email: "creator@example.com",
      role: "primary",
    }, {
      id: "CONTACT-B",
      brand_id: "BR-B",
      person_type: "creator",
      person_id: "CR-B",
      name: "Creator B",
      email: "creator@example.com",
      role: "primary",
    }],
    followUpEvents: [{
      id: "EVENT-A",
      brand_id: "BR-A",
      case_id: "CASE-A",
      follow_up_id: "FU-A",
      contact_id: "CONTACT-A",
      sender: "creator@example.com",
      direction: "inbound",
      body: "完整正文 A",
      excerpt: "摘要 A",
      message_id: "<message-a@example.com>",
      in_reply_to: "<outbound-a@example.com>",
      references: ["<outbound-a@example.com>"],
      delivery_status: "accepted",
    }, {
      id: "EVENT-B",
      brand_id: "BR-B",
      contact_id: "CONTACT-B",
      sender: "creator@example.com",
      body: "完整正文 B",
      excerpt: "摘要 B",
      message_id: "<message-b@example.com>",
      delivery_status: "bounced",
    }],
    mailInbox: [{
      id: "MAIL-A",
      brand_id: "BR-A",
      matched_contact_id: "CONTACT-A",
      sender: "creator@example.com",
      body: "收件箱正文 A",
      excerpt: "收件箱摘要 A",
      message_id: "<inbox-a@example.com>",
      delivery_status: "unsubscribed",
    }, {
      id: "MAIL-B",
      brand_id: "BR-B",
      matched_contact_id: "CONTACT-B",
      sender: "creator@example.com",
      body: "收件箱正文 B",
      excerpt: "收件箱摘要 B",
      message_id: "<inbox-b@example.com>",
      delivery_status: "failed",
    }],
  });
}

function testDomainContract() {
  const state = fixture();
  assert.throws(
    () => previewRetention(state, {
      brandId: "BR-A",
      contactId: "CONTACT-B",
      scopes: ["email_bodies"],
      actorName: "测试者",
      reason: "跨品牌拒绝测试",
    }),
    /联系人不存在或不属于当前品牌/,
  );

  const preview = previewRetention(state, {
    brandId: "BR-A",
    contactId: "CONTACT-A",
    scopes: ["email_bodies", "contact_identity"],
    actorName: "测试者",
    reason: "最小化留存测试",
    requestId: "REQ-A",
  });
  assert.deepEqual(preview.counts, {
    followUpEvents: 1,
    mailInbox: 1,
    emailBodies: 2,
    activeContacts: 1,
    alreadyDeletedContacts: 0,
  });

  const result = applyRetention(state, {
    brandId: "BR-A",
    contactId: "CONTACT-A",
    scopes: ["email_bodies", "contact_identity"],
    actorId: "USER-1",
    actorName: "测试者",
    reason: "用户请求删除",
    requestId: "REQ-A",
  }, new Date("2026-09-12T12:00:00.000Z"));
  assert.equal(result.audit.affected_email_bodies, 2);
  assert.equal(result.state.followUpEvents[0].body, "");
  assert.equal(result.state.followUpEvents[0].excerpt, "摘要 A");
  assert.equal(result.state.followUpEvents[0].message_id, "<message-a@example.com>");
  assert.equal(result.state.followUpEvents[0].delivery_status, "accepted");
  assert.equal(result.state.mailInbox[0].body, "");
  assert.equal(result.state.contacts.find((row) => row.id === "CONTACT-A").is_deleted, true);
  assert.equal(result.state.cases.length, 1);
  assert.equal(result.state.cooperations.length, 1);
  assert.equal(result.state.creators.length, 1);
  assert.equal(result.state.leads.length, 1);
  assert.equal(result.state.followUpEvents.find((row) => row.id === "EVENT-B").body, "完整正文 B");
  assert.equal(result.state.mailInbox.find((row) => row.id === "MAIL-B").body, "收件箱正文 B");
  assert.equal(result.state.complianceAudit.length, 1);
  assert.equal(result.state.complianceAudit[0].reason, "用户请求删除");

  const repeated = applyRetention(result.state, {
    brandId: "BR-A",
    contactId: "CONTACT-A",
    scopes: ["email_bodies", "contact_identity"],
    actorName: "测试者",
    reason: "用户请求删除",
    requestId: "REQ-A",
  });
  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.state.complianceAudit.length, 1);

  const dryRun = applyRetention(state, {
    brandId: "BR-A",
    contactId: "CONTACT-A",
    scopes: ["email_bodies"],
    actorName: "测试者",
    reason: "预览",
    requestId: "REQ-DRY",
    dryRun: true,
  });
  assert.equal(dryRun.state.followUpEvents[0].body, "完整正文 A");
  assert.equal(dryRun.state.complianceAudit.length, 0);
}

function testSqliteRoundTrip() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-retention-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const python = resolvePython();
    const state = fixture();
    const result = bridge(python, "save_state", dbPath, statePath, state);
    assert.equal(result.ok, true);
    const loaded = bridge(python, "load_state", dbPath, statePath);
    assert.equal(loaded.contacts[0].is_deleted, false);
    assert.equal(loaded.complianceAudit.length, 0);

    const withAudit = {
      ...loaded,
      expectedVersion: loaded.meta.version,
      contacts: loaded.contacts.map((row) => row.id === "CONTACT-A"
        ? { ...row, is_deleted: true, deleted_at: "2026-09-12T12:00:00.000Z", deleted_by: "USER-1", deletion_reason: "测试" }
        : row),
      complianceAudit: [{
        id: "COMPLIANCE-TEST",
        action: "retention_apply",
        brand_id: "BR-A",
        contact_id: "CONTACT-A",
        scopes: ["email_bodies", "contact_identity"],
        request_id: "REQ-A",
        actor_id: "USER-1",
        actor_name: "测试者",
        source: "test",
        reason: "测试",
        affected_email_bodies: 2,
        affected_follow_up_events: 1,
        affected_mail_inbox: 1,
        affected_contacts: 1,
        createdAt: "2026-09-12T12:00:00.000Z",
        updatedAt: "2026-09-12T12:00:00.000Z",
      }],
    };
    bridge(python, "save_state", dbPath, statePath, withAudit);
    const roundTrip = bridge(python, "load_state", dbPath, statePath);
    const contact = roundTrip.contacts.find((row) => row.id === "CONTACT-A");
    assert.equal(contact.is_deleted, true);
    assert.equal(contact.deleted_by, "USER-1");
    assert.deepEqual(roundTrip.complianceAudit[0].scopes, ["email_bodies", "contact_identity"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

testDomainContract();
testSqliteRoundTrip();
console.log("PASS compliance retention regression: brand scope, evidence protection, soft deletion, idempotency, dry-run, and SQLite round-trip are covered.");
