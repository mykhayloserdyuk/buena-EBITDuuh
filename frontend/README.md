# Frontend

Next.js 16 chat interface for Buena. Connects to the FastAPI backend for document queries, streaming responses, and file management.

Can be run standalone against any backend URL, or as part of the full stack via Docker Compose. See the [root README](../README.md) for the full picture.

---

## Quickstart

```sh
cd frontend
cp .env.local.example .env.local
# Set BACKEND_URL=http://localhost:8000

npm install
npm run dev
# → http://localhost:3000
```

## Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_URL` | FastAPI backend base URL | `http://localhost:8000` |

## Stack

- **Next.js 16** · React 19 · TypeScript 5
- **Tailwind CSS 4** for styling
- **Streaming** — responses stream token-by-token from the backend agent
- **File preview** — inline document rendering alongside chat

## Docker

```sh
docker build -t buena-frontend .
docker run -e BACKEND_URL=http://backend:8000 -p 3000:3000 buena-frontend
```

## Production

In production the frontend runs on GKE behind ingress-nginx with TLS. Image tags are managed automatically by Flux CD — push a new semver tag to GHCR and it rolls out within a minute.

See [`infra/README.md`](../infra/README.md) for the full deployment guide.
