const { createHash } = require("node:crypto");
const { COLLECTIONS, buildPatch, applyPatch } = require("./online-record-store.cjs");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? "");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function stateDigest(state) {
  const stable = {
    meta: {
      ...clone(state?.meta || {}),
      version: undefined,
      updatedAt: undefined,
    },
  };
  delete stable.meta.version;
  delete stable.meta.updatedAt;
  for (const collection of COLLECTIONS) {
    stable[collection] = (Array.isArray(state?.[collection]) ? state[collection] : [])
      .map(clone)
      .sort((left, right) => text(left?.id).localeCompare(text(right?.id)));
  }
  return createHash("sha256").update(JSON.stringify(canonicalize(stable)), "utf8").digest("hex");
}

function rowBrandId(row) {
  return text(row?.brand_id).trim();
}

function mutationRows(changes) {
  const upserts = [];
  const removals = [];
  for (const collection of COLLECTIONS) {
    for (const row of changes?.[collection]?.upsert || []) {
      const id = text(row?.id).trim();
      if (!id) continue;
      upserts.push({
        collection,
        id,
        brand_id: rowBrandId(row),
        data: clone(row),
      });
    }
    for (const id of changes?.[collection]?.removeIds || []) {
      const normalizedId = text(id).trim();
      if (!normalizedId) continue;
      removals.push({ collection, id: normalizedId });
    }
  }
  return { upserts, removals };
}

function workspaceState(defaultState, normalizeState, snapshot = {}) {
  const next = clone(defaultState) || {};
  next.meta = {
    ...(next.meta || {}),
    ...(snapshot.meta && typeof snapshot.meta === "object" ? clone(snapshot.meta) : {}),
    version: Math.max(1, Number(snapshot.version || snapshot.meta?.version) || 1),
  };
  for (const collection of COLLECTIONS) {
    next[collection] = (Array.isArray(snapshot.rows) ? snapshot.rows : [])
      .filter((row) => text(row?.collection) === collection && row?.data && typeof row.data === "object")
      .map((row) => clone(row.data));
  }
  return normalizeState(next);
}

function conflictError(current) {
  const error = new Error("线上数据已被其他操作更新，请重新读取后再保存，避免覆盖最新修改。");
  error.code = "version_conflict";
  error.statusCode = 409;
  error.actualVersion = Number(current?.meta?.version) || 1;
  error.current = current;
  error.conflicts = [];
  return error;
}

function createPostgresRecordStore({
  defaultState,
  normalizeState,
  gateway,
  workspaceKey = "default",
  now = () => new Date().toISOString(),
}) {
  if (typeof normalizeState !== "function") throw new TypeError("postgres record store requires normalizeState");
  if (!gateway || typeof gateway.loadWorkspace !== "function" || typeof gateway.commitWorkspace !== "function") {
    throw new TypeError("postgres record store requires a workspace gateway");
  }

  async function load() {
    const snapshot = await gateway.loadWorkspace(workspaceKey);
    return workspaceState(defaultState, normalizeState, snapshot);
  }

  async function save(nextState, expectedVersion = nextState?.expectedVersion, audit = nextState?._saveAudit) {
    const current = await load();
    const requestedVersion = Number(expectedVersion);
    if (!Number.isInteger(requestedVersion)) {
      const error = new Error("线上保存缺少有效版本号，请重新读取后再保存。");
      error.code = "version_conflict";
      error.statusCode = 409;
      error.actualVersion = Number(current.meta?.version) || 1;
      error.current = current;
      error.conflicts = [];
      throw error;
    }
    if (requestedVersion !== Number(current.meta?.version)) throw conflictError(current);

    const normalizedNext = normalizeState({ ...(nextState || {}) });
    const changes = buildPatch(current, normalizedNext);
    if (!Object.keys(changes).length) return current;

    const mutation = mutationRows(changes);
    const meta = { ...(normalizedNext.meta || {}) };
    delete meta.version;
    delete meta.updatedAt;
    const result = await gateway.commitWorkspace({
      workspaceKey,
      expectedVersion: requestedVersion,
      meta,
      changes,
      ...mutation,
      audit: {
        actorId: text(audit?.actorId),
        actorName: text(audit?.actorName),
        source: text(audit?.source) || "web",
        reason: text(audit?.reason),
      },
      occurredAt: now(),
    });

    if (!result?.committed) throw conflictError(await load());

    const saved = applyPatch(current, changes, normalizeState);
    saved.meta = {
      ...(saved.meta || {}),
      version: Number(result.version),
      updatedAt: text(result.updatedAt) || now(),
    };
    return normalizeState(saved);
  }

  async function restoreEntity(table, id, targetVersion, expectedVersion, audit = {}) {
    const collection = text(table).trim();
    const recordId = text(id).trim();
    const requestedTarget = Number(targetVersion);
    if (!COLLECTIONS.includes(collection) || !recordId || !Number.isInteger(requestedTarget)) return null;

    const current = await load();
    if (Number(expectedVersion) !== Number(current.meta?.version)) throw conflictError(current);

    const historical = await gateway.loadEntityAtVersion(workspaceKey, collection, recordId, requestedTarget);
    if (!historical?.found) return null;
    const next = clone(current);
    const rows = new Map((Array.isArray(next[collection]) ? next[collection] : [])
      .map((row) => [text(row?.id), row]));
    if (historical.action === "remove") rows.delete(recordId);
    else rows.set(recordId, clone(historical.data));
    next[collection] = [...rows.values()];
    return save({
      ...next,
      _saveAudit: {
        ...audit,
        source: text(audit?.source) || "manual_restore",
        reason: text(audit?.reason) || `从版本 ${requestedTarget} 恢复 ${collection}/${recordId}`,
      },
    }, expectedVersion, audit);
  }

  async function importSnapshot(sourceState, { allowExisting = false, audit = {} } = {}) {
    const current = await load();
    const hasRecords = COLLECTIONS.some((collection) => (current[collection] || []).length);
    if (hasRecords && !allowExisting) {
      const error = new Error("目标 Postgres 工作区已有业务资料，拒绝覆盖导入。请先导出、核对后再使用明确的覆盖迁移。");
      error.code = "migration_target_not_empty";
      error.statusCode = 409;
      throw error;
    }
    const normalized = normalizeState(clone(sourceState) || {});
    const beforeDigest = stateDigest(normalized);
    const state = await save({
      ...normalized,
      meta: { ...(normalized.meta || {}), version: current.meta.version },
      _saveAudit: {
        ...audit,
        source: text(audit?.source) || "postgres_migration",
        reason: text(audit?.reason) || "从离线导出快照导入 Postgres",
      },
    }, current.meta.version, audit);
    return {
      state,
      sourceDigest: beforeDigest,
      destinationDigest: stateDigest(state),
    };
  }

  return {
    load,
    save,
    restoreEntity,
    importSnapshot,
    stateDigest,
  };
}

module.exports = {
  canonicalize,
  stateDigest,
  mutationRows,
  workspaceState,
  createPostgresRecordStore,
};
