from typing import Any

from fastapi import HTTPException
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from .config import get_api_key, get_model_name
from .schemas import DocumentExtraction, ExtractResponse


def build_extraction_chain() -> Any:
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
        model=get_model_name(),
        temperature=0,
        google_api_key=get_api_key(),
    )
    return prompt | llm.with_structured_output(DocumentExtraction, method="json_schema")


def extract_with_llm(content: str, document_name: str | None, schema_hint: str | None) -> ExtractResponse:
    model = get_model_name()
    chain = build_extraction_chain()
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
    return ExtractResponse(model=model, document_name=document_name, extraction=extraction)
