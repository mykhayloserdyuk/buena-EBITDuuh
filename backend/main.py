import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel

from agent import agent
from callbacks import _callback
from db import ensure_indexes
from ingest_file import ingest

load_dotenv(Path(__file__).parent / ".env")

_RAW_DATA = Path(os.environ.get("RAW_DATA_PATH", "../raw-data"))
_SKIP = {".DS_Store", "incremental_manifest.json", "stammdaten.json"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(name)-20s %(levelname)s %(message)s"))
    for name in ("ingest_file", "agent"):
        lg = logging.getLogger(name)
        lg.addHandler(handler)
        lg.setLevel(logging.INFO)
    yield


app = FastAPI(lifespan=lifespan)


def _ingest_path(path: Path, source_path: str = "") -> dict:
    return ingest(path.read_bytes(), path.name, source_path or str(path))


def _ingest_dir(files: list[Path], base: Path) -> list[dict]:
    results = []
    for f in files:
        if f.name in _SKIP or f.suffix == ".json":
            continue
        rel = str(f.relative_to(base))
        logging.getLogger("ingest_file").info("--- %s ---", rel)
        results.append({"file": rel, **_ingest_path(f, rel)})
    return results


class AskRequest(BaseModel):
    question: str


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


@app.post("/ingest/stammdaten")
def ingest_stammdaten():
    stammdaten_dir = _RAW_DATA / "stammdaten"
    if not stammdaten_dir.exists():
        raise HTTPException(404, f"stammdaten dir not found: {stammdaten_dir}")
    files = sorted(stammdaten_dir.glob("*.csv"))
    return {"results": _ingest_dir(files, _RAW_DATA)}


@app.post("/ingest/day/{day}")
def ingest_day(day: str):
    day_dir = _RAW_DATA / "incremental" / day
    if not day_dir.exists():
        raise HTTPException(404, f"day dir not found: {day_dir}")
    files = sorted(f for f in day_dir.rglob("*") if f.is_file())
    return {"day": day, "results": _ingest_dir(files, _RAW_DATA)}
