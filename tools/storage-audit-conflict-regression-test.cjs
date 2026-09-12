const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createOnlineRecordStore, restoreEntityAtVersion } = require("./online-record-store.cjs");

const rootDir = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(path.join(rootDir, "api", "[...route].mjs"), "utf8");
const localServerSource = fs.readFileSync(path.join(rootDir, "tools", "local-server.cjs"), "utf8");
const browserSource = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(rootDir, "app", "styles.css"), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(state) {
  return {
    meta: { version: 1, ...(state?.meta || {}) },
    brands: Array.isArray(state?.brands) ? state.brands : [],
    creators: Array.isArray(state?.creators) ? state.creators : [],
    resources: Array.isArray(state?.resources) ? state.resources : [],
    leads: Array.isArray(state?.leads) ? state.leads : [],
    products: Array.isArray(state?.products) ? state.products : [],
    cooperations: Array.isArray(state?.cooperations) ? state.cooperations : [],
    matches: Array.isArray(state?.matches) ? state.matches : [],
    followUps: Array.isArray(state?.followUps) ? state.followUps : [],
    cases: Array.isArray(state?.cases) ? state.cases : [],
    actionTasks: Array.isArray(state?.actionTasks) ? state.actionTasks : [],
    actionTaskEvents: Array.isArray(state?.actionTaskEvents) ? state.actionTaskEvents : [],
    followUpEvents: Array.isArray(state?.followUpEvents) ? state.followUpEvents : [],
    contactTracks: Array.isArray(state?.contactTracks) ? state.contactTracks : [],
    mailInbox: Array.isArray(state?.mailInbox) ? state.mailInbox : [],
    importHistory: Array.isArray(state?.importHistory) ? state.importHistory : [],
  };
}

function creator(id, notes, brand = "HSU") {
  return { id, brand_id: `BR-${brand}`, brand, name: id, notes };
}

async function run() {
  const legacy = normalize({
    meta: { version: 4, updatedAt: "2026-09-12T12:00:00.000Z" },
    brands: [
      { id: "BR-HSU", name: "HSU" },
      { id: "BR-ALT", name: "ALT" },
    ],
    creators: [
      creator("CR-A", "初始 A"),
      creator("CR-B", "初始 B", "ALT"),
    ],
  });
  let operations = [];
  const writes = [];
  let sequence = 0;
  const makeStore = () => createOnlineRecordStore({
    defaultState: legacy,
    normalizeState: normalize,
    readLegacy: async (fallback) => clone(fallback),
    listOperations: async () => clone(operations),
    appendOperation: async (operation) => {
      writes.push(clone(operation));
      operations.push(clone(operation));
    },
    now: () => `2026-09-12T12:00:0${sequence}.000Z`,
    createOperationId: () => `audit-op-${++sequence}`,
  });

  const store = makeStore();
  const initial = await store.load();
  const updateA = clone(initial.state);
  updateA.creators = updateA.creators.map((row) => (
    row.id === "CR-A" ? { ...row, notes: "更新 A", version: 2 } : row
  ));
  updateA._saveAudit = {
    actorId: "user-a",
    actorName: "用户 A",
    source: "web:creators",
    reason: "修改达人备注",
  };
  await store.save(updateA, initial.state.meta.version);

  assert.equal(writes[0].audit.actorName, "用户 A");
  assert.equal(writes[0].audit.source, "web:creators");
  assert.equal(writes[0].audit.reason, "修改达人备注");
  assert.equal(Object.prototype.hasOwnProperty.call(writes[0].changes, "_saveAudit"), false);

  const baseVersion = (await store.load()).state.meta.version;
  const updateB = clone((await store.load()).state);
  updateB.creators = updateB.creators.map((row) => (
    row.id === "CR-B" ? { ...row, notes: "更新 B" } : row
  ));
  await store.save(updateB, baseVersion, {
    actorName: "用户 B",
    source: "web:creators",
    reason: "修改另一位达人",
  });

  const stale = clone(initial.state);
  stale.creators = stale.creators.map((row) => (
    row.id === "CR-A" ? { ...row, notes: "冲突 A" } : row
  ));
  await assert.rejects(
    () => store.save(stale, initial.state.meta.version),
    (error) => error.code === "version_conflict"
      && error.statusCode === 409
      && error.conflicts[0].competing.actorName === "用户 A"
      && error.conflicts[0].competing.source === "web:creators"
      && error.conflicts[0].competing.reason === "修改达人备注",
  );
  assert.equal(writes.length, 2, "冲突保存不得追加操作日志。");

  const current = await store.load();
  const deleteA = clone(current.state);
  deleteA.creators = deleteA.creators.filter((row) => row.id !== "CR-A");
  await store.save(deleteA, current.state.meta.version, {
    actorName: "用户 C",
    source: "web:creators",
    reason: "清理重复达人",
  });

  const afterDelete = await store.load();
  assert.equal(afterDelete.state.creators.some((row) => row.id === "CR-A"), false);
  const restored = restoreEntityAtVersion(
    afterDelete,
    "creators",
    "CR-A",
    5,
    normalize,
  );
  assert.equal(restored.creators.find((row) => row.id === "CR-A").notes, "更新 A");
  assert.equal(restoreEntityAtVersion(afterDelete, "meta", "version", 5, normalize), null);
  assert.equal(restoreEntityAtVersion(afterDelete, "creators", "CR-A", 999, normalize), null);

  assert.match(apiSource, /restoreEntityAtVersion/);
  assert.match(apiSource, /\/api\/state\/restore-entity/);
  assert.match(apiSource, /invalid_restore_request/);
  assert.match(localServerSource, /storage-audit\.jsonl/);
  assert.match(localServerSource, /localConflictItems/);
  assert.match(browserSource, /storageConflictModal/);
  assert.match(browserSource, /error\.conflicts = Array\.isArray/);
  assert.match(htmlSource, /按记录合并并保存/);
  assert.match(htmlSource, /storageConflictReloadBtn/);
  assert.match(stylesSource, /\.storage-conflict-dialog/);
  assert.match(stylesSource, /\.storage-conflict-item/);
  console.log("PASS storage audit/conflict regression: audit metadata, disjoint merge, same-record conflict, entity restore, and UI/API contracts.");
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
