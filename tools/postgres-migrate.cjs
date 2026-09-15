const fs = require("node:fs");
const path = require("node:path");
const { COLLECTIONS } = require("./online-record-store.cjs");
const { createPostgresRecordStore, stateDigest } = require("./postgres-record-store.cjs");
const { createNeonWorkspaceGateway } = require("./postgres-neon-store.cjs");

function text(value) {
  return String(value ?? "").trim();
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && text(value) !== "";
}

const MAIL_INBOX_LATEST_FIELDS = new Set([
  "status",
  "match_disposition",
  "triage_status",
  "triage_reason",
  "triage_resolved_at",
  "triage_resolved_by",
  "updatedAt",
  "body_cached_at",
  "body_retention_until",
  "body_truncated",
  "matched_contact_id",
  "matched_creator_id",
  "matched_creator_name",
  "case_id",
  "brand_id",
  "contact_id",
  "follow_up_id",
]);

function mergeMailInboxRows(rows) {
  const merged = new Map();
  let duplicateCount = 0;
  for (const original of Array.isArray(rows) ? rows : []) {
    const row = clone(original) || {};
    const id = text(row.id).trim();
    if (!id) {
      merged.set(`__missing__${merged.size}`, row);
      continue;
    }
    const previous = merged.get(id);
    if (!previous) {
      merged.set(id, row);
      continue;
    }
    duplicateCount += 1;
    for (const [key, value] of Object.entries(row)) {
      if (Array.isArray(value)) {
        const existing = Array.isArray(previous[key]) ? previous[key] : [];
        const seen = new Set(existing.map((item) => JSON.stringify(item)));
        for (const item of value) {
          const marker = JSON.stringify(item);
          if (!seen.has(marker)) {
            existing.push(clone(item));
            seen.add(marker);
          }
        }
        if (existing.length) previous[key] = existing;
      } else if (
        MAIL_INBOX_LATEST_FIELDS.has(key)
        ? hasValue(value)
        : !hasValue(previous[key]) && hasValue(value)
      ) {
        previous[key] = clone(value);
      }
    }
  }
  return {
    rows: [...merged.values()],
    duplicateCount,
  };
}

function emptyState() {
  const state = { meta: { version: 1 } };
  for (const collection of COLLECTIONS) state[collection] = [];
  return state;
}

function normalizeState(raw = {}) {
  const state = clone(raw && typeof raw === "object" ? raw : {});
  state.meta = state.meta && typeof state.meta === "object"
    ? { ...state.meta, version: Math.max(1, Number(state.meta.version) || 1) }
    : { version: 1 };
  for (const collection of COLLECTIONS) {
    state[collection] = Array.isArray(state[collection]) ? state[collection] : [];
  }
  return state;
}

function readSnapshot(filename) {
  const resolved = path.resolve(filename);
  if (!fs.existsSync(resolved)) throw new Error(`找不到 JSON 快照：${resolved}`);
  const state = normalizeState(JSON.parse(fs.readFileSync(resolved, "utf8")));
  const deduplicated = mergeMailInboxRows(state.mailInbox);
  state.mailInbox = deduplicated.rows;
  return {
    filename: resolved,
    state,
    mailInboxDuplicateCount: deduplicated.duplicateCount,
  };
}

function requirePath(value, command) {
  const filename = text(value);
  if (!filename) throw new Error(`${command} 需要提供 JSON 文件路径。`);
  return filename;
}

function printUsage() {
  console.log([
    "用法：",
    "  npm.cmd run db:postgres:migrate",
    "  npm.cmd run db:postgres:import -- path\\to\\export.json",
    "  npm.cmd run db:postgres:verify -- path\\to\\export.json",
    "  npm.cmd run db:postgres:export -- path\\to\\backup.json",
    "",
    "前提：设置 DATABASE_URL；可选 WORKBENCH_POSTGRES_WORKSPACE（默认 default）。",
    "此工具绝不读取 Vercel Blob。导入仅接受本地 JSON 导出，并且默认拒绝覆盖非空工作区。",
  ].join("\n"));
}

async function run() {
  const [command = "", filename] = process.argv.slice(2);
  if (!["migrate", "import", "verify", "export"].includes(command)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const workspaceKey = text(process.env.WORKBENCH_POSTGRES_WORKSPACE) || "default";
  const gateway = createNeonWorkspaceGateway({
    databaseUrl: process.env.DATABASE_URL,
  });
  const store = createPostgresRecordStore({
    defaultState: emptyState(),
    normalizeState,
    gateway,
    workspaceKey,
  });

  if (command === "migrate") {
    await gateway.ensureSchema();
    console.log(`Postgres Schema 已就绪：workspace=${workspaceKey}`);
    return;
  }

  if (command === "import") {
    const source = readSnapshot(requirePath(filename, "import"));
    const duplicateNote = source.mailInboxDuplicateCount
      ? `；已合并 mailInbox 重复 ID ${source.mailInboxDuplicateCount} 条`
      : "";
    const result = await store.importSnapshot(source.state, {
      audit: {
        source: "postgres_migration",
        actorName: "migration_cli",
        reason: `导入本地 JSON 快照：${path.basename(source.filename)}${duplicateNote}`,
      },
    });
    if (result.sourceDigest !== result.destinationDigest) {
      throw new Error("导入后数据摘要不一致，已停止后续步骤。请保留当前库并人工核对。");
    }
    const duplicateSummary = source.mailInboxDuplicateCount
      ? `，已合并 mailInbox 重复 ID ${source.mailInboxDuplicateCount} 条`
      : "";
    console.log(`导入完成且摘要一致：workspace=${workspaceKey} digest=${result.destinationDigest}${duplicateSummary}`);
    return;
  }

  if (command === "verify") {
    const source = readSnapshot(requirePath(filename, "verify"));
    const destination = await store.load();
    const sourceDigest = stateDigest(source.state);
    const destinationDigest = stateDigest(destination);
    if (sourceDigest !== destinationDigest) {
      throw new Error(`校验失败：源摘要 ${sourceDigest}，目标摘要 ${destinationDigest}`);
    }
    console.log(`校验通过：workspace=${workspaceKey} digest=${sourceDigest}`);
    return;
  }

  const output = path.resolve(requirePath(filename, "export"));
  if (fs.existsSync(output)) throw new Error(`拒绝覆盖已存在的备份文件：${output}`);
  const state = await store.load();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`已导出 Postgres 快照：${output} digest=${stateDigest(state)}`);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  mergeMailInboxRows,
  normalizeState,
  readSnapshot,
};
