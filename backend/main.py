import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel

from agent import agent
from callbacks import _callback
from db import ensure_indexes
from ingest_file import ingest
from minio_client import list_minio_objects as list_minio_objects_from_storage
from minio_client import read_minio_object
from voice import handle_voice_call

load_dotenv(Path(__file__).parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(name)-20s %(levelname)s %(message)s"))
    for name in ("ingest_file", "agent", "voice"):
        lg = logging.getLogger(name)
        lg.addHandler(handler)
        lg.setLevel(logging.INFO)
    yield


app = FastAPI(lifespan=lifespan)


class AskRequest(BaseModel):
    question: str


class IngestMinioRequest(BaseModel):
    bucket: str = "raw-data"
    key: str


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(b["text"] for b in content if isinstance(b, dict) and "text" in b)
    return ""


@app.post("/ask")
def ask(req: AskRequest):
    result = agent.invoke(
        {"messages": [HumanMessage(content=req.question)]},
        config=RunnableConfig(callbacks=[_callback]),
    )

    tool_calls = []
    for msg in result["messages"]:
        if isinstance(msg, AIMessage):
            for tc in msg.tool_calls or []:
                tool_calls.append({"tool": tc["name"], "input": tc["args"], "output": None})
        elif isinstance(msg, ToolMessage):
            for t in reversed(tool_calls):
                if t["output"] is None:
                    t["output"] = msg.content
                    break

    response = next(
        (_text(m.content) for m in reversed(result["messages"]) if isinstance(m, AIMessage) and _text(m.content)),
        "",
    )
    return {"response": response, "tool_calls": tool_calls}


@app.post("/ingest/file")
async def ingest_file_endpoint(
    file: UploadFile = File(...),
    source_path: str = Form(default=""),
):
    file_bytes = await file.read()
    return ingest(file_bytes, file.filename or "upload", source_path)


@app.get("/minio/objects")
def list_minio_objects(bucket: str = "raw-data", prefix: str = "", limit: int = 25):
    return list_minio_objects_from_storage(bucket, prefix, limit)


@app.post("/ingest/minio")
def ingest_minio(req: IngestMinioRequest):
    file_bytes, etag = read_minio_object(req.bucket, req.key)
    filename = Path(req.key).name
    result = ingest(file_bytes, filename, f"minio://{req.bucket}/{req.key}")
    return {
        "bucket": req.bucket,
        "key": req.key,
        "etag": etag,
        **result,
    }
@app.post("/ingest/day/{day}")
def ingest_day(day: str):
    day_dir = _RAW_DATA / "incremental" / day
    if not day_dir.exists():
        raise HTTPException(404, f"day dir not found: {day_dir}")
    files = sorted(f for f in day_dir.rglob("*") if f.is_file())
    return {"day": day, "results": _ingest_dir(files, _RAW_DATA)}


@app.websocket("/voice")
async def voice_endpoint(ws: WebSocket):
    await handle_voice_call(ws)
