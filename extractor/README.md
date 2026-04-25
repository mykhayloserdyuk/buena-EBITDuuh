# LangChain Extractor Prototype

FastAPI prototype for extracting document summary, main points, and structured accounting data from raw documents with LangChain + Gemini.

## Setup

```sh
cd extractor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_API_KEY="your-google-api-key"
uvicorn extractor:app --reload
```

`GEMINI_API_KEY` also works. You can put either key in `extractor/.env` instead of exporting it. Override the default model with `GEMINI_MODEL`; default is `gemini-2.5-flash`.

The extraction workflow is:

1. Identify the document type.
2. Summarize what the document is about.
3. List the main points.
4. Extract accounting fields, dates, entities, line items, and open questions.

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
