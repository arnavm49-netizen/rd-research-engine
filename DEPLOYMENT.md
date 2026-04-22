# Deployment Guide — Render

This guide walks through deploying the R&D Research Engine to Render so your team can access it over the internet.

## Prerequisites

1. A GitHub account (free)
2. A Render account (free signup: https://dashboard.render.com)
3. An Anthropic API key with credits — https://console.anthropic.com
4. An S3-compatible object storage bucket. **Recommended:** Cloudflare R2 (10 GB free).

## Step 1 — Push to GitHub

From the project directory:

```bash
cd "/Users/arnavmaheshwari/Library/CloudStorage/OneDrive-Personal/Desktop/Files/Work/D&H Secheron/GPT/Codex/R&D"

# One-time git init (skip if already done)
git init -b main
git add .
git commit -m "Initial commit: R&D Research Engine"
```

Then create a new private repo on GitHub at https://github.com/new (name suggestion: `rd-research-engine`).
Copy the repo URL Github gives you and run:

```bash
git remote add origin git@github.com:<your-org>/rd-research-engine.git
git push -u origin main
```

(If you don't have SSH set up, use the HTTPS URL — `https://github.com/<your-org>/rd-research-engine.git`.)

## Step 2 — Set up file storage (Cloudflare R2)

R2 is S3-compatible and has a generous free tier (10 GB storage, 1M Class A operations / month — way more than enough).

1. Create a Cloudflare account (free): https://dash.cloudflare.com/sign-up
2. In the dashboard, sidebar → **R2 Object Storage** → **Create bucket** → name it `rd-documents`
3. **Settings → Manage R2 API Tokens → Create API Token** → permissions: "Object Read & Write" for that bucket → save the **Access Key ID** and **Secret Access Key**
4. Note your account ID (top right of R2 dashboard) — your endpoint will be:
   ```
   https://<account-id>.r2.cloudflarestorage.com
   ```

Save these four values — you'll paste them into Render in the next step:
- `S3_ENDPOINT` = `https://<account-id>.r2.cloudflarestorage.com`
- `S3_REGION` = `auto`
- `S3_BUCKET` = `rd-documents`
- `S3_ACCESS_KEY` = (your token's access key)
- `S3_SECRET_KEY` = (your token's secret key)

(If you'd rather use AWS S3, set `S3_ENDPOINT=https://s3.<region>.amazonaws.com` and `S3_REGION=<region>`.)

## Step 3 — Deploy via Render Blueprint

1. Go to https://dashboard.render.com → **New → Blueprint**
2. Connect your GitHub account if prompted, then select the `rd-research-engine` repo
3. Render reads `render.yaml` and shows a preview of all services that will be created:
   - `rd-postgres` (database, free)
   - `rd-redis` (key-value store, free)
   - `rd-qdrant` (private service, $7/mo Starter)
   - `rd-ml-service` (web service, $25/mo Standard — needs 2 GB RAM for PyTorch)
   - `rd-web` (web service, $7/mo Starter)
   - `rd-worker` (background worker, $7/mo Starter)
4. Click **Apply**
5. Render will prompt you for the secrets it can't auto-generate. Paste:
   - `ANTHROPIC_API_KEY` → your Claude key (used only for PUBLIC docs)
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (paste the same values into BOTH the `rd-web` and `rd-worker` services)
6. Click **Apply**

First deploy takes **~10–15 minutes** (mostly the ML service Docker build, which downloads PyTorch).

## Step 4 — Run database seed (one-time)

The schema gets pushed automatically on first start, but you need to seed the initial users. From the Render dashboard:

1. Open **rd-web** → **Shell** tab
2. Run:
   ```bash
   npx prisma db seed
   ```
3. You should see `Seed completed successfully`.

## Step 5 — Log in

Find your web app URL in the `rd-web` service dashboard (something like `https://rd-web-xxxx.onrender.com`).

Open it and log in:
- `admin@dhsecheron.com` / `admin123`

**⚠️ Change the admin password immediately** by going to Admin → Users (TODO: build this UI) or via the Render shell:
```bash
node -e "
const bcrypt=require('bcryptjs');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
db.user.update({
  where:{email:'admin@dhsecheron.com'},
  data:{passwordHash:bcrypt.hashSync('YOUR_NEW_PASSWORD',12)}
}).then(()=>console.log('updated'));
"
```

## Adding teammates

Currently users are managed via the Render shell. Quick add:

```bash
# In rd-web shell
node -e "
const bcrypt=require('bcryptjs');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
db.user.create({data:{
  email:'teammate@dhsecheron.com',
  name:'Teammate Name',
  passwordHash:bcrypt.hashSync('temp-password-change-me',12),
  role:'RESEARCHER',
  classificationAccess:'CONFIDENTIAL'
}}).then(u=>console.log('Created',u.email));
"
```

Roles: `ADMIN | RESEARCHER | VIEWER`. Access levels: `PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED`. A user can see all classifications at-or-below their access level.

## Costs (per month)

| Service | Plan | Cost |
|---|---|---|
| rd-postgres | Free (1 GB, 90-day expiry) | $0 — but **upgrade to Starter ($7/mo) for production** |
| rd-redis | Free (25 MB) | $0 |
| rd-qdrant | Starter (private service) | $7 |
| rd-ml-service | Standard (2 GB RAM) | $25 |
| rd-web | Starter | $7 |
| rd-worker | Starter | $7 |
| Cloudflare R2 | Free tier | $0 (up to 10 GB) |
| Anthropic API | Pay-per-use | ~$0.003 per query (Sonnet) |
| **Total fixed** | | **~$46/mo** |

If you don't need air-gapped vector storage, you can save $7/mo by switching to **Qdrant Cloud free tier** (1 GB, suitable for ~100k chunks).

## Updating the deployed app

Just push to GitHub:

```bash
git add .
git commit -m "your changes"
git push
```

Render auto-deploys all services on push to `main`. Builds take 2–5 minutes (web/worker), or 10+ min (ML service if you changed `requirements.txt` or `Dockerfile`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `rd-ml-service` shows "Out of memory" during build | Upgrade to **Standard Plus** ($85/mo, 4 GB RAM) — PyTorch is memory-hungry. Or migrate to a hosted embedding service. |
| Web app can't connect to Postgres | Open `rd-web` env vars — `DATABASE_URL` should auto-populate from `rd-postgres`. Re-deploy. |
| Worker shows `ECONNREFUSED` to ML service | Check the `ML_SERVICE_URL` env var on `rd-worker` — should be `http://<rd-ml-service.host>:<port>`. Render sometimes needs a manual redeploy after blueprint changes. |
| Uploads fail with `NoSuchBucket` | Confirm the bucket name matches `S3_BUCKET` exactly. R2 buckets are case-sensitive. |
| Free Postgres expired (90-day timeout) | Upgrade to Starter, or run `pg_dump`/`pg_restore` to migrate to a fresh free instance. |

## Hardening checklist before sharing with the team

- [ ] Change the `admin` and `researcher` default passwords
- [ ] Upgrade `rd-postgres` from Free to Starter (avoids 90-day data loss)
- [ ] Restrict the Cloudflare R2 API token to read/write the single bucket only
- [ ] Set up a custom domain (Render → rd-web → Settings → Custom Domains)
- [ ] Enable Render's Auto-deploy only on `main` branch
- [ ] Add a backup cron (use Render Cron Jobs to run `pg_dump` weekly to R2)
- [ ] Audit who has access to the GitHub repo (it contains schema, prompts, formula DB)

## Next steps after deploy

This MVP covers Phase 1–2 of the [project plan](./.claude/plans/iridescent-spinning-crayon.md). Logical next features for the team:

1. **User management UI** (currently shell-only)
2. **"Approve & Ingest" wiring** on the Discover page (the buttons exist but don't trigger ingestion yet)
3. **Email alerts** for new high-relevance papers (BullMQ scheduled jobs)
4. **Citation graph visualization** (D3.js)
5. **Literature review report generation** (auto-generated DOCX/PDF)
6. **Domain calculators** — heat input, dilution, hardness conversion (UI for the formulas already in the DB)
