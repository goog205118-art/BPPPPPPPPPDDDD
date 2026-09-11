const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const localServer = fs.readFileSync(path.join(rootDir, "tools", "local-server.cjs"), "utf8");
const onlineApi = fs.readFileSync(path.join(rootDir, "api", "[...route].mjs"), "utf8");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");

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

function testStateShapeContracts() {
  for (const [name, source] of [
    ["本地服务", localServer],
    ["线上 API", onlineApi],
    ["浏览器状态", appSource],
  ]) {
    assert.match(source, /actionTasks:\s*\[\]/, `${name} 默认状态必须含 actionTasks。`);
    assert.match(source, /actionTasks/, `${name} 归一化必须处理 actionTasks。`);
    assert.match(source, /行动任务与 Case 品牌不一致/, `${name} 必须阻止跨品牌任务静默改挂。`);
  }
}

function testSqliteRoundTrip() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-action-task-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const payload = {
      meta: { version: 1, updatedAt: "2026-09-10T12:00:00.000Z" },
      brands: [{ id: "BR-A", name: "HSU", createdAt: "2026-09-10T12:00:00.000Z", updatedAt: "2026-09-10T12:00:00.000Z" }],
      cases: [{
        id: "CASE-A",
        brand_id: "BR-A",
        brand: "HSU",
        creator_id: "CR-A",
        stage: "初步沟通",
        priority: "普通",
        version: 1,
        createdAt: "2026-09-10T12:00:00.000Z",
        updatedAt: "2026-09-10T12:00:00.000Z",
      }],
      actionTasks: [{
        id: "TASK-A",
        brand_id: "BR-A",
        brand: "HSU",
        case_id: "CASE-A",
        source: "manual",
        source_id: "",
        type: "reply",
        title: "回复达人",
        description: "确认内容方向。",
        owner_id: "USER-A",
        owner_name: "运营 A",
        priority: "高",
        due_at: "2026-09-11T09:00:00.000Z",
        status: "待处理",
        completion_evidence: "",
        completed_at: "",
        dedupe_key: "",
        generated: false,
        validation_error: "",
        version: 1,
        createdAt: "2026-09-10T12:00:00.000Z",
        updatedAt: "2026-09-10T12:00:00.000Z",
      }],
    };
    const python = resolvePython();
    runBridge(python, "save_state", dbPath, statePath, payload);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    assert.equal(loaded.actionTasks.length, 1, "行动任务必须独立保存，而非依赖页面筛选状态。");
    assert.deepEqual(
      {
        id: loaded.actionTasks[0].id,
        case_id: loaded.actionTasks[0].case_id,
        owner_name: loaded.actionTasks[0].owner_name,
        status: loaded.actionTasks[0].status,
        generated: loaded.actionTasks[0].generated,
      },
      {
        id: "TASK-A",
        case_id: "CASE-A",
        owner_name: "运营 A",
        status: "待处理",
        generated: false,
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

testStateShapeContracts();
testSqliteRoundTrip();
console.log("PASS action-task storage regression: state contracts and isolated SQLite round-trip.");
