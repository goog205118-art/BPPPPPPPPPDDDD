const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const localServerSource = fs.readFileSync(path.join(rootDir, "tools", "local-server.cjs"), "utf8");
const onlineApiSource = fs.readFileSync(path.join(rootDir, "api", "[...route].mjs"), "utf8");
const onlineStoreSource = fs.readFileSync(path.join(rootDir, "tools", "online-record-store.cjs"), "utf8");
const browserSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");

function resolvePython() {
  for (const candidate of [
    ...(process.env.PYTHON_EXECUTABLE ? [{ command: process.env.PYTHON_EXECUTABLE, args: [] }] : []),
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
  ]) {
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

function fixture(version = 1, note = "初始") {
  return {
    expectedVersion: version,
    meta: { version, updatedAt: "2026-09-12T12:00:00.000Z" },
    brands: [{ id: "BR-A", name: "HSU", createdAt: "2026-09-12T12:00:00.000Z", updatedAt: "2026-09-12T12:00:00.000Z" }],
    creators: [{
      id: "CR-A",
      brand_id: "BR-A",
      brand: "HSU",
      name: "Creator A",
      notes: note,
      createdAt: "2026-09-12T12:00:00.000Z",
      updatedAt: "2026-09-12T12:00:00.000Z",
    }],
  };
}

function testSqliteVersionGuard() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-concurrency-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const python = resolvePython();

    const first = bridge(python, "save_state", dbPath, statePath, fixture());
    assert.equal(first.ok, true);
    assert.equal(first.version, 2);

    const second = bridge(python, "save_state", dbPath, statePath, fixture(2, "较新的编辑"));
    assert.equal(second.ok, true);
    assert.equal(second.version, 3);

    const stale = bridge(python, "save_state", dbPath, statePath, fixture(2, "旧页面编辑"));
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "version_conflict");
    assert.equal(stale.actualVersion, 3);
    assert.equal(stale.current.creators[0].notes, "较新的编辑");

    const loaded = bridge(python, "load_state", dbPath, statePath);
    assert.equal(loaded.meta.version, 3);
    assert.equal(loaded.creators[0].notes, "较新的编辑");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function request(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json() };
}

async function testLocalApiVersionGuard() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-local-api-"));
  const port = 4300 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, ["tools/local-server.cjs"], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port), RESOURCE_WORKBENCH_STORAGE_DIR: tempDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}/api/state`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // The local server may still be starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "本地 API 未能启动。");

    const initial = await (await fetch(`${baseUrl}/api/state`)).json();
    const first = await request(baseUrl, { ...initial, expectedVersion: initial.meta.version });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.state.meta.version, initial.meta.version + 1);

    const stale = await request(baseUrl, { ...initial, expectedVersion: initial.meta.version });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.code, "version_conflict");
    assert.equal(stale.body.current.meta.version, initial.meta.version + 1);
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testSourceContracts() {
  assert.match(localServerSource, /expectedVersion/);
  assert.match(localServerSource, /statusCode = 409/);
  assert.match(onlineApiSource, /createOnlineRecordStore/);
  assert.match(onlineApiSource, /state-operations/);
  assert.match(onlineStoreSource, /version_conflict/);
  assert.match(onlineStoreSource, /actualVersion/);
  assert.match(onlineStoreSource, /conflictForPatches/);
  assert.match(browserSource, /let persistQueue = Promise\.resolve\(\)/);
  assert.match(browserSource, /let persistKnownServerVersion = 1/);
  assert.match(browserSource, /const stateSnapshot = clone\(state\.data\)/);
  assert.match(browserSource, /const queued = persistQueue\.catch\(\(\) => undefined\)\.then\(run\)/);
  assert.match(browserSource, /if \(requestId === latestPersistRequestId && savedState\)/);
  assert.match(browserSource, /error\.current = errorPayload\.current/);
  assert.doesNotMatch(browserSource, /localStorage\.setItem\(STORAGE_FALLBACK, payload\)/);
}

testSqliteVersionGuard();
testSourceContracts();
testLocalApiVersionGuard()
  .then(() => console.log("PASS storage concurrency regression: SQLite and local API reject stale state writes without overwriting newer data."))
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
