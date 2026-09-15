const assert = require("node:assert/strict");
const { COLLECTIONS } = require("./online-record-store.cjs");
const {
  createPostgresRecordStore,
  mutationRows,
  stateDigest,
} = require("./postgres-record-store.cjs");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(raw = {}) {
  const state = clone(raw || {});
  state.meta = {
    ...(state.meta || {}),
    version: Math.max(1, Number(state.meta?.version) || 1),
  };
  for (const collection of COLLECTIONS) {
    state[collection] = Array.isArray(state[collection]) ? state[collection] : [];
  }
  return state;
}

function emptyState() {
  return normalize({ meta: { version: 1 } });
}

function createMemoryGateway() {
  const workspace = {
    version: 1,
    meta: {},
    rows: [],
    history: [],
    operations: [],
  };
  const commits = [];

  return {
    commits,
    async loadWorkspace() {
      return clone({
        version: workspace.version,
        meta: workspace.meta,
        rows: workspace.rows,
      });
    },
    async commitWorkspace(request) {
      commits.push(clone(request));
      if (Number(request.expectedVersion) !== workspace.version) return { committed: false };
      workspace.version += 1;
      workspace.meta = clone(request.meta || {});
      const rows = new Map(workspace.rows.map((row) => [`${row.collection}/${row.id}`, row]));
      for (const row of request.upserts || []) {
        rows.set(`${row.collection}/${row.id}`, clone(row));
        workspace.history.push({
          collection: row.collection,
          id: row.id,
          operation_version: workspace.version,
          action: "upsert",
          data: clone(row.data),
        });
      }
      for (const removed of request.removals || []) {
        const previous = rows.get(`${removed.collection}/${removed.id}`);
        if (!previous) continue;
        rows.delete(`${removed.collection}/${removed.id}`);
        workspace.history.push({
          collection: removed.collection,
          id: removed.id,
          operation_version: workspace.version,
          action: "remove",
          data: clone(previous.data),
        });
      }
      workspace.rows = [...rows.values()];
      workspace.operations.push({
        version: workspace.version,
        changes: clone(request.changes),
        audit: clone(request.audit),
      });
      return {
        committed: true,
        version: workspace.version,
        updatedAt: request.occurredAt,
      };
    },
    async loadEntityAtVersion(_workspaceKey, collection, id, targetVersion) {
      const row = [...workspace.history]
        .filter((item) => item.collection === collection && item.id === id && item.operation_version <= targetVersion)
        .sort((left, right) => right.operation_version - left.operation_version)[0];
      return row
        ? { found: true, action: row.action, data: clone(row.data), version: row.operation_version }
        : { found: false };
    },
  };
}

async function run() {
  const gateway = createMemoryGateway();
  const store = createPostgresRecordStore({
    defaultState: emptyState(),
    normalizeState: normalize,
    gateway,
    now: () => "2026-09-14T01:00:00.000Z",
  });
  const initial = await store.load();
  assert.equal(initial.meta.version, 1);

  const first = normalize({
    ...initial,
    creators: [{ id: "CR-1", brand_id: "BR-1", name: "Creator One", notes: "原始备注" }],
    products: [{ id: "PR-1", brand_id: "BR-1", name: "Product One" }],
  });
  const firstSaved = await store.save(first, 1, { actorName: "tester" });
  assert.equal(firstSaved.meta.version, 2);
  assert.equal(gateway.commits[0].upserts.length, 2);
  assert.equal(gateway.commits[0].removals.length, 0);

  const update = clone(firstSaved);
  update.creators[0].notes = "更新后的备注";
  const secondSaved = await store.save(update, 2);
  assert.equal(secondSaved.meta.version, 3);
  assert.deepEqual(
    gateway.commits[1].upserts.map((row) => `${row.collection}/${row.id}`),
    ["creators/CR-1"],
  );
  assert.equal(gateway.commits[1].removals.length, 0);

  const deleted = clone(secondSaved);
  deleted.creators = [];
  const thirdSaved = await store.save(deleted, 3);
  assert.equal(thirdSaved.meta.version, 4);
  assert.deepEqual(gateway.commits[2].removals, [{ collection: "creators", id: "CR-1" }]);

  await assert.rejects(
    () => store.save({ ...secondSaved, products: [] }, 2),
    (error) => error.code === "version_conflict" && error.statusCode === 409,
  );
  assert.equal(gateway.commits.length, 3, "陈旧版本不得产生实际提交。");

  const restored = await store.restoreEntity("creators", "CR-1", 3, 4, { actorName: "tester" });
  assert.equal(restored.meta.version, 5);
  assert.equal(restored.creators[0].notes, "更新后的备注");
  const removedAgain = await store.restoreEntity("creators", "CR-1", 4, 5);
  assert.equal(removedAgain.creators.length, 0);
  assert.equal(removedAgain.meta.version, 6);

  const extracted = mutationRows({
    creators: { upsert: [{ id: "CR-X", brand_id: "BR-X" }], removeIds: ["CR-Y"] },
  });
  assert.deepEqual(extracted.removals, [{ collection: "creators", id: "CR-Y" }]);
  assert.equal(extracted.upserts[0].brand_id, "BR-X");

  const migrationGateway = createMemoryGateway();
  const migrationStore = createPostgresRecordStore({
    defaultState: emptyState(),
    normalizeState: normalize,
    gateway: migrationGateway,
  });
  const imported = await migrationStore.importSnapshot(first);
  assert.equal(imported.sourceDigest, imported.destinationDigest);
  assert.equal(stateDigest(await migrationStore.load()), stateDigest(first));
  await assert.rejects(
    () => migrationStore.importSnapshot(first),
    (error) => error.code === "migration_target_not_empty",
  );

  console.log("PASS postgres record store regression: record mutations, CAS conflicts, entity history restore, and guarded JSON import work in isolation.");
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

