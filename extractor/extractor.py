import os
from io import BytesIO
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional until requirements are installed
    PdfReader = None


DEFAULT_MODEL = "gemini-2.5-flash-lite"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

load_dotenv(Path(__file__).with_name(".env"))


class ExtractRequest(BaseModel):
    content: str = Field(..., min_length=1)
    document_name: str | None = None
    schema_hint: str | None = None


class LineItem(BaseModel):
    description: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    amount: float | None = None


class AccountingFields(BaseModel):
    document_type: Literal["invoice", "bank_statement", "email", "letter", "unknown"] = "unknown"
    document_date: str | None = Field(default=None, description="Document date as YYYY-MM-DD when available.")
    counterparty: str | None = None
    invoice_number: str | None = None
    currency: str | None = None
    net_amount: float | None = None
    tax_amount: float | None = None
    gross_amount: float | None = None
    payment_reference: str | None = None
    iban: str | None = None
    line_items: list[LineItem] = Field(default_factory=list)


class DocumentExtraction(BaseModel):
    summary: str = Field(..., description="Short human-readable summary of what the document is about.")
    main_points: list[str] = Field(default_factory=list, description="Most important facts, obligations, dates, and actions.")
    accounting: AccountingFields = Field(default_factory=AccountingFields)
    entities: list[str] = Field(default_factory=list, description="People, companies, banks, addresses, or other named entities.")
    dates: list[str] = Field(default_factory=list, description="Relevant dates in YYYY-MM-DD format when possible.")
    open_questions: list[str] = Field(default_factory=list, description="Things that could not be determined from the document.")
    confidence: float = Field(..., ge=0, le=1)


class ExtractResponse(BaseModel):
    model: str
    document_name: str | None
    extraction: DocumentExtraction


app = FastAPI(title="Buena EBITDuuh Extractor", version="0.1.0")


def _get_api_key() -> str:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set GOOGLE_API_KEY or GEMINI_API_KEY before calling the extractor.",
        )
    return api_key


def _get_model_name() -> str:
    return os.getenv("GEMINI_MODEL", DEFAULT_MODEL)


def _build_chain() -> Any:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a careful data extraction assistant for German property-management "
                "and accounting documents. Extract only facts that are present in the source. "
                "Prefer null or empty lists over guessing. Dates should use YYYY-MM-DD when possible.",
            ),
            (
                "human",
                "Document name: {document_name}\n"
                "Additional schema/user hint: {schema_hint}\n\n"
                "Workflow:\n"
                "1. Identify what kind of document this is.\n"
                "2. Summarize the document in one or two sentences.\n"
                "3. List the main points a human should know.\n"
                "4. Extract accounting fields, amounts, dates, entities, and open questions.\n\n"
                "Source content:\n{content}",
            ),
        ]
    )
    llm = ChatGoogleGenerativeAI(
        model=_get_model_name(),
        temperature=0,
        google_api_key=_get_api_key(),
    )
    return prompt | llm.with_structured_output(DocumentExtraction, method="json_schema")


def _extract_with_llm(content: str, document_name: str | None, schema_hint: str | None) -> ExtractResponse:
    model = _get_model_name()
    chain = _build_chain()
    try:
        extraction = chain.invoke(
            {
                "content": content,
                "document_name": document_name or "unknown",
                "schema_hint": schema_hint or "none",
            }
        )
    except Exception as exc:
        message = str(exc)
        status_code = 429 if "RESOURCE_EXHAUSTED" in message or "429" in message else 502
        raise HTTPException(status_code=status_code, detail=f"LLM extraction failed: {message}") from exc
    if isinstance(extraction, dict):
        extraction = DocumentExtraction.model_validate(extraction)
    return ExtractResponse(
        model=model,
        document_name=document_name,
        extraction=extraction,
    )


def _decode_upload(filename: str, content_type: str | None, raw: bytes) -> str:
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is larger than 10 MB.")

    lowered = filename.lower()
    if lowered.endswith(".pdf") or content_type == "application/pdf":
        if PdfReader is None:
            raise HTTPException(status_code=500, detail="PDF support requires pypdf to be installed.")
        reader = PdfReader(BytesIO(raw))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            raise HTTPException(status_code=422, detail="No extractable text found in PDF.")
        return text

    for encoding in ("utf-8", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise HTTPException(status_code=415, detail="Unsupported file encoding.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract/text", response_model=ExtractResponse)
def extract_text(request: ExtractRequest) -> ExtractResponse:
    return _extract_with_llm(request.content, request.document_name, request.schema_hint)


@app.post("/extract/file", response_model=ExtractResponse)
async def extract_file(
    file: UploadFile = File(...),
    schema_hint: str | None = None,
) -> ExtractResponse:
    raw = await file.read()
    content = _decode_upload(file.filename or "upload", file.content_type, raw)
    return _extract_with_llm(content, file.filename, schema_hint)
