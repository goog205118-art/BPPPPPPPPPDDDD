const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const apiPath = path.join(rootDir, "api", "[...route].mjs");
const apiSource = fs.readFileSync(apiPath, "utf8");

function sectionAfter(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `未找到代码段：${marker}`);
  const end = source.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `未找到代码段结束标记：${endMarker}`);
  return source.slice(start, end);
}

function run() {
  const listOperations = sectionAfter(
    apiSource,
    "listOperations: async () => {",
    "appendOperation:",
  );

  assert.match(
    apiSource,
    /const BLOB_OPERATION_READ_CONCURRENCY = Math\.min\(\s*16,\s*Math\.max\(1, Number\(process\.env\.WORKBENCH_BLOB_OPERATION_READ_CONCURRENCY \|\| 8\)\),\s*\);/s,
    "需要保留可配置且有上限的 Blob 操作日志读取并发数。",
  );
  assert.match(
    apiSource,
    /async function readBlobJsonFromBlob\(blob, fallback\)/,
    "需要能够直接读取 listAllBlobs 已返回的 Blob URL。",
  );
  assert.match(
    apiSource,
    /async function mapBlobReadsWithConcurrency\(items, limit, callback\)/,
    "需要保留独立的 Blob 读取并发工具，避免与 AI 批量并发工具冲突。",
  );
  assert.match(listOperations, /listAllBlobs\(STATE_OPERATION_PREFIX\)/);
  assert.match(listOperations, /mapBlobReadsWithConcurrency\(\s*blobs,\s*BLOB_OPERATION_READ_CONCURRENCY,/s);
  assert.match(listOperations, /readBlobJsonFromBlob\(blob, null\)/);
  assert.doesNotMatch(
    listOperations,
    /readBlobJson\(blob\.pathname, null\)/,
    "操作日志已被列举后，不应再按 pathname 重复触发 Blob 列表查询。",
  );

  console.log(
    "PASS online storage read regression: listed operation blobs are fetched directly with bounded concurrency and without per-record relisting.",
  );
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
