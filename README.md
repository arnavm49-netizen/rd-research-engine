# R&D Research Engine

Self-hosted AI research intelligence platform for engineering R&D — discover papers, ingest documents (PDFs, datasets, images, test reports), translate, query with RAG, suggest formulas & test methods, and analyze research coverage gaps. Sensitive data stays air-gapped via a sensitivity gate that routes proprietary content to retrieval-only mode (never sent to cloud LLMs).

## Architecture

```
Next.js 15 (web + API)  ──┐
                          ├── PostgreSQL (Prisma)
BullMQ Worker  ───────────┤
                          ├── Redis (queue)
FastAPI ML Service ───────┤
  • PyMuPDF + OCR         ├── Qdrant (vectors, classification-aware)
  • sentence-transformers │
  • Sensitivity gate      ├── MinIO / S3 / R2 (files)
  • arXiv/SS/CrossRef     │
  • Claude API (PUBLIC)   └── Anthropic API (optional, PUBLIC docs only)
```

## Run locally

Requires Docker Desktop. Then:

```bash
./launch-rd-engine.command
```

This brings up the entire stack (Postgres, Redis, Qdrant, MinIO, ML service, worker, web app) and opens http://localhost:3000.

Default users (created by `prisma/seed.ts`):

| Email | Password | Role | Access Level |
|---|---|---|---|
| `admin@dhsecheron.com` | `admin123` | ADMIN | RESTRICTED |
| `researcher@dhsecheron.com` | `researcher123` | RESEARCHER | CONFIDENTIAL |

**To enable AI synthesis on PUBLIC documents**, add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY="sk-ant-..."
```
Then restart the ML service: `docker compose up -d --force-recreate ml-service`.

## Data classification model

| Level | What gets stored here | Query mode |
|---|---|---|
| PUBLIC | Published papers, patents, standards | Claude API generates synthesized answer with citations |
| INTERNAL | Company reports, meeting notes | Retrieval-only — chunks + citations, no AI generation |
| CONFIDENTIAL | Proprietary formulations, test data | Retrieval-only |
| RESTRICTED | Trade secrets, patent-pending | Retrieval-only, restricted user access |

The sensitivity gate runs at query time: if any retrieved chunk is INTERNAL or higher, the response automatically switches to retrieval-only mode and **no data is sent to any external API**.

## Deploy to Render

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide. Quick version:

1. Push this repo to GitHub
2. Sign in to https://dashboard.render.com → **New → Blueprint**
3. Connect this repo, select the `render.yaml` file
4. Set required secrets: `ANTHROPIC_API_KEY`, `S3_*` (for Cloudflare R2 or AWS S3)
5. Click Apply. ~10 min to first deploy.

Estimated cost: **~$32/mo** (free Postgres/Redis + paid web/worker/ML/Qdrant).

## Tech stack

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS + TypeScript
- **API:** Next.js Route Handlers + NextAuth v5 (credentials)
- **ORM:** Prisma + PostgreSQL
- **Queue:** BullMQ + Redis
- **Vector DB:** Qdrant (self-hosted)
- **Embeddings:** sentence-transformers/all-MiniLM-L6-v2 (local, 384-dim)
- **LLM:** Claude Sonnet (PUBLIC data only) via Anthropic SDK
- **File extraction:** PyMuPDF, pdfplumber, python-docx, openpyxl, Tesseract OCR
- **Discovery:** arXiv, Semantic Scholar, CrossRef, PubMed
- **Storage:** MinIO (local) or S3-compatible (production)

## Project structure

```
.
├── app/                     # Next.js App Router (pages + API routes)
│   ├── (auth)/login/        # Login page
│   ├── (app)/               # Authenticated app shell
│   │   ├── dashboard/
│   │   ├── library/         # Document upload + browsing
│   │   ├── discover/        # Live paper discovery (arXiv/SS/CrossRef/PubMed)
│   │   ├── query/           # RAG chat interface with sensitivity-aware responses
│   │   ├── formulas/        # Formula + test method browser
│   │   ├── analysis/        # Research gap analysis
│   │   └── admin/           # Users, queries, audit log
│   └── api/                 # Auth, documents, query, discover endpoints
├── components/              # React UI components
├── lib/                     # Auth, DB, S3, queue, ML client, env validation
├── prisma/                  # Schema, migrations, seed
├── ml-service/              # FastAPI Python service (Dockerized)
│   └── app/
│       ├── routers/         # ingest, query, discover, translate, formulas, gaps
│       └── services/        # extraction, chunking, embeddings, vector_store,
│                            # sensitivity_gate, claude_client, discovery/*,
│                            # translation, formula_engine, gap_analyzer
├── worker/                  # BullMQ ingestion worker
├── docker-compose.yml       # Local infrastructure stack
├── render.yaml              # Render Blueprint for production deploy
├── launch-rd-engine.command # macOS one-click launcher
└── DEPLOYMENT.md            # Render deployment guide
```

## Stop everything

```bash
docker compose down       # Stop containers (data persists)
docker compose down -v    # Stop and wipe all data
```

## Safety reminders

- **Never commit `.env`** — it contains your API keys. The `.gitignore` already handles this.
- **The sensitivity gate is the security boundary** — when adding new query paths, always run them through `sensitivity_gate.check_sensitivity()` before any external API call.
- **Rotate `NEXTAUTH_SECRET`** in production — the value in `.env.example` is a placeholder.
