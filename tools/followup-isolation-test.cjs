const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const storageDir = path.join(os.tmpdir(), `resource-workbench-followup-test-${process.pid}-${Date.now()}`);
const port = 44000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;

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
    importHistory: [],
  };
}

function fixtureState() {
  const now = "2026-08-25T00:00:00.000Z";
  return {
    ...emptyState(),
    brands: [
      { id: "BR-A", name: "品牌 A", createdAt: now, updatedAt: now },
      { id: "BR-B", name: "品牌 B", createdAt: now, updatedAt: now },
    ],
    creators: [
      {
        id: "CR-A",
        brand_id: "BR-A",
        brand: "品牌 A",
        name: "Creator A",
        email: "shared@example.com",
        social_url: "https://example.com/shared",
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

  server = spawn(process.execPath, ["tools/local-server.cjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      RESOURCE_WORKBENCH_STORAGE_DIR: storageDir,
      WORKBENCH_CREDENTIAL_ENCRYPTION_KEY: "followup-isolation-test-key",
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
  assert.equal(result.payload.creators.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.creators.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.products.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.products.filter((row) => row.brand_id === "BR-B").length, 1);
  assert.equal(result.payload.followUps.filter((row) => row.brand_id === "BR-A").length, 1);
  assert.equal(result.payload.followUps.filter((row) => row.brand_id === "BR-B").length, 1);
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
      ],
    }),
  );
  assert.equal(result.response.status, 200, `保存隔离邮箱设置失败：${result.payload.error || output}`);

  result = await request("/api/mail/settings");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.settings.accounts.length, 2);
  assert.equal(result.payload.settings.accounts.every((account) => account.imap.password === undefined && account.smtp.password === undefined), true);
  assert.deepEqual(
    result.payload.settings.accounts.map((account) => account.brand_id).sort(),
    ["BR-A", "BR-B"],
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
  assert.equal(finalState.followUpEvents.length, 2, "被拦截的跨品牌发信不得产生时间线记录。");
  assert.equal(finalState.followUps.find((row) => row.id === "FU-B").stage, "初步沟通", "被拦截的跨品牌发信不得改动合作阶段。");

  console.log("PASS follow-up isolation regression: two brands, two mailboxes, protected AI failure, blocked cross-brand SMTP.");
}

async function cleanup() {
  if (server && !server.killed) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
  }
  fs.rmSync(storageDir, { recursive: true, force: true });
}

run()
  .catch((error) => {
    console.error(`FAIL follow-up isolation regression: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
