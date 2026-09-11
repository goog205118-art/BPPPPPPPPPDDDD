const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const storageDir = path.join(os.tmpdir(), `resource-workbench-followup-ai-analysis-${process.pid}-${Date.now()}`);
const port = 46000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let fakeAiServer;
let fakeAiBaseUrl = "";

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
  const now = "2026-09-11T09:00:00.000Z";
  return {
    ...emptyState(),
    brands: [{ id: "BR-A", name: "当前品牌", createdAt: now, updatedAt: now }],
    creators: [{ id: "CR-A", brand_id: "BR-A", brand: "当前品牌", name: "测试达人", email: "creator@example.com", createdAt: now, updatedAt: now }],
    products: [{ id: "PR-A", brand_id: "BR-A", brand: "当前品牌", name: "测试产品", createdAt: now, updatedAt: now }],
    cases: [{
      id: "CASE-A",
      brand_id: "BR-A",
      brand: "当前品牌",
      creator_id: "CR-A",
      product_ids: ["PR-A"],
      stage: "初步沟通",
      next_action: "确认合作方式",
      notes: "已有人工备注",
      createdAt: now,
      updatedAt: now,
    }],
    followUps: [{
      id: "FU-A",
      brand_id: "BR-A",
      brand: "当前品牌",
      case_id: "CASE-A",
      creator_id: "CR-A",
      creator_name: "测试达人",
      stage: "初步沟通",
      next_action: "确认合作方式",
      createdAt: now,
      updatedAt: now,
    }],
    followUpEvents: [{
      id: "EV-A",
      brand_id: "BR-A",
      follow_up_id: "FU-A",
      case_id: "CASE-A",
      type: "email",
      direction: "inbound",
      subject: "合作咨询",
      excerpt: "达人表示愿意了解合作方式，但尚未确认报价。",
      occurred_at: now,
      createdAt: now,
      updatedAt: now,
    }],
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
        const malformed = prompt.includes("MALFORMED-MODE");
        const content = malformed
          ? {
              summary_cn: "",
              confidence: "certain",
              key_facts: "不是数组",
              recommended_options: [{ id: "only", label: "不完整策略", description: "" }],
              missing_information: "不是数组",
              risk_notes: "不是数组",
            }
          : {
              summary_cn: "达人已表达愿意了解合作方式，但尚未确认具体报价。",
              counterparty_intent_cn: "愿意继续沟通合作方式，等待我方补充具体合作条件。",
              suggested_stage: "合作协商",
              confidence: "medium",
              key_facts: ["达人明确愿意了解合作方式", "当前未确认报价"],
              missing_information: ["达人可接受的合作方式", "报价或置换条件"],
              recommended_options: [
                { id: "clarify_terms", label: "确认合作条件", description: "先明确置换、付费或 CPS 等可选合作方式。" },
                { id: "ask_quote", label: "询问报价", description: "请达人提供合作报价与预期交付内容。" },
              ],
              risk_notes: ["不得将未确认的合作方式写成已达成。"],
              recommended_next_action: "先确认合作条件",
              recommended_follow_up_days: 2,
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
        // The isolated SQLite database is created during startup.
      }
      if (Date.now() >= deadline) return reject(new Error("AI 工作台测试服务启动超时。"));
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
      WORKBENCH_CREDENTIAL_ENCRYPTION_KEY: "followup-ai-analysis-test-key",
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
  assert.equal(result.response.status, 200, `保存隔离状态失败：${result.payload.error || output}`);
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

  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "请重点确认合作方式。" }));
  assert.equal(result.response.status, 200, `正常 AI 研判失败：${result.payload.error || output}`);
  assert.equal(result.payload.counterparty_intent_cn, "愿意继续沟通合作方式，等待我方补充具体合作条件。");
  assert.deepEqual(result.payload.missing_information.slice(0, 2), ["达人可接受的合作方式", "报价或置换条件"]);
  assert.equal(result.payload.suggested_stage, "合作协商", "建议阶段必须作为只读结果返回。");
  assert.equal(result.payload.recommended_options.length, 2);
  assert.deepEqual(result.payload.recommended_options.map((option) => option.id), ["clarify_terms", "ask_quote"]);

  let stored = await request("/api/state");
  assert.equal(stored.response.status, 200);
  assert.equal(stored.payload.cases.find((item) => item.id === "CASE-A").stage, "初步沟通", "AI 分析不得改变 Case 阶段。");
  assert.equal(stored.payload.followUps.find((item) => item.id === "FU-A").stage, "初步沟通", "AI 分析不得改变 FollowUp 阶段。");
  assert.equal(stored.payload.followUpEvents.length, 1, "AI 分析不得新增邮件或审计事件。");

  result = await request("/api/ai/followup-analyze", jsonOptions("POST", { followUpId: "FU-A", userNote: "MALFORMED-MODE" }));
  assert.equal(result.response.status, 200, `异常模型输出必须安全降级：${result.payload.error || output}`);
  assert.equal(result.payload.confidence, "low");
  assert.equal(result.payload.counterparty_intent_cn, "当前证据不足，无法可靠判断对方意图。");
  assert.equal(result.payload.recommended_options.length, 2, "异常模型输出也必须补足两项人工可选策略。");
  assert.ok(result.payload.recommended_options.every((option) => option.id && option.label && option.description));
  assert.ok(Array.isArray(result.payload.missing_information));

  stored = await request("/api/state");
  assert.equal(stored.payload.cases.find((item) => item.id === "CASE-A").stage, "初步沟通", "降级分析不得改变 Case 阶段。");
  assert.equal(stored.payload.followUps.find((item) => item.id === "FU-A").stage, "初步沟通", "降级分析不得改变 FollowUp 阶段。");
  assert.equal(stored.payload.followUpEvents.length, 1, "降级分析不得写入沟通历史。");

  const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
  assert.match(appSource, /对方当前意图/, "详情页必须展示对方意图。");
  assert.match(appSource, /待补信息/, "详情页必须展示待补信息。");
  assert.match(appSource, /some\(\(option\) => text\(option\?\.id\) === previousStrategyId\)/, "再次分析必须保留仍有效的人工策略选择。");

  console.log("PASS follow-up AI analysis workbench: Chinese intent/missing-information contract, safe malformed-output fallback, read-only stage protection, and manual strategy persistence UI.");
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
    console.error(`FAIL follow-up AI analysis workbench: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
