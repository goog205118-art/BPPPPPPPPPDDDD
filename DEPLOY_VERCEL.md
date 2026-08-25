# Vercel Online Deployment

This project can be deployed as a private online workbench. The online version does not use the local Python service, SQLite, VPN, local proxy, or local port.

## What Is Stored Online

- Business records are stored in Vercel Blob.
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
| `WORKBENCH_CREDENTIAL_ENCRYPTION_KEY` | A separate long random secret used to encrypt saved IMAP authorization codes | Required when enabling IMAP |
| `RESOURCE_WORKBENCH_CREATOR_AI_KEY` | Optional creator-profile API key fallback | No |
| `RESOURCE_WORKBENCH_LEAD_AI_KEY` | Optional lead-profile API key fallback | No |

5. Deploy. Open the Vercel domain and enter `WORKBENCH_ACCESS_PASSWORD`.
6. Use the top-right JSON import button to move a backup from the local version into the new online workbench.

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

## Automatic GitHub Deployment

The repository includes `.github/workflows/vercel.yml`. To enable it, add these GitHub repository secrets:

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel Account Settings > Tokens |
| `VERCEL_ORG_ID` | Project `.vercel/project.json`, created after linking the project |
| `VERCEL_PROJECT_ID` | Project `.vercel/project.json`, created after linking the project |

After the secrets are present, every push to `main` builds and publishes a production deployment.

## Important Limits

- The online version is designed for one owner or a small trusted team. The current whole-state save model is not intended for simultaneous editing by many people.
- XLSX imports should be kept below 3 MB per upload because Vercel serverless requests have size limits.
- Mailbox sync is manual in this version. Vercel Function connectivity to a mailbox server can be limited by the mailbox provider's firewall or allowlist rules; always test connection from the Settings page.
- Export JSON regularly. It is the quickest independent backup and migration format.
