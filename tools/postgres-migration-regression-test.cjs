const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { SCHEMA_STATEMENTS, COMMIT_WORKSPACE_SQL, requiredDatabaseUrl } = require("./postgres-neon-store.cjs");
const { mergeMailInboxRows } = require("./postgres-migrate.cjs");

function run() {
  assert.equal(SCHEMA_STATEMENTS.some((sql) => /resource_workbench_workspaces/.test(sql)), true);
  assert.equal(SCHEMA_STATEMENTS.some((sql) => /resource_workbench_records/.test(sql)), true);
  assert.equal(SCHEMA_STATEMENTS.some((sql) => /resource_workbench_record_history/.test(sql)), true);
  assert.equal(SCHEMA_STATEMENTS.some((sql) => /resource_workbench_operations/.test(sql)), true);
  assert.match(COMMIT_WORKSPACE_SQL, /CASE WHEN \$2 = 1 THEN 2 ELSE \$2 \+ 1 END/);
  assert.doesNotMatch(COMMIT_WORKSPACE_SQL, /SELECT \$1, 2, \$3::jsonb, \$8::timestamptz\s+WHERE \$2 = 1/);
  assert.match(COMMIT_WORKSPACE_SQL, /WHERE resource_workbench_workspaces\.version = \$2/);
  assert.match(COMMIT_WORKSPACE_SQL, /upsert_history/);
  assert.match(COMMIT_WORKSPACE_SQL, /removal_history/);
  assert.match(COMMIT_WORKSPACE_SQL, /operation_audit/);
  assert.throws(() => requiredDatabaseUrl(""), /DATABASE_URL/);
  assert.equal(requiredDatabaseUrl("postgresql://example"), "postgresql://example");

  const duplicateMailRows = mergeMailInboxRows([
    {
      id: "mail-1",
      brand_id: "brand-hsu",
      status: "unmatched",
      matched_creator_name: "",
      candidate_creator_ids: ["creator-1"],
      subject: "合作咨询",
    },
    {
      id: "mail-1",
      brand_id: "",
      status: "needs_followup",
      matched_creator_name: "Creator One",
      candidate_creator_ids: ["creator-1", "creator-2"],
      subject: "",
    },
  ]);
  assert.equal(duplicateMailRows.duplicateCount, 1);
  assert.equal(duplicateMailRows.rows.length, 1);
  assert.equal(duplicateMailRows.rows[0].brand_id, "brand-hsu");
  assert.equal(duplicateMailRows.rows[0].status, "needs_followup");
  assert.equal(duplicateMailRows.rows[0].matched_creator_name, "Creator One");
  assert.deepEqual(duplicateMailRows.rows[0].candidate_creator_ids, ["creator-1", "creator-2"]);
  assert.equal(duplicateMailRows.rows[0].subject, "合作咨询");

  const apiSource = fs.readFileSync(path.join(__dirname, "..", "api", "[...route].mjs"), "utf8");
  assert.match(apiSource, /WORKBENCH_ONLINE_STORAGE_DRIVER/);
  assert.match(apiSource, /WORKBENCH_POSTGRES_WORKSPACE/);
  assert.match(apiSource, /createPostgresRecordStore/);
  assert.match(apiSource, /usesPostgresOnlineStorage\(\)/);
  assert.match(apiSource, /store\.restoreEntity/);
  assert.match(apiSource, /onlineEntityRoute/);
  assert.match(apiSource, /api\\\/records/);
  assert.match(apiSource, /req\.method === "PATCH"/);
  assert.match(apiSource, /req\.method === "DELETE"/);
  assert.match(apiSource, /postgres_storage_required/);

  console.log("PASS postgres migration contract: explicit driver switch, guarded record PATCH/DELETE, bootstrap CAS, history/audit schema, and missing DATABASE_URL protection are present.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
