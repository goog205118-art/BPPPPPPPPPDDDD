const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  contactsForPerson,
  personEmailAddresses,
} = require("./contact-domain.cjs");
const { scoreMailRouting } = require("./mail-routing-domain.cjs");
const { routeMailRecord } = require("./mail-sync.cjs");
const { createOnlineRecordStore } = require("./online-record-store.cjs");

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
    cases: Array.isArray(state?.cases) ? state.cases : [],
    followUps: Array.isArray(state?.followUps) ? state.followUps : [],
    contacts: Array.isArray(state?.contacts) ? state.contacts : [],
    contactTracks: Array.isArray(state?.contactTracks) ? state.contactTracks : [],
    followUpEvents: Array.isArray(state?.followUpEvents) ? state.followUpEvents : [],
    actionTasks: Array.isArray(state?.actionTasks) ? state.actionTasks : [],
    actionTaskEvents: Array.isArray(state?.actionTaskEvents) ? state.actionTaskEvents : [],
    mailInbox: Array.isArray(state?.mailInbox) ? state.mailInbox : [],
    importHistory: Array.isArray(state?.importHistory) ? state.importHistory : [],
  };
}

function creator(id, brandId, email = "") {
  return {
    id,
    brand_id: brandId,
    brand: brandId,
    name: id,
    email,
    last_outreach_at: "2026-09-10T08:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function baseState() {
  return {
    meta: { version: 1, updatedAt: "2026-09-12T12:00:00.000Z" },
    brands: [{ id: "BR-A", name: "A" }, { id: "BR-B", name: "B" }],
    creators: [creator("CR-A", "BR-A")],
    contacts: [
      {
        id: "CONTACT-AGENT-A",
        brand_id: "BR-A",
        brand: "A",
        person_type: "creator",
        person_id: "CR-A",
        name: "Agent A",
        email: "agent@example.com",
        role: "agent",
        is_primary: false,
        validity: "valid",
        unsubscribed: false,
      },
      {
        id: "CONTACT-BIZ-A",
        brand_id: "BR-A",
        brand: "A",
        person_type: "creator",
        person_id: "CR-A",
        name: "Business A",
        email: "business@example.com",
        role: "business",
        is_primary: true,
        validity: "valid",
        unsubscribed: false,
      },
      {
        id: "CONTACT-CC-A",
        brand_id: "BR-A",
        brand: "A",
        person_type: "creator",
        person_id: "CR-A",
        name: "CC A",
        email: "cc@example.com",
        role: "cc",
        is_primary: false,
        validity: "unknown",
        unsubscribed: false,
      },
    ],
    cases: [{
      id: "CASE-A",
      brand_id: "BR-A",
      creator_id: "CR-A",
      stage: "初步沟通",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    }],
    followUps: [{
      id: "FU-A",
      brand_id: "BR-A",
      creator_id: "CR-A",
      case_id: "CASE-A",
      stage: "初步沟通",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    }],
    followUpEvents: [],
    contactTracks: [],
  };
}

function inbound(email, extra = {}) {
  return {
    id: `MAIL-${email}`,
    sender: `Contact <${email}>`,
    recipients: "Brand Team <outreach@example.com>",
    direction: "inbound",
    occurred_at: "2026-09-11T08:00:00.000Z",
    ...extra,
  };
}

function assertMultipleContactsRoute() {
  const state = baseState();
  assert.deepEqual(
    personEmailAddresses(state, "creator", state.creators[0], "BR-A").sort(),
    ["agent@example.com", "business@example.com", "cc@example.com"],
  );

  const result = scoreMailRouting(state, inbound("agent@example.com"), {
    id: "MAILBOX-A",
    brand_ids: ["BR-A"],
  });
  assert.equal(result.disposition, "unique");
  assert.equal(result.brand_id, "BR-A");
  assert.equal(result.creator_id, "CR-A");
  assert.equal(result.matched_contact_id, "CONTACT-AGENT-A");
  assert.equal(result.candidates[0].matched_contact_id, "CONTACT-AGENT-A");
  assert.ok(result.candidates[0].evidence.some((item) => item.rule === "contact_identity"));

  const routed = routeMailRecord(state, inbound("business@example.com"), {
    id: "MAILBOX-A",
    brand_ids: ["BR-A"],
  });
  assert.equal(routed.kind, "followup");
  assert.equal(routed.match.matched_contact_id, "CONTACT-BIZ-A");
  assert.equal(routed.followUp.id, "FU-A");
}

function assertLegacyContactCompatibility() {
  const state = {
    ...baseState(),
    creators: [{
      ...creator("CR-LEGACY", "BR-A", "legacy@example.com"),
      last_outreach_at: "",
    }],
    contacts: [],
    cases: [],
    followUps: [],
  };
  const contacts = contactsForPerson(state, "creator", "CR-LEGACY", "BR-A");
  assert.equal(contacts.length, 1);
  assert.match(contacts[0].id, /^LEGACY-CONTACT-/);
  assert.equal(contacts[0].id, contactsForPerson(state, "creator", "CR-LEGACY", "BR-A")[0].id);

  const result = scoreMailRouting(state, inbound("legacy@example.com"), {
    id: "MAILBOX-A",
    brand_ids: ["BR-A"],
  });
  assert.equal(result.disposition, "unmatched", "旧邮箱只有身份线索且没有活跃 Case 时仍不能自动归档。");
  assert.equal(result.matched_contact_id, "");
  assert.match(result.candidates[0].matched_contact_id, /^LEGACY-CONTACT-/);
}

function assertBrandIsolationForSharedEmail() {
  const state = {
    ...baseState(),
    creators: [
      { ...creator("CR-A", "BR-A"), last_outreach_at: "" },
      { ...creator("CR-B", "BR-B"), last_outreach_at: "" },
    ],
    contacts: [
      {
        id: "CONTACT-A-SHARED",
        brand_id: "BR-A",
        person_type: "creator",
        person_id: "CR-A",
        email: "shared@example.com",
        role: "business",
        validity: "valid",
      },
      {
        id: "CONTACT-B-SHARED",
        brand_id: "BR-B",
        person_type: "creator",
        person_id: "CR-B",
        email: "shared@example.com",
        role: "business",
        validity: "valid",
      },
    ],
    cases: [],
    followUps: [],
  };
  const result = scoreMailRouting(state, inbound("shared@example.com"), {
    id: "MAILBOX-A",
    brand_ids: ["BR-A"],
  });
  assert.equal(result.disposition, "unmatched");
  assert.deepEqual(result.candidate_brand_ids, ["BR-A"]);
  assert.equal(result.candidates[0].matched_contact_id, "CONTACT-A-SHARED");
}

function assertSQLiteRoundTrip() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-contact-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const state = {
      ...baseState(),
      mailInbox: [{
        id: "INBOX-A",
        brand_id: "BR-A",
        matched_contact_id: "CONTACT-AGENT-A",
        match_disposition: "unique",
        match_candidates: [{
          brand_id: "BR-A",
          creator_id: "CR-A",
          matched_contact_id: "CONTACT-AGENT-A",
          score: 85,
        }],
      }],
      contactTracks: [{
        id: "TRACK-A",
        brand_id: "BR-A",
        person_type: "creator",
        person_id: "CR-A",
        contact_id: "CONTACT-AGENT-A",
        email: "agent@example.com",
      }],
    };
    const python = resolvePython();
    runBridge(python, "save_state", dbPath, statePath, state);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    assert.equal(loaded.contacts.length, 3);
    assert.equal(loaded.contactTracks[0].contact_id, "CONTACT-AGENT-A");
    assert.equal(loaded.mailInbox[0].matched_contact_id, "CONTACT-AGENT-A");
    assert.equal(loaded.mailInbox[0].match_candidates[0].matched_contact_id, "CONTACT-AGENT-A");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function assertOnlinePatchRoundTrip() {
  const state = { ...baseState(), contacts: baseState().contacts.slice(0, 1) };
  const next = {
    ...state,
    contacts: [...state.contacts, {
      id: "CONTACT-NEW",
      brand_id: "BR-A",
      person_type: "creator",
      person_id: "CR-A",
      email: "new@example.com",
      role: "other",
    }],
  };
  const online = createOnlineRecordStore({
    defaultState: state,
    normalizeState: normalize,
    readLegacy: async (fallback) => fallback,
    listOperations: async () => [],
    appendOperation: async () => {},
  });
  const patch = online.buildPatch(state, next);
  assert.deepEqual(patch.contacts.upsert.map((row) => row.id), ["CONTACT-NEW"]);
  const applied = online.applyPatch(state, patch, normalize);
  assert.equal(applied.contacts.length, 2);
  assert.equal(applied.contacts[1].email, "new@example.com");
}

async function run() {
  assertMultipleContactsRoute();
  assertLegacyContactCompatibility();
  assertBrandIsolationForSharedEmail();
  assertSQLiteRoundTrip();
  await assertOnlinePatchRoundTrip();
  console.log("PASS contact identity regression: multiple contacts, legacy email, brand isolation, SQLite and online patch round-trips.");
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
