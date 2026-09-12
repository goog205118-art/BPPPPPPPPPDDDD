const COLLECTIONS = [
  "brands",
  "creators",
  "resources",
  "leads",
  "products",
  "cooperations",
  "matches",
  "followUps",
  "cases",
  "actionTasks",
  "actionTaskEvents",
  "followUpEvents",
  "contacts",
  "contactTracks",
  "mailInbox",
  "importHistory",
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? "");
}

function canonical(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function withoutVersionMeta(meta = {}) {
  const result = { ...meta };
  delete result.version;
  delete result.updatedAt;
  return result;
}

function indexedRows(state, table) {
  const rows = Array.isArray(state?.[table]) ? state[table] : [];
  return new Map(rows.map((row) => [text(row?.id), row]).filter(([id]) => id));
}

function buildTablePatch(baseState, nextState, table) {
  const base = indexedRows(baseState, table);
  const next = indexedRows(nextState, table);
  const upsert = [];
  const removeIds = [];

  for (const [id, row] of next) {
    if (!base.has(id) || canonical(base.get(id)) !== canonical(row)) upsert.push(clone(row));
  }
  for (const id of base.keys()) {
    if (!next.has(id)) removeIds.push(id);
  }
  if (!upsert.length && !removeIds.length) return null;
  return { upsert, removeIds };
}

function buildPatch(baseState, nextState) {
  const changes = {};
  if (canonical(withoutVersionMeta(baseState?.meta)) !== canonical(withoutVersionMeta(nextState?.meta))) {
    changes.meta = withoutVersionMeta(nextState?.meta);
  }
  for (const table of COLLECTIONS) {
    const patch = buildTablePatch(baseState, nextState, table);
    if (patch) changes[table] = patch;
  }
  return changes;
}

function applyTablePatch(state, table, patch) {
  const rows = indexedRows(state, table);
  for (const id of patch?.removeIds || []) rows.delete(text(id));
  for (const row of patch?.upsert || []) {
    if (row && text(row.id)) rows.set(text(row.id), clone(row));
  }
  state[table] = [...rows.values()];
}

function applyPatch(baseState, changes, normalizeState) {
  const state = clone(baseState) || {};
  if (changes && Object.prototype.hasOwnProperty.call(changes, "meta")) {
    state.meta = { ...(state.meta || {}), ...clone(changes.meta) };
  }
  for (const table of COLLECTIONS) {
    if (changes && changes[table]) applyTablePatch(state, table, changes[table]);
  }
  return normalizeState(state);
}

function patchValue(patch, key) {
  if (key === "meta") {
    return Object.prototype.hasOwnProperty.call(patch || {}, "meta") ? patch.meta : undefined;
  }
  const tablePatch = patch?.[key.table];
  if (!tablePatch) return undefined;
  const row = (tablePatch.upsert || []).find((item) => text(item?.id) === key.id);
  if (row) return row;
  if ((tablePatch.removeIds || []).map(text).includes(key.id)) return null;
  return undefined;
}

function patchKeys(patch) {
  const keys = [];
  if (Object.prototype.hasOwnProperty.call(patch || {}, "meta")) keys.push({ type: "meta" });
  for (const table of COLLECTIONS) {
    for (const row of patch?.[table]?.upsert || []) {
      if (text(row?.id)) keys.push({ type: "row", table, id: text(row.id) });
    }
    for (const id of patch?.[table]?.removeIds || []) {
      if (text(id)) keys.push({ type: "row", table, id: text(id) });
    }
  }
  return keys;
}

function conflictForPatches(requestedPatch, laterPatch) {
  const laterKeys = patchKeys(laterPatch);
  for (const key of patchKeys(requestedPatch)) {
    const sameKey = laterKeys.find((candidate) => (
      candidate.type === key.type
      && candidate.table === key.table
      && candidate.id === key.id
    ));
    if (!sameKey) continue;
    if (canonical(patchValue(requestedPatch, key)) !== canonical(patchValue(laterPatch, sameKey))) {
      return key.type === "meta"
        ? "元数据设置"
        : `${key.table}/${key.id}`;
    }
  }
  return "";
}

function detectOperationConflicts(operations, baseVersion) {
  const conflicts = [];
  operations.forEach((operation, index) => {
    const startIndex = Math.max(0, operation.baseVersion - baseVersion);
    for (const previous of operations.slice(startIndex, index)) {
      const conflict = conflictForPatches(operation.changes, previous.changes);
      if (!conflict) continue;
      conflicts.push({
        operationId: operation.id,
        competingOperationId: previous.id,
        key: conflict,
        baseVersion: operation.baseVersion,
      });
    }
  });
  return conflicts;
}

function normalizeOperations(rawOperations) {
  return (Array.isArray(rawOperations) ? rawOperations : [])
    .filter((operation) => operation && typeof operation === "object" && operation.changes)
    .map((operation) => ({
      id: text(operation.id),
      baseVersion: Number(operation.baseVersion),
      createdAt: text(operation.createdAt),
      audit: operation.audit && typeof operation.audit === "object"
        ? {
            actorId: text(operation.audit.actorId),
            actorName: text(operation.audit.actorName),
            source: text(operation.audit.source),
            reason: text(operation.audit.reason),
          }
        : {},
      changes: operation.changes,
    }))
    .filter((operation) => operation.id && Number.isInteger(operation.baseVersion))
    .sort((a, b) => (
      a.createdAt.localeCompare(b.createdAt)
      || a.id.localeCompare(b.id)
    ));
}

function stateAtVersion(bundle, version, normalizeState) {
  const requested = Number(version);
  if (!Number.isInteger(requested)) return null;
  if (requested < bundle.baseVersion || requested > bundle.state.meta.version) return null;
  let state = clone(bundle.baseState);
  const count = requested - bundle.baseVersion;
  for (const operation of bundle.operations.slice(0, count)) {
    state = applyPatch(state, operation.changes, normalizeState);
  }
  state.meta = { ...(state.meta || {}), version: requested };
  return normalizeState(state);
}

function conflictError(message, current, conflicts = []) {
  const error = new Error(message);
  error.code = "version_conflict";
  error.statusCode = 409;
  error.actualVersion = Number(current?.meta?.version) || 1;
  error.current = current;
  error.conflicts = clone(conflicts);
  return error;
}

function auditSummary(operation) {
  return {
    operationId: text(operation?.id),
    createdAt: text(operation?.createdAt),
    actorId: text(operation?.audit?.actorId),
    actorName: text(operation?.audit?.actorName),
    source: text(operation?.audit?.source),
    reason: text(operation?.audit?.reason),
  };
}

function restoreEntityAtVersion(bundle, table, id, targetVersion, normalizeState) {
  const key = text(id);
  if (!COLLECTIONS.includes(table) || !key) return null;
  const historicalState = stateAtVersion(bundle, targetVersion, normalizeState);
  if (!historicalState) return null;
  const rows = indexedRows(bundle.state, table);
  const historicalRow = indexedRows(historicalState, table).get(key);
  if (historicalRow) rows.set(key, clone(historicalRow));
  else rows.delete(key);
  const restored = clone(bundle.state);
  restored[table] = [...rows.values()];
  return normalizeState(restored);
}

function createOnlineRecordStore({
  defaultState,
  normalizeState,
  readLegacy,
  listOperations,
  appendOperation,
  now = () => new Date().toISOString(),
  createOperationId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
}) {
  if (typeof normalizeState !== "function") throw new TypeError("online record store requires normalizeState");

  async function load() {
    const legacy = normalizeState(await readLegacy(defaultState));
    const baseVersion = Math.max(1, Number(legacy?.meta?.version) || 1);
    const operations = normalizeOperations(await listOperations());
    let state = clone(legacy);
    for (const operation of operations) state = applyPatch(state, operation.changes, normalizeState);
    const conflicts = detectOperationConflicts(operations, baseVersion);
    state.meta = {
      ...(state.meta || {}),
      version: baseVersion + operations.length,
    };
    if (conflicts.length) state._storageConflicts = conflicts;
    else delete state._storageConflicts;
    return {
      state: normalizeState(state),
      baseState: normalizeState(legacy),
      baseVersion,
      operations,
      conflicts,
    };
  }

  async function save(nextState, expectedVersion = nextState?.expectedVersion, audit = nextState?._saveAudit) {
    const bundle = await load();
    const requestedVersion = Number(expectedVersion);
    const actualVersion = Number(bundle.state?.meta?.version) || 1;
    if (!Number.isInteger(requestedVersion)) {
      throw conflictError("线上保存缺少有效版本号，请重新读取后再保存。", bundle.state);
    }
    if (bundle.conflicts.length) {
      throw conflictError(
        `线上存在尚未处理的记录冲突（${bundle.conflicts[0].key}）。请先重新读取并人工处理。`,
        bundle.state,
        bundle.conflicts,
      );
    }
    if (requestedVersion > actualVersion) {
      throw conflictError(`线上版本号无效（请求 ${requestedVersion}，当前 ${actualVersion}）。`, bundle.state);
    }

    const baseState = stateAtVersion(bundle, requestedVersion, normalizeState);
    if (!baseState) {
      throw conflictError(`线上历史版本 ${requestedVersion} 不可用，请重新读取后再保存。`, bundle.state);
    }
    const normalizedNext = normalizeState({ ...(nextState || {}) });
    const changes = buildPatch(baseState, normalizedNext);
    if (!Object.keys(changes).length) return bundle.state;

    const laterOperations = bundle.operations.slice(requestedVersion - bundle.baseVersion);
    for (const operation of laterOperations) {
      const conflict = conflictForPatches(changes, operation.changes);
      if (conflict) {
        const conflicts = [{
          operationId: "pending-save",
          competingOperationId: operation.id,
          key: conflict,
          baseVersion: operation.baseVersion,
          competing: auditSummary(operation),
        }];
        throw conflictError(
          `线上数据已被其他操作更新（冲突记录：${conflict}）。请重新读取后再保存，避免覆盖最新修改。`,
          bundle.state,
          conflicts,
        );
      }
    }

    const operation = {
      id: createOperationId(),
      baseVersion: requestedVersion,
      createdAt: now(),
      audit: {
        actorId: text(audit?.actorId),
        actorName: text(audit?.actorName),
        source: text(audit?.source) || "web",
        reason: text(audit?.reason),
      },
      changes,
    };
    await appendOperation(operation);

    const committed = await load();
    if (committed.conflicts.length) {
      throw conflictError(
        `线上并发保存产生记录冲突（${committed.conflicts[0].key}）。请重新读取并人工处理。`,
        committed.state,
        committed.conflicts,
      );
    }
    if (committed.operations.some((item) => item.id === operation.id)) return committed.state;

    // Blob list visibility can lag immediately after a unique append. Preserve
    // the caller's successful change in its response; the next read folds it.
    const localState = applyPatch(bundle.state, changes, normalizeState);
    localState.meta = {
      ...(localState.meta || {}),
      version: actualVersion + 1,
      updatedAt: now(),
    };
    return normalizeState(localState);
  }

  return { load, save, buildPatch, applyPatch, restoreEntityAtVersion };
}

module.exports = {
  COLLECTIONS,
  createOnlineRecordStore,
  buildPatch,
  applyPatch,
  conflictForPatches,
  detectOperationConflicts,
  restoreEntityAtVersion,
};
