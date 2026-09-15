const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const apiSource = fs.readFileSync(path.join(rootDir, "api", "[...route].mjs"), "utf8");
const storeSource = fs.readFileSync(path.join(rootDir, "tools", "postgres-record-store.cjs"), "utf8");
const neonStoreSource = fs.readFileSync(path.join(rootDir, "tools", "postgres-neon-store.cjs"), "utf8");

function sectionAfter(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `未找到代码段：${marker}`);
  const end = source.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `未找到代码段结束标记：${endMarker}`);
  return source.slice(start, end);
}

function run() {
  const persist = sectionAfter(appSource, "async function persist()", "function storageConflictEntity");
  const batchRoute = sectionAfter(
    apiSource,
    'if (req.method === "POST" && pathname === "/api/records/batch")',
    "const entityRoute = onlineEntityRoute(pathname);",
  );
  const compactCommit = sectionAfter(storeSource, "async function commitChanges(", "async function restoreEntity");

  for (const marker of [
    'const API_RECORDS_BATCH = "/api/records/batch"',
    "const COMPACT_POSTGRES_COLLECTIONS",
    "let persistBaseServerState = null",
    'response.headers.get("x-workbench-storage-driver")',
    "function buildCompactPersistPayload",
    "function canUseCompactPostgresPersist",
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `缺少前端紧凑保存契约：${marker}`);
  }
  assert.match(persist, /apiFetch\(API_RECORDS_BATCH,/);
  assert.match(persist, /changes: compact\.changes/);
  assert.match(persist, /body: JSON\.stringify\(\{\s*expectedVersion,/s);
  assert.match(persist, /buildPersistPayload\(stateSnapshot, expectedVersion\)/);

  assert.match(apiSource, /res\.setHeader\("x-workbench-storage-driver", onlineStorageDriver\(\)\)/);
  assert.match(batchRoute, /usesPostgresOnlineStorage\(\)/);
  assert.match(batchRoute, /getOnlineStateStore\(\)\.commitChanges\(changes, expectedVersion, audit\)/);
  assert.doesNotMatch(batchRoute, /await loadState\(\)/, "紧凑接口不得先完整读取工作区。");

  assert.match(storeSource, /const COMPACT_COLLECTIONS = \[/);
  assert.match(compactCommit, /gateway\.commitWorkspace\(/);
  const directCommitPath = compactCommit.slice(
    compactCommit.indexOf("const changes = compactChanges"),
    compactCommit.indexOf("if (!result?.committed)"),
  );
  assert.doesNotMatch(directCommitPath, /await load\(\)/, "正常紧凑提交不得先完整读取工作区。");
  assert.match(compactCommit, /if \(!result\?\.committed\) throw conflictError\(await load\(\)\)/);
  assert.match(neonStoreSource, /state_meta = COALESCE\(\$3::jsonb, resource_workbench_workspaces\.state_meta\)/);

  console.log("PASS postgres compact save regression: browser posts only changed safe records, the API directly commits with CAS, and Blob/full-state fallback remains available.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
