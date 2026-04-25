# LangChain Extractor Prototype

FastAPI prototype for extracting document summary, main points, and structured accounting data from raw documents with LangChain + Gemini.

## Setup

```sh
cd extractor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_API_KEY="your-google-api-key"
export MONGO_URI="mongodb://user:password@host:27017/buena?authSource=admin"
export MINIO_ENDPOINT="host:9000"
export MINIO_USER="user"
export MINIO_PASS="password"
uvicorn app.main:app --reload
```

`GEMINI_API_KEY` also works. You can put either key in `extractor/.env` instead of exporting it. Override the default model with `GEMINI_MODEL`; default is `gemini-2.5-flash`.

The extraction workflow is:

1. Identify the document type.
2. Summarize what the document is about.
3. List the main points.
4. Extract accounting fields, dates, entities, line items, and open questions.

## Structure

```text
app/main.py             FastAPI app creation
app/routes.py           HTTP route handlers
app/schemas.py          Pydantic request/response/extraction models
app/config.py           Environment loading and settings helpers
app/document_loader.py  PDF/text decoding and local path resolution
app/llm.py              LangChain prompt and Gemini structured extraction
app/storage.py          MongoDB and MinIO clients
app/ingestion.py        Ingest orchestration and MongoDB persistence
```

## Endpoints

```sh
curl http://127.0.0.1:8000/health
```

```sh
curl -X POST http://127.0.0.1:8000/extract/text \
  -H 'Content-Type: application/json' \
  -d '{"document_name":"invoice.txt","content":"Invoice INV-1 total 119 EUR including 19 EUR VAT"}'
```

```sh
curl -X POST http://127.0.0.1:8000/extract/file \
  -F 'file=@../raw-data/bank/bank_index.csv'
```

Ingest one local file into MongoDB:

```sh
curl -X POST http://127.0.0.1:8000/ingest/local \
  -H 'Content-Type: application/json' \
  -d '{"path":"raw-data/rechnungen/2024-01/20240106_DL-010_INV-00001.pdf"}'
```

Upload and ingest one file into MongoDB:

```sh
curl -X POST http://127.0.0.1:8000/ingest/file \
  -F 'file=@../raw-data/rechnungen/2024-01/20240106_DL-010_INV-00001.pdf'
```

List MinIO objects:

```sh
curl 'http://127.0.0.1:8000/minio/objects?bucket=raw-data&prefix=rechnungen/2024-01/&limit=5'
```

Ingest one MinIO object into MongoDB:

```sh
curl -X POST http://127.0.0.1:8000/ingest/minio \
  -H 'Content-Type: application/json' \
  -d '{"bucket":"raw-data","key":"rechnungen/2024-01/20240106_DL-010_INV-00001.pdf"}'
```
