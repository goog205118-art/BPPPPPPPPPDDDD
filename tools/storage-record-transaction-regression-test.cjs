const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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
  return result;
}

function bridgeJson(python, command, dbPath, statePath, payload) {
  const result = bridge(python, command, dbPath, statePath, payload);
  assert.equal(result.status, 0, `SQLite bridge ${command} 失败：${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function runPython(python, script, ...args) {
  const result = spawnSync(python.command, [...python.args, "-c", script, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  assert.equal(result.status, 0, `SQLite 检查脚本失败：${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function payload(version, creatorRows) {
  return {
    expectedVersion: version,
    meta: { version, updatedAt: `2026-09-12T12:0${version}:00.000Z` },
    brands: [{
      id: "BR-A",
      name: "HSU",
      createdAt: "2026-09-12T12:00:00.000Z",
      updatedAt: "2026-09-12T12:00:00.000Z",
    }],
    creators: creatorRows,
  };
}

function creator(id, notes) {
  return {
    id,
    brand_id: "BR-A",
    brand: "HSU",
    name: id,
    notes,
    createdAt: "2026-09-12T12:00:00.000Z",
    updatedAt: "2026-09-12T12:00:00.000Z",
  };
}

function testRecordWritesAndRecovery() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-workbench-record-tx-"));
  try {
    const dbPath = path.join(tempDir, "test.sqlite3");
    const statePath = path.join(tempDir, "state.json");
    const python = resolvePython();

    bridgeJson(python, "save_state", dbPath, statePath, payload(1, [
      creator("CR-A", "初始 A"),
      creator("CR-B", "初始 B"),
    ]));

    runPython(
      python,
      `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.executescript("""
CREATE TABLE delete_audit (id TEXT);
CREATE TRIGGER creators_delete_audit AFTER DELETE ON creators
BEGIN
  INSERT INTO delete_audit(id) VALUES (OLD.id);
END;
CREATE TRIGGER creators_fail BEFORE UPDATE OF notes ON creators
WHEN NEW.notes = 'FAIL'
BEGIN
  SELECT RAISE(ABORT, 'intentional test failure');
END;
""")
conn.commit()
conn.close()
`,
      dbPath,
    );

    const updated = bridgeJson(python, "save_state", dbPath, statePath, payload(2, [
      creator("CR-A", "只修改 A"),
      creator("CR-B", "初始 B"),
    ]));
    assert.equal(updated.version, 3);
    const afterUpdate = bridgeJson(python, "load_state", dbPath, statePath);
    assert.equal(afterUpdate.creators.length, 2);
    assert.equal(afterUpdate.creators.find((row) => row.id === "CR-A").notes, "只修改 A");
    assert.equal(afterUpdate.creators.find((row) => row.id === "CR-B").notes, "初始 B");
    assert.equal(
      runPython(python, "import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute('SELECT COUNT(*) FROM delete_audit').fetchone()[0])", dbPath),
      "0",
      "修改记录不能触发整表删除。",
    );

    bridgeJson(python, "save_state", dbPath, statePath, payload(3, [creator("CR-A", "删除 B")]));
    assert.equal(
      runPython(python, "import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute('SELECT id FROM delete_audit').fetchone()[0])", dbPath),
      "CR-B",
      "删除记录只能删除提交中移除的记录。",
    );

    const failed = bridge(python, "save_state", dbPath, statePath, payload(4, [creator("CR-A", "FAIL")]));
    assert.notEqual(failed.status, 0, "触发数据库异常时保存必须失败。");
    const afterRollback = bridgeJson(python, "load_state", dbPath, statePath);
    assert.equal(afterRollback.meta.version, 4);
    assert.equal(afterRollback.creators[0].notes, "删除 B");

    assert.equal(fs.existsSync(`${dbPath}.bak`), true, "成功保存后必须存在可恢复 SQLite 备份。");
    bridgeJson(python, "save_state", dbPath, statePath, payload(4, [creator("CR-A", "第五版")]));
    assert.equal(bridgeJson(python, "load_state", dbPath, statePath).creators[0].notes, "第五版");

    const restored = bridgeJson(python, "restore_backup", dbPath, statePath);
    assert.equal(restored.version, 4);
    const afterRestore = bridgeJson(python, "load_state", dbPath, statePath);
    assert.equal(afterRestore.meta.version, 4);
    assert.equal(afterRestore.creators[0].notes, "删除 B");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testSourceContract() {
  const source = fs.readFileSync(path.join(rootDir, "tools", "sqlite_store.py"), "utf8");
  assert.match(source, /ON CONFLICT\(\{sql_identifier\('id'\)\}\) DO UPDATE SET/);
  assert.match(source, /create_recovery_backup/);
  assert.match(source, /restore_recovery_backup/);
  assert.doesNotMatch(source, /for table in SCHEMA:\s*conn\.execute\(f"DELETE FROM/);
}

testSourceContract();
testRecordWritesAndRecovery();
console.log("PASS record transaction regression: SQLite upserts records, rolls back failures, and restores the previous backup.");
