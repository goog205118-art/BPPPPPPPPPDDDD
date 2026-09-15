# Vercel Online Deployment

This project can be deployed as a private online workbench. The online version does not use the local Python service, SQLite, VPN, local proxy, or local port.

## What Is Stored Online

- By default, business records are stored in Vercel Blob. After the Postgres migration window is completed, they can be stored in a managed Postgres database instead.
- Vercel Blob remains suitable for product/signature images, attachments, JSON exports, backups, and retained audit snapshots. It is not required to remain the primary business-record database.
- AI settings are stored in a separate private Vercel Blob file.
- IMAP mailbox settings are stored in a separate private Vercel Blob file. The saved authorization code is encrypted and never returns to the browser.
- API keys never return to the browser after saving.
- The application requires an access password before reading or changing data.

## First Deployment

1. Open the GitHub repository and confirm that the `main` branch contains this project.
2. In Vercel, choose **Add New > Project**, then import this GitHub repository.
3. Before clicking Deploy, open the project's **Storage** tab, create a **Blob** store, and connect it to this project. Vercel creates `BLOB_READ_WRITE_TOKEN` automatically.
4. In the project's **Settings > Environment Variables**, add:

| Name | Value | Required |
| --- | --- | --- |
| `WORKBENCH_ACCESS_PASSWORD` | A strong private password for this workbench | Yes |
| `BLOB_READ_WRITE_TOKEN` | Automatically added after connecting Vercel Blob | Yes |
| `WORKBENCH_ONLINE_STORAGE_DRIVER` | `blob` (default) or `postgres` | No |
| `DATABASE_URL` | Managed Postgres connection string; required only when driver is `postgres` | No |
| `WORKBENCH_POSTGRES_WORKSPACE` | Optional isolated workspace key; defaults to `default` | No |
| `WORKBENCH_CREDENTIAL_ENCRYPTION_KEY` | A separate long random secret used to encrypt saved IMAP authorization codes | Required when enabling IMAP |
| `CRON_SECRET` | Long random secret used only by `GET /api/cron/mail-sync` | Required only when enabling scheduled IMAP sync |
| `RESOURCE_WORKBENCH_CREATOR_AI_KEY` | Optional creator-profile API key fallback | No |
| `RESOURCE_WORKBENCH_LEAD_AI_KEY` | Optional lead-profile API key fallback | No |

5. Deploy. Open the Vercel domain and enter `WORKBENCH_ACCESS_PASSWORD`.
6. Use the top-right JSON import button to move a backup from the local version into the new online workbench.

## Optional Postgres Primary Storage

Keep `WORKBENCH_ONLINE_STORAGE_DRIVER=blob` for the initial deployment. The Postgres path is deliberately opt-in: a missing or invalid `DATABASE_URL` fails clearly instead of silently writing back to Blob.

Use a dedicated test database or a disposable database branch for the first rehearsal. Do not point the commands below at production until the source JSON, import result, and exported backup have all been checked.

1. Export a JSON backup from the workbench UI. The migration utility only accepts this local JSON file; it never reads a production Blob store on its own.
2. Configure `DATABASE_URL` locally for the test database. Optionally set `WORKBENCH_POSTGRES_WORKSPACE=test-migration`.
3. Initialize the schema:

   ```powershell
   npm.cmd run db:postgres:migrate
   ```

4. Import and verify the exported JSON:

   ```powershell
   npm.cmd run db:postgres:import -- path\to\resource-workbench-export.json
   npm.cmd run db:postgres:verify -- path\to\resource-workbench-export.json
   npm.cmd run db:postgres:export -- path\to\postgres-rehearsal-backup.json
   ```

   The import refuses to overwrite a non-empty Postgres workspace. The verify command compares a stable data digest and ignores only volatile state version and update timestamps.

5. Set the same `DATABASE_URL` in Vercel's environment variables, set `WORKBENCH_ONLINE_STORAGE_DRIVER=postgres`, and optionally set a production workspace key. Redeploy, then perform one controlled read/write smoke test with non-production data.
6. Keep the Blob export and the old Blob state untouched during the migration window. To roll back the application, set `WORKBENCH_ONLINE_STORAGE_DRIVER=blob` and redeploy. No database deletion is required for rollback.

The initial Postgres schema uses indexed JSONB entity rows for compatibility with the current workbench fields. Each save uses one optimistic-version guarded SQL statement to atomically update the workspace version, changed records, record history, and operation audit. The server also exposes guarded record `PATCH` / `DELETE` endpoints in Postgres mode; the existing browser remains on the compatible state-save path until a separate UI migration is approved. Strongly typed reporting tables can be added later without forcing a field-by-field migration now.

## AI Settings

The Settings page supports two independent profiles:

- Creator completion: complete creator records.
- Lead quick entry: faster low-cost AI for discovered creators.

Each profile supports Gemini or OpenAI-compatible protocol, API address, model name, and API key. In the online version requests are sent from Vercel, so local VPN and `127.0.0.1` proxy settings are intentionally hidden.

For higher protection, select **environment** as the key source and add the matching `RESOURCE_WORKBENCH_CREATOR_AI_KEY` or `RESOURCE_WORKBENCH_LEAD_AI_KEY` in Vercel environment variables.

## Official Mailbox IMAP Sync

The Settings page includes **Official Mailbox IMAP Sync**. Configure the mailbox account, IMAP server, port, SSL/TLS, inbox folder, sent folder, sync range, and the mailbox-specific authorization code. Use **Test Connection** before the first manual sync.

- The sync is read-only: it does not send, delete, flag, or mark messages as read.
- It stores only message metadata and a short body excerpt. Attachments, raw `.eml` files, and complete bodies are not stored.
- It only automatically archives a message when one creator email and one active follow-up record match exactly. Other messages appear in the manual archive queue.
- `WORKBENCH_CREDENTIAL_ENCRYPTION_KEY` should remain stable. Replacing it after saving an authorization code makes the old encrypted code unreadable, and you will need to enter it again.
- Foxmail remains a client. The online version does not and cannot read Foxmail's local database; it connects directly to the configured IMAP server.

### Controlled Scheduled Sync

Scheduled IMAP sync is disabled by default in two places: the mailbox strategy in the Settings page is off, and this repository intentionally does not add a default cron entry to `vercel.json`. This avoids starting external mailbox polling merely because the project was deployed.

To enable it after the manual mailbox workflow is accepted:

1. Save `CRON_SECRET` in the Vercel environment.
2. In Settings, enable **Controlled Scheduled Sync**, select the mailbox accounts, and set the interval, folder message limit and retry policy.
3. Add a Vercel Cron schedule appropriate for the deployment to call `GET /api/cron/mail-sync`. The request must include `Authorization: Bearer <CRON_SECRET>`.
4. Verify the sanitized run history after the first scheduled run, then keep the manual **Sync Mailbox** action available as the recovery path.

The scheduler reads only the configured recent IMAP folders and uses the same deduplication, routing, data-version retry and manual-triage behavior as a manual sync. It never sends email, never advances a cooperation stage, never downloads attachments/HTML/MIME, and never invokes AI. A global run lock plus per-account lease prevents overlapping cron/manual runs from overwriting the shared mailbox settings or importing the same work twice.

## Automatic GitHub Deployment

The repository includes `.github/workflows/vercel.yml`. To enable it, add these GitHub repository secrets:

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel Account Settings > Tokens |
| `VERCEL_ORG_ID` | Project `.vercel/project.json`, created after linking the project |
| `VERCEL_PROJECT_ID` | Project `.vercel/project.json`, created after linking the project |

After the secrets are present, every push to `main` builds and publishes a production deployment.

## Important Limits

- Blob mode is designed for one owner or a small trusted team. Postgres mode records only changed entities and has optimistic version control, record history, and audit rows, but the current compatibility endpoint still submits a complete client snapshot. It remains important to resolve a displayed conflict before continuing edits. Direct entity `PATCH` endpoints are a later performance step.
- XLSX imports should be kept below 3 MB per upload because Vercel serverless requests have size limits.
- Mailbox sync is manual by default. Controlled scheduled sync requires the explicit `CRON_SECRET`, a deployer-added Cron schedule and a saved opt-in strategy; Vercel Function connectivity to a mailbox server can be limited by the mailbox provider's firewall or allowlist rules, so always test connection from the Settings page first.
- Export JSON regularly. It is the quickest independent backup and migration format.
