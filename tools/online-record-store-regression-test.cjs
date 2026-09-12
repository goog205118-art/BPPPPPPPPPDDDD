const assert = require("node:assert/strict");
const { createOnlineRecordStore } = require("./online-record-store.cjs");

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
    followUpAiSuggestions: Array.isArray(state?.followUpAiSuggestions) ? state.followUpAiSuggestions : [],
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
  const legacy = {
    meta: { version: 7, updatedAt: "2026-09-12T12:00:00.000Z" },
    brands: [
      { id: "BR-HSU", name: "HSU" },
      { id: "BR-ALT", name: "ALT" },
    ],
    creators: [creator("CR-A", "原始 A"), creator("CR-B", "原始 B", "ALT")],
  };
  let operations = [];
  const writes = [];
  let sequence = 0;
  const makeStore = () => createOnlineRecordStore({
    defaultState: legacy,
    normalizeState: normalize,
    readLegacy: async (fallback) => clone(fallback),
    listOperations: async () => clone(operations),
    appendOperation: async (operation) => {
      writes.push(operation);
      operations.push(clone(operation));
    },
    now: () => "2026-09-12T12:00:0" + sequence + ".000Z",
    createOperationId: () => `op-${++sequence}`,
  });

  const firstStore = makeStore();
  const secondStore = makeStore();
  const initial = await firstStore.load();
  assert.equal(initial.state.meta.version, 7);

  const firstUpdate = clone(initial.state);
  firstUpdate.creators = firstUpdate.creators.map((row) => row.id === "CR-A" ? { ...row, notes: "A 的新备注" } : row);
  const firstSaved = await firstStore.save(firstUpdate, 7);
  assert.equal(firstSaved.creators.find((row) => row.id === "CR-A").notes, "A 的新备注");
  assert.equal(writes.length, 1);

  // A stale browser changed a different record. It must merge instead of
  // replacing the first browser's record with its old snapshot.
  const secondUpdate = clone(initial.state);
  secondUpdate.creators = secondUpdate.creators.map((row) => row.id === "CR-B" ? { ...row, notes: "B 的新备注" } : row);
  const secondSaved = await secondStore.save(secondUpdate, 7);
  assert.equal(secondSaved.meta.version, 9);
  const merged = await firstStore.load();
  assert.equal(merged.state.creators.find((row) => row.id === "CR-A").notes, "A 的新备注");
  assert.equal(merged.state.creators.find((row) => row.id === "CR-B").notes, "B 的新备注");
  assert.equal(merged.state.creators.find((row) => row.id === "CR-B").brand, "ALT");

  const conflictingUpdate = clone(initial.state);
  conflictingUpdate.creators = conflictingUpdate.creators.map((row) => row.id === "CR-A" ? { ...row, notes: "A 的另一份备注" } : row);
  await assert.rejects(
    () => secondStore.save(conflictingUpdate, 7),
    (error) => error.code === "version_conflict"
      && error.statusCode === 409
      && error.conflicts.length === 1
      && /CR-A/.test(error.message),
  );
  assert.equal(operations.length, 2, "冲突保存不能追加操作日志。");

  const noOp = await firstStore.save(clone(merged.state), merged.state.meta.version);
  assert.equal(noOp.meta.version, 9);
  assert.equal(operations.length, 2, "无变化保存不能制造空操作。");
  assert.equal(writes.every((operation) => operation.id), true);

  const suggestionUpdate = clone(merged.state);
  suggestionUpdate.followUpAiSuggestions = [{
    id: "AISUG-1",
    brand_id: "BR-HSU",
    case_id: "CASE-1",
    status: "pending_review",
    analysis: { summary_cn: "待人工审核。" },
    context_scope: { email_count: 2 },
  }];
  const suggestionSaved = await firstStore.save(suggestionUpdate, merged.state.meta.version);
  assert.equal(suggestionSaved.followUpAiSuggestions[0].analysis.summary_cn, "待人工审核。");
  assert.equal(suggestionSaved.followUpAiSuggestions[0].context_scope.email_count, 2);
  console.log("PASS online record store regression: stale disjoint writes merge, same-record writes conflict, and legacy snapshot is never overwritten.");
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
