from typing import Literal

from pydantic import BaseModel, Field

from .config import DEFAULT_COLLECTION


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


class IngestLocalRequest(BaseModel):
    path: str = Field(..., description="Path to a local file, relative to the repository root or absolute.")
    schema_hint: str | None = None
    collection: str = DEFAULT_COLLECTION


class IngestMinioRequest(BaseModel):
    key: str = Field(..., description="Object key in the MinIO bucket, for example raw-data/rechnungen/...")
    bucket: str = "raw-data"
    schema_hint: str | None = None
    collection: str = DEFAULT_COLLECTION


class IngestResponse(BaseModel):
    collection: str
    id: str
    upserted: bool
    matched_count: int
    modified_count: int
    extraction: ExtractResponse


class MinioObject(BaseModel):
    bucket: str
    key: str
    size_bytes: int
    etag: str | None = None


class MinioListResponse(BaseModel):
    bucket: str
    prefix: str
    objects: list[MinioObject]
