const { neon } = require("@neondatabase/serverless");

const SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS resource_workbench_workspaces (
      workspace_key TEXT PRIMARY KEY,
      version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
      state_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS resource_workbench_records (
      workspace_key TEXT NOT NULL,
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      brand_id TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_key, collection, id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS resource_workbench_records_lookup_idx
    ON resource_workbench_records (workspace_key, collection, updated_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS resource_workbench_records_brand_idx
    ON resource_workbench_records (workspace_key, brand_id, collection, updated_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS resource_workbench_record_history (
      workspace_key TEXT NOT NULL,
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      operation_version BIGINT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('upsert', 'remove')),
      data JSONB,
      audit JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_key, collection, id, operation_version)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS resource_workbench_record_history_restore_idx
    ON resource_workbench_record_history (workspace_key, collection, id, operation_version DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS resource_workbench_operations (
      workspace_key TEXT NOT NULL,
      version BIGINT NOT NULL,
      audit JSONB NOT NULL DEFAULT '{}'::jsonb,
      changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_key, version)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS resource_workbench_operations_recent_idx
    ON resource_workbench_operations (workspace_key, version DESC)
  `,
];

const COMMIT_WORKSPACE_SQL = `
  WITH updated_workspace AS (
    INSERT INTO resource_workbench_workspaces (
      workspace_key,
      version,
      state_meta,
      updated_at
    )
    SELECT
      $1,
      CASE WHEN $2 = 1 THEN 2 ELSE $2 + 1 END,
      $3::jsonb,
      $8::timestamptz
    ON CONFLICT (workspace_key) DO UPDATE
    SET
      version = resource_workbench_workspaces.version + 1,
      state_meta = EXCLUDED.state_meta,
      updated_at = EXCLUDED.updated_at
    WHERE resource_workbench_workspaces.version = $2
    RETURNING version, updated_at
  ),
  upserted AS (
    INSERT INTO resource_workbench_records (
      workspace_key,
      collection,
      id,
      brand_id,
      data,
      version,
      created_at,
      updated_at
    )
    SELECT
      $1,
      input.collection,
      input.id,
      input.brand_id,
      input.data,
      1,
      $8::timestamptz,
      $8::timestamptz
    FROM jsonb_to_recordset($4::jsonb) AS input(
      collection TEXT,
      id TEXT,
      brand_id TEXT,
      data JSONB
    )
    WHERE EXISTS (SELECT 1 FROM updated_workspace)
    ON CONFLICT (workspace_key, collection, id) DO UPDATE
    SET
      brand_id = EXCLUDED.brand_id,
      data = EXCLUDED.data,
      version = resource_workbench_records.version + 1,
      updated_at = EXCLUDED.updated_at
    RETURNING collection, id, brand_id, data
  ),
  removed AS (
    DELETE FROM resource_workbench_records AS record
    USING jsonb_to_recordset($5::jsonb) AS input(
      collection TEXT,
      id TEXT
    )
    WHERE record.workspace_key = $1
      AND record.collection = input.collection
      AND record.id = input.id
      AND EXISTS (SELECT 1 FROM updated_workspace)
    RETURNING record.collection, record.id, record.brand_id, record.data
  ),
  upsert_history AS (
    INSERT INTO resource_workbench_record_history (
      workspace_key,
      collection,
      id,
      operation_version,
      action,
      data,
      audit,
      occurred_at
    )
    SELECT
      $1,
      row.collection,
      row.id,
      updated_workspace.version,
      'upsert',
      row.data,
      $6::jsonb,
      $8::timestamptz
    FROM upserted AS row
    CROSS JOIN updated_workspace
    ON CONFLICT (workspace_key, collection, id, operation_version) DO NOTHING
  ),
  removal_history AS (
    INSERT INTO resource_workbench_record_history (
      workspace_key,
      collection,
      id,
      operation_version,
      action,
      data,
      audit,
      occurred_at
    )
    SELECT
      $1,
      row.collection,
      row.id,
      updated_workspace.version,
      'remove',
      row.data,
      $6::jsonb,
      $8::timestamptz
    FROM removed AS row
    CROSS JOIN updated_workspace
    ON CONFLICT (workspace_key, collection, id, operation_version) DO NOTHING
  ),
  operation_audit AS (
    INSERT INTO resource_workbench_operations (
      workspace_key,
      version,
      audit,
      changes,
      occurred_at
    )
    SELECT
      $1,
      version,
      $6::jsonb,
      $7::jsonb,
      $8::timestamptz
    FROM updated_workspace
    ON CONFLICT (workspace_key, version) DO NOTHING
  )
  SELECT version, updated_at FROM updated_workspace
`;

function text(value) {
  return String(value ?? "").trim();
}

function json(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function requiredDatabaseUrl(value) {
  const databaseUrl = text(value);
  if (!databaseUrl) {
    throw new Error("已启用 Postgres 主存储，但未设置 DATABASE_URL。请先在 Vercel/本地环境变量中配置 Neon PostgreSQL 连接字符串。");
  }
  return databaseUrl;
}

function createNeonWorkspaceGateway({
  databaseUrl = process.env.DATABASE_URL,
  query,
} = {}) {
  const execute = query || (() => {
    const sql = neon(requiredDatabaseUrl(databaseUrl));
    return (statement, params = []) => sql.query(statement, params);
  })();
  let schemaReady;

  async function ensureSchema() {
    if (!schemaReady) {
      schemaReady = (async () => {
        for (const statement of SCHEMA_STATEMENTS) {
          await execute(statement);
        }
      })();
    }
    return schemaReady;
  }

  async function loadWorkspace(workspaceKey) {
    await ensureSchema();
    const [workspaceRows, recordRows] = await Promise.all([
      execute(
        "SELECT version, state_meta, updated_at FROM resource_workbench_workspaces WHERE workspace_key = $1 LIMIT 1",
        [workspaceKey],
      ),
      execute(
        `
          SELECT collection, id, brand_id, data, version, created_at, updated_at
          FROM resource_workbench_records
          WHERE workspace_key = $1
          ORDER BY collection ASC, id ASC
        `,
        [workspaceKey],
      ),
    ]);
    const workspace = workspaceRows[0];
    return {
      version: Number(workspace?.version) || 1,
      meta: workspace?.state_meta && typeof workspace.state_meta === "object" ? workspace.state_meta : {},
      rows: recordRows || [],
    };
  }

  async function commitWorkspace({
    workspaceKey,
    expectedVersion,
    meta,
    upserts,
    removals,
    audit,
    changes,
    occurredAt,
  }) {
    await ensureSchema();
    const rows = await execute(COMMIT_WORKSPACE_SQL, [
      workspaceKey,
      Number(expectedVersion),
      json(meta || {}),
      json(upserts || []),
      json(removals || []),
      json(audit || {}),
      json(changes || {}),
      occurredAt,
    ]);
    const committed = rows[0];
    return committed
      ? {
          committed: true,
          version: Number(committed.version),
          updatedAt: committed.updated_at ? new Date(committed.updated_at).toISOString() : occurredAt,
        }
      : { committed: false };
  }

  async function loadEntityAtVersion(workspaceKey, collection, id, targetVersion) {
    await ensureSchema();
    const rows = await execute(
      `
        SELECT action, data, operation_version
        FROM resource_workbench_record_history
        WHERE workspace_key = $1
          AND collection = $2
          AND id = $3
          AND operation_version <= $4
        ORDER BY operation_version DESC
        LIMIT 1
      `,
      [workspaceKey, collection, id, Number(targetVersion)],
    );
    const historical = rows[0];
    if (!historical) return { found: false };
    return {
      found: true,
      action: historical.action,
      data: historical.data,
      version: Number(historical.operation_version),
    };
  }

  return {
    ensureSchema,
    loadWorkspace,
    commitWorkspace,
    loadEntityAtVersion,
  };
}

module.exports = {
  SCHEMA_STATEMENTS,
  COMMIT_WORKSPACE_SQL,
  createNeonWorkspaceGateway,
  requiredDatabaseUrl,
};
