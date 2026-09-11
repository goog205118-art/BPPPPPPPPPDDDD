const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const domain = require(path.join(rootDir, "tools", "crm-domain.cjs"));

const createdAt = "2026-09-11T09:00:00.000Z";

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

function fixture() {
  const state = {
    brands: [
      { id: "BR-A", name: "HSU" },
      { id: "BR-B", name: "Other" },
    ],
    cases: [
      domain.createCase({ id: "CASE-A", brand_id: "BR-A", brand: "HSU", creator_id: "CR-A", stage: "初步沟通" }, createdAt),
      domain.createCase({ id: "CASE-B", brand_id: "BR-B", brand: "Other", creator_id: "CR-B", stage: "待寄样" }, createdAt),
    ],
    followUps: [
      { id: "FU-A", brand_id: "BR-A", case_id: "CASE-A", stage: "初步沟通" },
      { id: "FU-B", brand_id: "BR-B", case_id: "CASE-B", stage: "待寄样" },
    ],
    followUpEvents: [],
    actionTasks: [],
    actionTaskEvents: [],
  };
  const taskA = domain.createActionTask(state, {
    id: "TASK-A",
    brand_id: "BR-A",
    case_id: "CASE-A",
    source: "manual",
    type: "reply",
    title: "回复达人",
    priority: "高",
    due_at: "2026-09-12T09:00:00.000Z",
  }, createdAt);
  const taskB = domain.createActionTask(state, {
    id: "TASK-B",
    brand_id: "BR-B",
    case_id: "CASE-B",
    source: "manual",
    type: "shipping",
    title: "登记寄样物流",
    priority: "中",
    due_at: "2026-09-12T09:00:00.000Z",
  }, createdAt);
  state.actionTasks.push(taskA, taskB);
  return state;
}

function taskById(state, taskId) {
  return state.actionTasks.find((task) => task.id === taskId);
}

function testEventsAndLifecycle() {
  const state = fixture();
  const task = taskById(state, "TASK-A");
  assert.deepEqual(
    domain.taskEventsForTask(state, task.id).map((event) => event.type),
    ["created"],
    "创建任务必须留下 created 事件。",
  );

  domain.assignTask(state, task.id, {
    owner_id: "USER-A",
    owner_name: "运营 A",
    actor_name: "管理员",
  }, "2026-09-11T10:00:00.000Z");
  assert.equal(task.owner_name, "运营 A");
  const assignment = domain.taskEventsForTask(state, task.id).at(-1);
  assert.equal(assignment.type, "assignment");
  assert.equal(assignment.metadata.previous_owner_name, "");
  assert.equal(assignment.metadata.owner_name, "运营 A");

  assert.throws(
    () => domain.addTaskNote(state, task.id, "", {}, "2026-09-11T11:00:00.000Z"),
    /备注不能为空/,
  );
  domain.addTaskNote(state, task.id, "已确认对方希望下周继续沟通。", {
    actor_name: "运营 A",
  }, "2026-09-11T11:00:00.000Z");
  assert.equal(domain.taskEventsForTask(state, task.id).at(-1).type, "note");

  assert.throws(
    () => domain.deferTask(state, task.id, "2026-09-13T09:00:00.000Z", "", "2026-09-11T12:00:00.000Z"),
    /必须填写原因/,
  );
  domain.deferTask(state, task.id, "2026-09-13T09:00:00.000Z", "等待达人确认档期。", "2026-09-11T12:00:00.000Z");
  assert.equal(task.defer_reason, "等待达人确认档期。");
  const deferred = domain.taskEventsForTask(state, task.id).at(-1);
  assert.equal(deferred.type, "defer");
  assert.equal(deferred.metadata.previous_due_at, "2026-09-12T09:00:00.000Z");

  domain.completeTask(state, task.id, "已完成首次沟通回复。", "2026-09-11T13:00:00.000Z");
  assert.equal(task.status, "已完成");
  assert.equal(domain.taskEventsForTask(state, task.id).at(-1).type, "complete");

  const skipped = taskById(state, "TASK-B");
  domain.skipTask(state, skipped.id, "当前不需要寄样。", "2026-09-11T14:00:00.000Z");
  assert.equal(skipped.status, "已跳过");
  assert.equal(domain.taskEventsForTask(state, skipped.id).at(-1).type, "skip");

  assert.deepEqual(
    domain.taskEventsForTask(state, task.id).map((event) => event.type),
    ["created", "assignment", "note", "defer", "complete"],
    "操作历史必须按发生时间追加并排序。",
  );
  assert.equal(state.cases.find((item) => item.id === "CASE-A").stage, "初步沟通");
  assert.equal(state.followUps.find((item) => item.id === "FU-A").stage, "初步沟通");
  assert.equal(state.followUpEvents.length, 0, "任务操作不得写入邮件/阶段事件或自动推进 Case。");
}

function testIsolationAndLegacyState() {
  const state = fixture();
  const taskA = taskById(state, "TASK-A");
  const taskB = taskById(state, "TASK-B");
  assert.throws(
    () => domain.appendTaskEvent(state, taskA, {
      type: "note",
      brand_id: "BR-B",
      summary: "不允许跨品牌。",
    }, "2026-09-11T10:00:00.000Z"),
    /品牌不一致/,
  );
  assert.throws(
    () => domain.appendTaskEvent(state, taskA, {
      type: "note",
      case_id: "CASE-B",
      summary: "不允许跨 Case。",
    }, "2026-09-11T10:00:00.000Z"),
    /Case 不一致/,
  );
  assert.equal(domain.taskEventsForTask(state, taskA.id).length, 1);
  assert.equal(domain.taskEventsForTask(state, taskB.id).length, 1);

  const legacy = {
    cases: [domain.createCase({ id: "CASE-LEGACY", brand_id: "BR-A", creator_id: "CR-A" }, createdAt)],
    actionTasks: [],
  };
  const legacyTask = domain.createActionTask(legacy, {
    id: "TASK-LEGACY",
    brand_id: "BR-A",
    case_id: "CASE-LEGACY",
    title: "兼容旧数据任务",
  }, createdAt);
  legacy.actionTasks.push(legacyTask);
  assert.equal(Array.isArray(legacy.actionTaskEvents), true, "旧数据缺少事件集合时必须自动初始化。");
  assert.equal(domain.taskEventsForTask(legacy, legacyTask.id).length, 1);
}

function testSqliteRoundTrip() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-task-collaboration-"));
  try {
    const state = fixture();
    const task = taskById(state, "TASK-A");
    domain.assignTask(state, task.id, {
      owner_id: "USER-A",
      owner_name: "运营 A",
    }, "2026-09-11T10:00:00.000Z");
    domain.deferTask(state, task.id, "2026-09-13T09:00:00.000Z", "等待回复。", "2026-09-11T11:00:00.000Z");
    const python = resolvePython();
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    runBridge(python, "save_state", dbPath, statePath, state);
    const loaded = runBridge(python, "load_state", dbPath, statePath);
    const loadedTask = loaded.actionTasks.find((row) => row.id === "TASK-A");
    const loadedEvents = loaded.actionTaskEvents
      .filter((row) => row.task_id === "TASK-A")
      .sort((left, right) => new Date(left.occurred_at) - new Date(right.occurred_at));
    assert.equal(loadedTask.defer_reason, "等待回复。");
    assert.deepEqual(loadedEvents.map((event) => event.type), ["created", "assignment", "defer"]);
    assert.deepEqual(loadedEvents.at(-1).metadata, {
      previous_due_at: "2026-09-12T09:00:00.000Z",
      due_at: "2026-09-13T09:00:00.000Z",
      reason: "等待回复。",
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

testEventsAndLifecycle();
testIsolationAndLegacyState();
testSqliteRoundTrip();
console.log("PASS task collaboration regression: assignment, notes, defer reasons, audit history, isolation, and SQLite round-trip.");
