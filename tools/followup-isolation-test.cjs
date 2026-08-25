const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
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
    importHistory: [],
  };
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
  assert.match(result.payload.context_notice, /1 封完整正文/);

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

  console.log("PASS follow-up isolation regression: brand isolation, body authorization, expiry cleanup, protected AI failure, blocked cross-brand SMTP.");
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
