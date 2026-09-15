const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(path.join(rootDir, "api", "[...route].mjs"), "utf8");
const deploySource = fs.readFileSync(path.join(rootDir, "DEPLOY_VERCEL.md"), "utf8");

// The rollback check is intentionally source-level: it must not contact the
// production Blob store or mutate the rehearsal Postgres workspace.
assert.match(
  apiSource,
  /function onlineStorageDriver\(\)[\s\S]*?const driver = textValue\(process\.env\.WORKBENCH_ONLINE_STORAGE_DRIVER \|\| "blob"\)/,
  "线上存储驱动必须默认回到 Blob。",
);
assert.match(
  apiSource,
  /function getOnlineStateStore\(\)[\s\S]*?if \(usesPostgresOnlineStorage\(\)\) \{[\s\S]*?createPostgresRecordStore/,
  "Postgres 主存储必须只在显式 postgres 驱动下初始化。",
);
assert.match(
  apiSource,
  /function getOnlineStateStore\(\)[\s\S]*?readLegacy: \(fallback\) => readBlobJson\(STATE_BLOB, fallback\)/,
  "Blob 驱动必须继续读取旧 state.json。",
);
assert.match(
  apiSource,
  /function getOnlineStateStore\(\)[\s\S]*?appendOperation: \(operation\) => writeBlobJson\(/,
  "Blob 驱动必须继续写入追加式操作日志。",
);
assert.doesNotMatch(
  apiSource,
  /if \(onlineStorageDriver\(\) === "blob"\)[\s\S]{0,500}DROP TABLE|DELETE FROM resource_workbench_/i,
  "切回 Blob 不得删除 Postgres 工作区。",
);
assert.match(
  deploySource,
  /WORKBENCH_ONLINE_STORAGE_DRIVER=blob/,
  "部署文档必须保留 Blob 回滚开关。",
);
assert.match(
  deploySource,
  /Blob 数据未动|Blob state untouched|old Blob state untouched/,
  "部署文档必须明确回滚不覆盖旧 Blob 数据。",
);

console.log(
  "PASS blob rollback regression: blob is the safe default, Postgres is lazy and opt-in, legacy state and operation logs remain available, and rollback performs no destructive database action.",
);
