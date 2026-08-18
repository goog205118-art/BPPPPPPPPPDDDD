# Vercel Online Deployment

This project can be deployed as a private online workbench. The online version does not use the local Python service, SQLite, VPN, local proxy, or local port.

## What Is Stored Online

- Business records are stored in Vercel Blob.
- AI settings are stored in a separate private Vercel Blob file.
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
- Export JSON regularly. It is the quickest independent backup and migration format.
