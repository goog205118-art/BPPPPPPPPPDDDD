const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  deliveryPolicy,
  evaluateSendPolicy,
  applyDeliveryNotification,
  classifyDeliveryNotification,
  markContactBlacklisted,
  markContactUnsubscribed,
} = require("./delivery-governance-domain.cjs");

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
  assert.equal(result.status, 0, `${command} 失败：${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function outbound(id, brandId, contactId, recipients, occurredAt = "2026-09-12T08:00:00.000Z") {
  return {
    id,
    brand_id: brandId,
    person_type: "creator",
    person_id: "CR-1",
    contact_id: contactId,
    direction: "outbound",
    type: "email",
    message_id: `<${id}@example.com>`,
    recipients,
    occurred_at: occurredAt,
    createdAt: occurredAt,
    delivery_status: "unknown",
    delivery_source: "",
    delivery_event_at: "",
    delivery_error: "",
    delivery_code: "",
    delivery_message_id: "",
  };
}

function baseState() {
  return {
    meta: { version: 1, updatedAt: "2026-09-12T12:00:00.000Z" },
    creators: [{
      id: "CR-1",
      brand_id: "BR-A",
      brand: "Brand A",
      name: "Creator One",
      email: "creator@example.com",
    }],
    contacts: [{
      id: "CONTACT-1",
      brand_id: "BR-A",
      brand: "Brand A",
      person_type: "creator",
      person_id: "CR-1",
      email: "creator@example.com",
      role: "primary",
      is_primary: true,
      validity: "valid",
      unsubscribed: false,
      blacklisted: false,
      delivery_status: "unknown",
    }],
    followUpEvents: [],
    mailInbox: [],
  };
}

function assertAllowedAndFrequencyControl() {
  const state = baseState();
  const contact = state.contacts[0];
  const settings = { deliveryPolicy: { windowDays: 7, maxOutbound: 3 } };
  assert.equal(deliveryPolicy(settings).maxOutbound, 3);
  assert.equal(evaluateSendPolicy({
    state,
    settings,
    brandId: "BR-A",
    personType: "creator",
    personId: "CR-1",
    contact,
    recipientEmails: [contact.email],
    now: new Date("2026-09-12T12:00:00.000Z"),
  }).allowed, true);

  state.followUpEvents = [
    outbound("OUT-1", "BR-A", "CONTACT-1", "creator@example.com"),
    outbound("OUT-2", "BR-A", "CONTACT-1", "creator@example.com", "2026-09-10T08:00:00.000Z"),
    outbound("OUT-3", "BR-A", "CONTACT-1", "creator@example.com", "2026-09-08T08:00:00.000Z"),
    outbound("OUT-OTHER-BRAND", "BR-B", "CONTACT-1", "creator@example.com"),
    outbound("OUT-OLD", "BR-A", "CONTACT-1", "creator@example.com", "2026-08-01T08:00:00.000Z"),
  ];
  assert.throws(() => evaluateSendPolicy({
    state,
    settings,
    brandId: "BR-A",
    personType: "creator",
    personId: "CR-1",
    contact,
    recipientEmails: [contact.email],
    now: new Date("2026-09-12T12:00:00.000Z"),
  }), (error) => error.code === "outreach_frequency_limited" && error.governance.recentOutboundCount === 3);

  assert.equal(evaluateSendPolicy({
    state,
    settings,
    brandId: "BR-B",
    personType: "creator",
    personId: "CR-1",
    contact: { ...contact, brand_id: "BR-B" },
    recipientEmails: [contact.email],
    now: new Date("2026-09-12T12:00:00.000Z"),
  }).allowed, true, "不同品牌不能共享触达频控");
}

function assertBlockedContactStates() {
  const state = baseState();
  const settings = { deliveryPolicy: { maxOutbound: 10 } };
  const input = {
    state,
    settings,
    brandId: "BR-A",
    personType: "creator",
    personId: "CR-1",
    recipientEmails: ["creator@example.com"],
    now: new Date("2026-09-12T12:00:00.000Z"),
  };
  const unsubscribed = markContactUnsubscribed({ ...state.contacts[0] });
  assert.throws(() => evaluateSendPolicy({ ...input, contact: unsubscribed }), (error) => error.code === "contact_unsubscribed");
  const blacklisted = markContactBlacklisted({ ...state.contacts[0] }, "投诉");
  assert.throws(() => evaluateSendPolicy({ ...input, contact: blacklisted }), (error) => error.code === "contact_blacklisted");
  assert.throws(() => evaluateSendPolicy({
    ...input,
    contact: { ...state.contacts[0], validity: "invalid" },
  }), (error) => error.code === "contact_invalid");
  assert.throws(() => evaluateSendPolicy({
    ...input,
    contact: { ...state.contacts[0], delivery_status: "bounced" },
  }), (error) => error.code === "contact_invalid");
}

function assertDeliveryNotificationMatching() {
  const state = baseState();
  state.followUpEvents = [outbound("OUT-1", "BR-A", "CONTACT-1", "creator@example.com")];
  const notification = {
    id: "DSN-1",
    sender: "MAILER-DAEMON <mailer-daemon@example.com>",
    subject: "Delivery Status Notification (Failure)",
    body: "The message to creator@example.com could not be delivered. 550 User unknown.",
    in_reply_to: "<OUT-1@example.com>",
    references: ["<OUT-1@example.com>"],
    message_id: "<DSN-1@example.com>",
  };
  const classified = classifyDeliveryNotification(notification);
  assert.equal(classified.isDeliveryNotification, true);
  assert.equal(classified.status, "bounced");
  assert.equal(classified.failedRecipient, "creator@example.com");
  const result = applyDeliveryNotification(state, notification, "2026-09-12T12:00:00.000Z");
  assert.equal(result.matched, true);
  assert.equal(result.targetEventId, "OUT-1");
  assert.equal(state.followUpEvents[0].delivery_status, "bounced");
  assert.equal(state.followUpEvents[0].delivery_message_id, "<DSN-1@example.com>");
  assert.equal(state.contacts[0].validity, "invalid");
  assert.equal(result.record.delivery_match_status, "matched");

  const noBrackets = applyDeliveryNotification({
    ...baseState(),
    followUpEvents: [outbound("OUT-2", "BR-A", "CONTACT-1", "creator@example.com")],
  }, {
    ...notification,
    id: "DSN-2",
    in_reply_to: "OUT-2@example.com",
    references: "OUT-2@example.com",
  });
  assert.equal(noBrackets.matched, true, "Message-ID 允许带或不带尖括号");

  const crossBrand = {
    ...baseState(),
    contacts: [
      { ...baseState().contacts[0], id: "CONTACT-A", brand_id: "BR-A" },
      { ...baseState().contacts[0], id: "CONTACT-B", brand_id: "BR-B" },
    ],
    followUpEvents: [
      outbound("OUT-A", "BR-A", "CONTACT-A", "creator@example.com"),
      outbound("OUT-B", "BR-B", "CONTACT-B", "creator@example.com"),
    ],
  };
  const unmatched = applyDeliveryNotification(crossBrand, {
    ...notification,
    id: "DSN-3",
    in_reply_to: "",
    references: [],
  });
  assert.equal(unmatched.matched, false, "共享邮箱跨品牌且无线程证据时不能猜测归属");
  assert.equal(unmatched.record.delivery_match_status, "unmatched");
}

function assertSQLiteRoundTrip() {
  const python = resolvePython();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-delivery-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const state = {
      ...baseState(),
      followUpEvents: [outbound("OUT-DB", "BR-A", "CONTACT-1", "creator@example.com")],
      mailInbox: [{
        id: "DSN-DB",
        status: "delivery_notification",
        delivery_notification: true,
        delivery_match_status: "matched",
        delivery_status: "bounced",
        delivery_source: "imap_dsn",
        delivery_event_at: "2026-09-12T12:00:00.000Z",
        delivery_error: "550 User unknown",
        delivery_code: "550",
        delivery_message_id: "DSN-DB@example.com",
        delivery_target_event_id: "OUT-DB",
      }],
    };
    fs.writeFileSync(statePath, JSON.stringify(state), "utf8");
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    const saved = runBridge(python, "save_state", dbPath, statePath, {
      ...loaded,
      expectedVersion: loaded.meta.version,
      contacts: [{
        ...loaded.contacts[0],
        blacklisted: true,
        blacklist_reason: "测试",
        delivery_status: "blacklisted",
      }],
    });
    assert.equal(saved.ok, true);
    const roundTrip = runBridge(python, "load_state", dbPath, statePath);
    assert.equal(roundTrip.contacts[0].blacklisted, true);
    assert.equal(roundTrip.contacts[0].delivery_status, "blacklisted");
    assert.equal(roundTrip.mailInbox[0].delivery_notification, true);
    assert.equal(roundTrip.mailInbox[0].delivery_code, "550");
    assert.equal(roundTrip.followUpEvents[0].delivery_status, "unknown");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

assertAllowedAndFrequencyControl();
assertBlockedContactStates();
assertDeliveryNotificationMatching();
assertSQLiteRoundTrip();
console.log("delivery governance regression: ok");
