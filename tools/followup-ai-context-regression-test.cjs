const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const storageDir = path.join(os.tmpdir(), `resource-workbench-followup-ai-context-${process.pid}-${Date.now()}`);
const port = 45000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let fakeAiServer;
let fakeAiBaseUrl = "";
const fakeAiRequests = [];

function emptyState() {
  return {
    meta: { version: 1, updatedAt: "2026-09-11T00:00:00.000Z" },
    brands: [],
    creators: [],
    resources: [],
    leads: [],
    products: [],
    cooperations: [],
    matches: [],
    cases: [],
    followUps: [],
    followUpEvents: [],
    mailInbox: [],
    contactTracks: [],
    actionTasks: [],
    actionTaskEvents: [],
    importHistory: [],
  };
}

function fixtureState() {
  const now = new Date().toISOString();
  const bodyCachedAt = now;
  const validRetention = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...emptyState(),
    brands: [
      { id: "BR-A", name: "当前品牌", createdAt: now, updatedAt: now },
      { id: "BR-B", name: "其他品牌", createdAt: now, updatedAt: now },
    ],
    creators: [
      {
        id: "CR-A",
        brand_id: "BR-A",
        brand: "当前品牌",
        name: "CURRENT-CREATOR",
        email: "creator-a@example.com",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "CR-A-OTHER",
        brand_id: "BR-A",
        brand: "当前品牌",
        name: "CONFLICT-CREATOR",
        email: "creator-other@example.com",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "CR-B",
        brand_id: "BR-B",
        brand: "其他品牌",
        name: "CROSS-BRAND-CREATOR",
        email: "creator-b@example.com",
        createdAt: now,
        updatedAt: now,
      },
    ],
    leads: [
      { id: "LEAD-A", brand_id: "BR-A", brand: "当前品牌", name: "CURRENT-LEAD", email: "lead-a@example.com", createdAt: now, updatedAt: now },
      { id: "LEAD-A-OTHER", brand_id: "BR-A", brand: "当前品牌", name: "CONFLICT-LEAD", email: "lead-other@example.com", createdAt: now, updatedAt: now },
    ],
    products: [
      { id: "PR-A", brand_id: "BR-A", brand: "当前品牌", name: "CURRENT-PRODUCT-ONLY", description: "CURRENT-PRODUCT-DESCRIPTION", createdAt: now, updatedAt: now },
      { id: "PR-A-OTHER", brand_id: "BR-A", brand: "当前品牌", name: "OTHER-CASE-PRODUCT", description: "OTHER-CASE-PRODUCT-SECRET", createdAt: now, updatedAt: now },
      { id: "PR-B", brand_id: "BR-B", brand: "其他品牌", name: "CROSS-BRAND-PRODUCT", description: "CROSS-BRAND-PRODUCT-SECRET", createdAt: now, updatedAt: now },
    ],
    cooperations: [
      { id: "CO-A", brand_id: "BR-A", brand: "当前品牌", creator_id: "CR-A", cooperation_no: "CURRENT-COOP-ONLY", product: "CURRENT-PRODUCT-ONLY", createdAt: now, updatedAt: now },
      { id: "CO-A-OTHER", brand_id: "BR-A", brand: "当前品牌", creator_id: "CR-A", cooperation_no: "OTHER-CASE-COOP", product: "OTHER-CASE-PRODUCT", createdAt: now, updatedAt: now },
      { id: "CO-B", brand_id: "BR-B", brand: "其他品牌", creator_id: "CR-B", cooperation_no: "CROSS-BRAND-COOP", product: "CROSS-BRAND-PRODUCT", createdAt: now, updatedAt: now },
    ],
    cases: [
      {
        id: "CASE-A",
        brand_id: "BR-A",
        brand: "当前品牌",
        creator_id: "CR-A",
        lead_id: "LEAD-A",
        cooperation_id: "CO-A",
        product_ids: ["PR-A"],
        stage: "初步沟通",
        priority: "高",
        budget: 500,
        quote_amount: 700,
        shipping_status: "待确认地址",
        next_action: "CURRENT-CASE-NEXT-ACTION",
        notes: "CURRENT-CASE-NOTES",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "CASE-A-OTHER",
        brand_id: "BR-A",
        brand: "当前品牌",
        creator_id: "CR-A",
        cooperation_id: "CO-A-OTHER",
        product_ids: ["PR-A-OTHER"],
        stage: "合作协商",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "CASE-B",
        brand_id: "BR-B",
        brand: "其他品牌",
        creator_id: "CR-B",
        cooperation_id: "CO-B",
        product_ids: ["PR-B"],
        stage: "初步沟通",
        createdAt: now,
        updatedAt: now,
      },
    ],
    followUps: [
      {
        id: "FU-A",
        brand_id: "BR-A",
        brand: "当前品牌",
        case_id: "CASE-A",
        creator_id: "CR-A",
        lead_id: "LEAD-A",
        cooperation_id: "CO-A",
        creator_name: "CURRENT-CREATOR",
        stage: "初步沟通",
        next_action: "CURRENT-FOLLOWUP-NEXT-ACTION",
        createdAt: now,
        updatedAt: now,
      },
    ],
    followUpEvents: [
      {
        id: "EV-CURRENT",
        brand_id: "BR-A",
        follow_up_id: "FU-A",
        case_id: "CASE-A",
        type: "email",
        direction: "inbound",
        subject: "CURRENT-SUBJECT",
        excerpt: "CURRENT-SUMMARY-ONLY",
        body: "CURRENT-FULL-BODY-ONLY",
        body_cached_at: bodyCachedAt,
        body_retention_until: validRetention,
        body_truncated: false,
        occurred_at: "2026-09-10T10:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "EV-EXPIRED",
        brand_id: "BR-A",
        follow_up_id: "FU-A",
        case_id: "CASE-A",
        type: "email",
        direction: "outbound",
        subject: "EXPIRED-SUBJECT",
        excerpt: "EXPIRED-SUMMARY-ONLY",
        body: "EXPIRED-BODY-MUST-NOT-ENTER",
        body_cached_at: bodyCachedAt,
        body_retention_until: "2020-01-01T00:00:00.000Z",
        body_truncated: false,
        occurred_at: "2026-09-10T11:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "EV-CROSS-BRAND",
        brand_id: "BR-B",
        follow_up_id: "FU-A",
        case_id: "CASE-A",
        type: "email",
        direction: "inbound",
        subject: "CROSS-BRAND-SUBJECT",
        excerpt: "CROSS-BRAND-EVENT-SECRET",
        body: "CROSS-BRAND-BODY-SECRET",
        body_cached_at: bodyCachedAt,
        body_retention_until: validRetention,
        occurred_at: "2026-09-10T12:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "EV-CROSS-CASE",
        brand_id: "BR-A",
        follow_up_id: "FU-A",
        case_id: "CASE-A-OTHER",
        type: "email",
        direction: "inbound",
        subject: "CROSS-CASE-SUBJECT",
        excerpt: "CROSS-CASE-EVENT-SECRET",
        body: "CROSS-CASE-BODY-SECRET",
        body_cached_at: bodyCachedAt,
        body_retention_until: validRetention,
        occurred_at: "2026-09-10T13:00:00.000Z",
        createdAt: now,
        updatedAt: now,
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
        const payload = JSON.parse((await readRequestBody(req)) || "{}");
        const prompt = String(payload.messages?.find((message) => message?.role === "user")?.content || "");
        fakeAiRequests.push({ pathname: req.url, prompt });
        const isDraft = /^You write a concise English creator collaboration follow-up email/m.test(prompt);
        const content = isDraft
          ? { subject: "Test follow-up", body: "Hello,\n\nCould you confirm the next step?\n\nBest Regards\nThis must be removed", warnings: [] }
          : {
              summary_cn: "仅基于测试资料给出的摘要。",
              suggested_stage: "初步沟通",
              confidence: "low",
              key_facts: ["测试事实"],
              recommended_options: [{ id: "reply", label: "回复", description: "测试策略" }],
              risk_notes: [],
              recommended_next_action: "回复",
              recommended_follow_up_days: 3,
              warnings: [],
            };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
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
        if ((await fetch(`${baseUrl}/api/state`)).ok) return resolve();
      } catch {
        // Server initialization creates an isolated SQLite database.
      }
      if (Date.now() >= deadline) return reject(new Error("AI 上下文隔离测试服务启动超时。"));
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

function jsonOptions(method, payload) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function saveState(state) {
  const result = await request("/api/state", jsonOptions("POST", state));
  assert.equal(result.response.status, 200, `保存隔离状态失败：${result.payload.error || ""}`);
  return result.payload;
}

async function expectRejected(mutator, message) {
  const state = fixtureState();
  mutator(state);
  await saveState(state);
  const result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A" }));
  assert.equal(result.response.status, 400, message);
}

function assertPromptIsolation(prompt, options = {}) {
  const requireFullBody = Boolean(options.requireFullBody);
  for (const forbidden of [
    "FRONTEND-BRAND-SPOOF",
    "FRONTEND-CASE-SPOOF",
    "FRONTEND-CONTEXT-SPOOF",
    "FRONTEND-EVENT-SPOOF",
    "FRONTEND-BODY-SPOOF",
    "CROSS-BRAND-CREATOR",
    "CROSS-BRAND-PRODUCT",
    "CROSS-BRAND-PRODUCT-SECRET",
    "CROSS-BRAND-COOP",
    "OTHER-CASE-PRODUCT",
    "OTHER-CASE-PRODUCT-SECRET",
    "OTHER-CASE-COOP",
    "CROSS-BRAND-EVENT-SECRET",
    "CROSS-BRAND-BODY-SECRET",
    "CROSS-CASE-EVENT-SECRET",
    "CROSS-CASE-BODY-SECRET",
    "EXPIRED-BODY-MUST-NOT-ENTER",
  ]) {
    assert.doesNotMatch(prompt, new RegExp(forbidden), `Prompt 不得包含隔离资料：${forbidden}`);
  }
  const required = ["CURRENT-CREATOR", "CURRENT-PRODUCT-ONLY", "CURRENT-COOP-ONLY", "CURRENT-CASE-NEXT-ACTION"];
  if (requireFullBody) required.push("CURRENT-FULL-BODY-ONLY");
  for (const value of required) {
    assert.match(prompt, new RegExp(value), `Prompt 应包含当前 Case 的服务端资料：${value}`);
  }
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
      WORKBENCH_CREDENTIAL_ENCRYPTION_KEY: "followup-ai-context-test-key",
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

  await expectRejected((state) => {
    state.followUps[0].case_id = "";
  }, "未关联 Case 的 FollowUp 必须拒绝 AI 分析。");
  await expectRejected((state) => {
    state.followUps[0].case_id = "CASE-MISSING";
  }, "关联 Case 不存在时必须拒绝 AI 分析。");
  await expectRejected((state) => {
    state.cases.find((row) => row.id === "CASE-A").brand_id = "BR-B";
  }, "FollowUp 与 Case 跨品牌时必须拒绝 AI 分析。");
  await expectRejected((state) => {
    state.cases.find((row) => row.id === "CASE-A").creator_id = "CR-A-OTHER";
  }, "creator_id 冲突时必须拒绝 AI 分析。");
  await expectRejected((state) => {
    state.cases.find((row) => row.id === "CASE-A").lead_id = "LEAD-A-OTHER";
  }, "lead_id 冲突时必须拒绝 AI 分析。");
  await expectRejected((state) => {
    state.cases.find((row) => row.id === "CASE-A").cooperation_id = "CO-A-OTHER";
  }, "cooperation_id 冲突时必须拒绝 AI 分析。");
  let result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-MISSING" }));
  assert.equal(result.response.status, 400, "不存在的 FollowUp 必须拒绝 AI 分析。");

  await saveState(fixtureState());
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
  assert.equal(result.response.status, 200, `保存测试 AI 设置失败：${result.payload.error || output}`);

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", { contentPolicy: { cacheBodies: true, allowAiContext: false, retentionDays: 30 } }),
  );
  assert.equal(result.response.status, 200, `保存未授权正文策略失败：${result.payload.error || output}`);
  fakeAiRequests.length = 0;
  result = await request(
    "/api/ai/followup-analyze",
    jsonOptions("POST", {
      followUpId: "FU-A",
      userNote: "FRONTEND-CONTEXT-SPOOF",
      brandId: "FRONTEND-BRAND-SPOOF",
      caseId: "FRONTEND-CASE-SPOOF",
      context: "FRONTEND-CONTEXT-SPOOF",
      events: [{ body: "FRONTEND-EVENT-SPOOF" }],
      body: "FRONTEND-BODY-SPOOF",
    }),
  );
  assert.equal(result.response.status, 200, `未授权正文分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1);
  assert.match(fakeAiRequests[0].prompt, /CURRENT-SUMMARY-ONLY/);
  assert.doesNotMatch(fakeAiRequests[0].prompt, /CURRENT-FULL-BODY-ONLY/);
  assertPromptIsolation(fakeAiRequests[0].prompt.replace("FRONTEND-CONTEXT-SPOOF", ""));
  assert.equal(result.payload.context_scope.source, "server_persisted_case_context");
  assert.equal(result.payload.context_scope.brand_id, "BR-A");
  assert.equal(result.payload.context_scope.case_id, "CASE-A");
  assert.equal(result.payload.context_scope.follow_up_id, "FU-A");
  assert.deepEqual(result.payload.context_scope.evidence_event_ids.sort(), ["EV-CURRENT", "EV-EXPIRED"]);
  assert.equal(result.payload.context_scope.evidence_count, 2);
  assert.equal(result.payload.context_scope.event_scope_counts.withheld, 1);
  assert.equal(result.payload.context_scope.event_scope_counts.expired, 1);
  assert.deepEqual(result.payload.context_scope.excluded, {
    cross_brand: 1,
    cross_case: 1,
    unlinked: 0,
    context_limited: 0,
  });
  assert.match(result.payload.context_scope.missing.join("\n"), /邮件正文未授权给 AI/);

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", { contentPolicy: { cacheBodies: true, allowAiContext: true, retentionDays: 30 } }),
  );
  assert.equal(result.response.status, 200, `保存已授权正文策略失败：${result.payload.error || output}`);
  fakeAiRequests.length = 0;
  result = await request(
    "/api/ai/followup-analyze",
    jsonOptions("POST", { followUpId: "FU-A", userNote: "人工备注可以进入 Prompt" }),
  );
  assert.equal(result.response.status, 200, `已授权正文分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1);
  assertPromptIsolation(fakeAiRequests[0].prompt, { requireFullBody: true });
  assert.equal(result.payload.context_scope.event_scope_counts.full_body, 1);
  assert.equal(result.payload.context_scope.event_scope_counts.expired, 1);
  assert.match(result.payload.context_scope.missing.join("\n"), /部分正文已过期/);

  fakeAiRequests.length = 0;
  result = await request(
    "/api/ai/followup-draft",
    jsonOptions("POST", { followUpId: "FU-A", strategyId: "reply", customIntent: "请确认合作下一步" }),
  );
  assert.equal(result.response.status, 200, `AI 草稿请求失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1);
  assertPromptIsolation(fakeAiRequests[0].prompt, { requireFullBody: true });
  assert.equal(result.payload.context_scope.brand_id, "BR-A", "草稿接口也必须返回服务端证据范围。");
  assert.equal(result.payload.context_scope.case_id, "CASE-A");
  assert.doesNotMatch(result.payload.body, /Best Regards/i, "草稿清理不得保留模型自带签名。");

  result = await request(
    "/api/mail/settings",
    jsonOptions("POST", { contentPolicy: { cacheBodies: false, allowAiContext: false, retentionDays: 30 } }),
  );
  assert.equal(result.response.status, 200, `关闭正文缓存失败：${result.payload.error || output}`);
  fakeAiRequests.length = 0;
  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A" }));
  assert.equal(result.response.status, 200, `关闭正文缓存后的分析失败：${result.payload.error || output}`);
  assert.equal(fakeAiRequests.length, 1);
  assert.doesNotMatch(fakeAiRequests[0].prompt, /CURRENT-FULL-BODY-ONLY/);
  assert.match(fakeAiRequests[0].prompt, /CURRENT-SUMMARY-ONLY/);

  console.log("PASS follow-up AI context regression: server-only Case scope, cross-brand/Case exclusions, body authorization/expiry fallback, structural context, and analysis/draft evidence scope.");
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
    console.error(`FAIL follow-up AI context regression: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
