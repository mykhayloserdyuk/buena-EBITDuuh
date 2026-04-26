# Buena — Your data should grow with you.

> **[buena-platform.com](https://buena-platform.com)** — AI-powered property management that learns from every document, email, and transaction you throw at it.

Most software forces you to adapt your workflows to fit its data model. Buena works the other way: every new document, email, invoice, or bank statement automatically expands the system's understanding. Entities are discovered, relationships are maintained, and the AI gets smarter with every interaction — without any manual configuration.

---

## How it works

```
                    ┌─────────────────────────────────────┐
                    │         All Documents Supported      │
                    │    (PDFs, emails, invoices, CSVs…)   │
                    └──────────────────┬──────────────────┘
                                       │
                           ┌───────────▼───────────┐
                           │   Load · Process ·    │
                           │   Update · Ingest     │
                           │                       │
                           │  Runs and updates     │
                           │  with every new doc   │
                           └───────────┬───────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │       Self-Evolving Structured Data  │
                    │                                      │
                    │  • Maintains all entities            │
                    │  • Tracks all interactions           │
                    │  • Grows with your data              │
                    └──────────────────┬──────────────────┘
                                       │
                           ┌───────────▼───────────┐
                           │        Buena AI        │
                           │                        │
                           │  Navigates and queries │
                           │  data autonomously     │
                           └───────────┬───────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │       Happy Property Management      │
                    └─────────────────────────────────────┘
```

**The key insight:** the data structure is never fixed. Each ingested document can introduce new entities and extend existing ones. The AI agent always works on the latest, most complete picture of your portfolio.

---

## Mission & Values

**Buena exists to make property management effortless for everyone** — from individual landlords managing a single apartment to professional operators running large portfolios.

We believe:
- **Data should serve people, not the other way around.** You should never have to clean, reformat, or pre-process documents to use your own information.
- **AI should be invisible.** The best AI experience is one where things just work — you send a document, the system understands it.
- **Transparency builds trust.** Every answer Buena gives is traceable back to the source document.
- **Local first, cloud ready.** Run the full stack on your laptop in minutes, or deploy to production on Google Cloud with a single Terraform apply.

---

## This repository

This is a **monorepo** containing every component needed to bootstrap the Buena platform from scratch. Each component is independently deployable or can be run together as a full stack — locally via Docker Compose or in production on Google Cloud.

```
buena-EBITDuuh/
├── frontend/     # Next.js chat interface
├── backend/      # FastAPI document ingestion & AI agent
├── infra/        # Terraform + Kubernetes manifests (GKE)
└── raw-data/     # Seed documents synced to object storage
```

| Component | What it does | Bootstrap alone? |
|-----------|-------------|-----------------|
| [`frontend/`](./frontend/) | Next.js UI — chat, document preview, conversation history | Yes — `npm run dev` |
| [`backend/`](./backend/) | FastAPI — document ingestion, LangChain agent, MongoDB, MinIO | Yes — `docker compose up` |
| [`infra/`](./infra/) | GKE cluster, ingress, TLS, GitOps via Flux CD | Yes — `terraform apply` |

---

## Quickstart

### Local (all components together)

```sh
# 1. Clone
git clone https://github.com/mykhayloserdyuk/buena-EBITDuuh
cd buena-EBITDuuh

# 2. Configure secrets
cp backend/.env.example backend/.env
# Fill in: MODEL_PROVIDER, MODEL_NAME, GEMINI_API_KEY

# 3. Start
docker compose up

# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
# MongoDB  → localhost:27017
```

### Google Cloud (production)

Each component can be bootstrapped independently on GCP, or all at once:

```sh
cd infra
cp .env.example .env
# Fill in: TF_VAR_ghcr_username, TF_VAR_pat, TF_VAR_gemini_api_key, …

terraform init
terraform apply
# → GKE cluster, ingress, TLS, Flux GitOps, MinIO, MongoDB — all provisioned
```

Once the cluster is up, Flux CD takes over: push a new image tag and it automatically rolls out to production. See [`infra/README.md`](./infra/README.md) for the full operational runbook.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, LangChain, LangGraph, Google Gemini / OpenAI |
| Document parsing | Docling, PyMuPDF, pdfplumber, python-docx |
| Storage | MongoDB 7 (structured data), MinIO (blob/documents) |
| Infrastructure | GKE (GCP `europe-west3`), Terraform, Helm |
| GitOps | Flux CD — auto image updates from GHCR |
| TLS | cert-manager + Let's Encrypt |
| CI/CD | GitHub Actions — build, release, raw-data sync |

---

## Built at the Big Berlin Hack

This project was built as part of the **[Big Berlin Hack](https://bigberlinhack.com)**, a hackathon organised by **[Tech Europe](https://techeurope.io)** — the community of European technology leaders. The event brings together founders, engineers, and operators to build ambitious products in a compressed timeframe.

---

## Links

- **Platform:** [buena-platform.com](https://buena-platform.com)
- **Infrastructure guide:** [`infra/README.md`](./infra/README.md)
- **Frontend guide:** [`frontend/README.md`](./frontend/README.md)
