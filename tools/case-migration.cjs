const CASE_MIGRATION_VERSION = 1;

function text(value) {
  return String(value ?? "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function iso(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function findById(rows, id) {
  return asArray(rows).find((row) => text(row?.id) === text(id)) || null;
}

function migrationSnapshot(record = {}) {
  const snapshot = record?.snapshot && typeof record.snapshot === "object" ? record.snapshot : {};
  return {
    followUps: asArray(snapshot.followUps),
    cooperations: asArray(snapshot.cooperations),
    followUpEvents: asArray(snapshot.followUpEvents),
    contactTracks: asArray(snapshot.contactTracks),
  };
}

function recordSnapshot(snapshot, collection, row) {
  const entries = snapshot[collection] || (snapshot[collection] = []);
  if (entries.some((entry) => text(entry.id) === text(row?.id))) return;
  entries.push({ id: text(row?.id), case_id: text(row?.case_id) });
}

function hasLegacyCaseSubject(followUp) {
  return Boolean(text(followUp?.creator_id) || text(followUp?.lead_id));
}

function isAfter(left, right) {
  const leftTime = new Date(left || 0).getTime();
  const rightTime = new Date(right || 0).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime > rightTime;
}

function currentMigration(state) {
  const meta = state.meta && typeof state.meta === "object" ? state.meta : (state.meta = {});
  return meta.caseMigration && typeof meta.caseMigration === "object" ? meta.caseMigration : null;
}

function beginMigrationRecord(state, now) {
  const existing = currentMigration(state) || {};
  const snapshot = migrationSnapshot(existing);
  const record = {
    version: CASE_MIGRATION_VERSION,
    status: "completed",
    migratedAt: text(existing.migratedAt) || now,
    lastMigratedAt: text(existing.lastMigratedAt) || now,
    sourceFollowUpCount: 0,
    migratedFollowUpIds: unique(existing.migratedFollowUpIds),
    createdCaseIds: unique(existing.createdCaseIds),
    snapshot,
  };
  state.meta = {
    ...(state.meta || {}),
    caseMigration: record,
  };
  return record;
}

function migrateLegacyFollowUps(state, makeCase, now = new Date().toISOString(), options = {}) {
  const existing = currentMigration(state);
  if (text(existing?.status) === "rolled_back" && !options.resume) {
    return { migration: existing, createdCaseIds: [], skipped: true };
  }

  const timestamp = iso(now);
  const migration = beginMigrationRecord(state, timestamp);
  const cases = asArray(state.cases);
  const followUps = asArray(state.followUps);
  const cooperations = asArray(state.cooperations);
  const caseById = new Map(cases.map((row) => [text(row.id), row]));
  const createdCaseIds = [];
  let changed = !existing;

  for (const followUp of followUps) {
    if (!hasLegacyCaseSubject(followUp)) continue;

    let linkedCase = caseById.get(text(followUp.case_id));
    if (!linkedCase) {
      const generatedId = `CASE-FU-${text(followUp.id)}`;
      linkedCase = caseById.get(generatedId);
      if (!linkedCase) {
        linkedCase = makeCase(followUp, generatedId, timestamp);
        if (!linkedCase || !text(linkedCase.id)) {
          throw new Error("旧跟进迁移未能生成有效 Case。");
        }
        linkedCase.migration_source_follow_up_id = text(followUp.id);
        linkedCase.migration_version = CASE_MIGRATION_VERSION;
        linkedCase.migration_created_at = timestamp;
        cases.push(linkedCase);
        caseById.set(text(linkedCase.id), linkedCase);
        migration.createdCaseIds = unique([...migration.createdCaseIds, linkedCase.id]);
        createdCaseIds.push(linkedCase.id);
        changed = true;
      }
    }

    if (text(followUp.case_id) !== text(linkedCase.id)) {
      recordSnapshot(migration.snapshot, "followUps", followUp);
      followUp.case_id = linkedCase.id;
      changed = true;
    }
    const migratedIds = unique([...migration.migratedFollowUpIds, followUp.id]);
    if (migratedIds.length !== migration.migratedFollowUpIds.length) {
      migration.migratedFollowUpIds = migratedIds;
      changed = true;
    }
  }

  for (const cooperation of cooperations) {
    const linkedCase = caseById.get(text(cooperation.case_id))
      || cases.find((item) => text(item.cooperation_id) === text(cooperation.id));
    const nextCaseId = linkedCase ? text(linkedCase.id) : "";
    if (text(cooperation.case_id) !== nextCaseId) {
      recordSnapshot(migration.snapshot, "cooperations", cooperation);
      cooperation.case_id = nextCaseId;
      changed = true;
    }
  }

  migration.sourceFollowUpCount = followUps.length;
  if (changed) migration.lastMigratedAt = timestamp;
  state.cases = cases;
  state.followUps = followUps;
  state.cooperations = cooperations;
  return { migration, createdCaseIds, skipped: false };
}

function linkLegacyCaseReferences(state) {
  const migration = currentMigration(state);
  if (!migration || text(migration.status) === "rolled_back") return migration;

  migration.snapshot = migrationSnapshot(migration);
  const followUps = asArray(state.followUps);
  const followUpById = new Map(followUps.map((row) => [text(row.id), row]));

  for (const event of asArray(state.followUpEvents)) {
    const followUp = followUpById.get(text(event.follow_up_id));
    const nextCaseId = text(event.case_id || followUp?.case_id);
    if (text(event.case_id) !== nextCaseId) {
      recordSnapshot(migration.snapshot, "followUpEvents", event);
      event.case_id = nextCaseId;
    }
  }

  for (const track of asArray(state.contactTracks)) {
    const followUp = followUpById.get(text(track.follow_up_id));
    const nextCaseId = text(track.case_id || followUp?.case_id);
    if (text(track.case_id) !== nextCaseId) {
      recordSnapshot(migration.snapshot, "contactTracks", track);
      track.case_id = nextCaseId;
    }
  }

  return migration;
}

function restoreSnapshotCaseIds(rows, snapshots) {
  const byId = new Map(asArray(snapshots).map((entry) => [text(entry.id), text(entry.case_id)]));
  for (const row of asArray(rows)) {
    if (byId.has(text(row.id))) row.case_id = byId.get(text(row.id));
  }
}

function rollbackLegacyCaseMigration(state, now = new Date().toISOString(), options = {}) {
  const migration = currentMigration(state);
  if (!migration || !migration.version) {
    throw new Error("未找到可恢复的 Case 迁移记录。");
  }
  if (text(migration.status) === "rolled_back") {
    return { migration, removedCaseIds: [], alreadyRolledBack: true };
  }

  const createdCaseIds = unique(migration.createdCaseIds);
  const createdCases = asArray(state.cases).filter((row) => createdCaseIds.includes(text(row.id)));
  const changedCases = createdCases.filter((row) => isAfter(row.updatedAt, migration.lastMigratedAt || migration.migratedAt));
  if (changedCases.length && !options.force) {
    throw new Error("迁移后的 Case 已有人工作业，拒绝自动回滚以避免覆盖新资料。");
  }

  const snapshot = migrationSnapshot(migration);
  state.cases = asArray(state.cases).filter((row) => !createdCaseIds.includes(text(row.id)));
  restoreSnapshotCaseIds(state.followUps, snapshot.followUps);
  restoreSnapshotCaseIds(state.cooperations, snapshot.cooperations);
  restoreSnapshotCaseIds(state.followUpEvents, snapshot.followUpEvents);
  restoreSnapshotCaseIds(state.contactTracks, snapshot.contactTracks);

  state.meta = {
    ...(state.meta || {}),
    caseMigration: {
      ...migration,
      status: "rolled_back",
      rolledBackAt: iso(now),
      rollbackReason: text(options.reason) || "manual_recovery",
    },
  };
  return { migration: state.meta.caseMigration, removedCaseIds: createdCaseIds, alreadyRolledBack: false };
}

module.exports = {
  CASE_MIGRATION_VERSION,
  linkLegacyCaseReferences,
  migrateLegacyFollowUps,
  rollbackLegacyCaseMigration,
};
