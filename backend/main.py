import asyncio
import json
import logging
import mimetypes
import os
from contextlib import asynccontextmanager
from email import message_from_bytes
from pathlib import Path
from urllib.parse import quote_plus

from voice import handle_voice_call
import env  # noqa: F401 — loads .env and .env.infra before any other local imports
from typing import Annotated
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel

from agent import openui_agent
from callbacks import _callback
from db import _db, ensure_indexes
from email_poller import run_email_poller
from ingest_file import ingest
from minio_client import list_minio_object_keys, minio_prefix_exists, read_minio_object

#load_dotenv(Path(__file__).parent / ".env")

_RAW_DATA = os.environ.get("RAW_DATA_BUCKET", "raw-data")
_RAW_DATA_PREFIX = os.environ.get("RAW_DATA_PREFIX", "").strip("/")
_SKIP = {".DS_Store", "incremental_manifest.json", "stammdaten.json"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(name)-20s %(levelname)s %(message)s")
    )
    for name in ("ingest_file", "agent", "email_poller"):
        lg = logging.getLogger(name)
        lg.addHandler(handler)
        lg.setLevel(logging.INFO)
    poller_task = asyncio.create_task(run_email_poller())
    yield
    poller_task.cancel()
    await asyncio.gather(poller_task, return_exceptions=True)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "*")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _raw_key(path: str) -> str:
    path = path.strip("/")
    if _RAW_DATA_PREFIX:
        return f"{_RAW_DATA_PREFIX}/{path}" if path else _RAW_DATA_PREFIX
    return path


def _raw_rel(key: str) -> str:
    if _RAW_DATA_PREFIX and key.startswith(f"{_RAW_DATA_PREFIX}/"):
        return key[len(_RAW_DATA_PREFIX) + 1 :]
    return key


def _ingest_path(key: str, source_path: str = "") -> dict:
    file_bytes, _etag = read_minio_object(_RAW_DATA, key)
    return ingest(file_bytes, Path(key).name, source_path or _raw_rel(key), raw_key=key)


def _ingest_dir(files: list[str]) -> list[dict]:
    results = []
    for f in files:
        path = Path(_raw_rel(f))
        if path.name in _SKIP or path.suffix == ".json":
            continue
        rel = str(path)
        logging.getLogger("ingest_file").info("--- %s ---", rel)
        results.append({"file": rel, **_ingest_path(f, rel)})
    return results


class AskRequest(BaseModel):
    question: str
    conversation_id: str


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b["text"] for b in content if isinstance(b, dict) and "text" in b
        )
    return ""


def _number_label(value: int, singular: str, plural: str) -> str:
    return f"{value} {singular if value == 1 else plural}"


def _to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number.is_integer() is False else int(number)


def _first_number(doc: dict, fields: list[str]):
    for field in fields:
        number = _to_number(doc.get(field))
        if isinstance(number, (int, float)):
            return number
    return None


def _house_number(house_id: str) -> str:
    return house_id.removeprefix("HAUS-")


def _presentation_address(house_id: str) -> str:
    return f"Immanuelkirchstraße {_house_number(house_id)}, 10405 Berlin"


def _maps_url(address: str) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(address)}"


def _unit_name(doc: dict) -> str:
    return str(doc.get("einheit_nr") or doc.get("name") or doc.get("_id") or "").strip()


def _unit_meta(doc: dict) -> str:
    area = _to_number(doc.get("wohnflaeche_qm"))
    rooms = _to_number(doc.get("zimmer"))
    parts = [
        str(doc.get("lage") or ""),
        str(doc.get("typ") or ""),
        f"{area:g} qm" if isinstance(area, (int, float)) and area > 0 else "",
        f"{rooms:g} Zi." if isinstance(rooms, (int, float)) and rooms > 0 else "",
    ]
    return " · ".join(part for part in parts if part)


_RENT_FIELDS = [
    "miete",
    "rent",
    "income",
    "kaltmiete",
    "warmmiete",
    "nettokaltmiete",
    "bruttomiete",
    "monatsmiete",
    "miete_monat",
    "monthly_rent",
]


def _load_rent_index() -> tuple[dict[str, float], dict[str, float]]:
    tenant_docs = _db["entities"].find(
        {"type": "mieter"},
        {
            "_id": 1,
            "einheit_id": 1,
            "unit_id": 1,
            "unitId": 1,
            "einheit": 1,
            "haus_id": 1,
            "einheit_nr": 1,
            **{field: 1 for field in _RENT_FIELDS},
        },
    )

    rent_by_unit_id: dict[str, float] = {}
    rent_by_house_unit: dict[str, float] = {}
    for doc in tenant_docs:
        rent = _first_number(doc, _RENT_FIELDS)
        if not isinstance(rent, (int, float)):
            continue

        for unit_id_field in ("einheit_id", "unit_id", "unitId", "einheit"):
            unit_id = doc.get(unit_id_field)
            if isinstance(unit_id, str) and unit_id:
                rent_by_unit_id[unit_id] = rent_by_unit_id.get(unit_id, 0) + rent

        haus_id = doc.get("haus_id")
        einheit_nr = doc.get("einheit_nr")
        if isinstance(haus_id, str) and isinstance(einheit_nr, str):
            key = f"{haus_id}|{einheit_nr}"
            rent_by_house_unit[key] = rent_by_house_unit.get(key, 0) + rent

    return rent_by_unit_id, rent_by_house_unit


@app.get("/properties")
def properties():
    rent_by_unit_id, rent_by_house_unit = _load_rent_index()
    unit_docs = list(
        _db["entities"]
        .find(
            {"type": "einheit", "haus_id": {"$type": "string", "$ne": ""}},
            {
                "_id": 1,
                "haus_id": 1,
                "einheit_nr": 1,
                "lage": 1,
                "typ": 1,
                "wohnflaeche_qm": 1,
                "zimmer": 1,
                "miteigentumsanteil": 1,
                **{field: 1 for field in _RENT_FIELDS},
            },
        )
        .sort([("haus_id", 1), ("einheit_nr", 1), ("_id", 1)])
    )

    if not unit_docs:
        return {"properties": []}

    house_map: dict[str, dict] = {}
    for doc in unit_docs:
        house_id = str(doc["haus_id"])
        house = house_map.setdefault(house_id, {"total_area": 0, "units": []})
        area = _to_number(doc.get("wohnflaeche_qm"))
        if isinstance(area, (int, float)):
            house["total_area"] += area
        unit_id = str(doc["_id"])
        house_unit_key = f"{house_id}|{doc.get('einheit_nr')}"
        income = (
            _first_number(doc, _RENT_FIELDS)
            or rent_by_unit_id.get(unit_id)
            or rent_by_house_unit.get(house_unit_key)
        )
        house["units"].append(
            {
                "id": unit_id,
                "name": _unit_name(doc),
                "meta": _unit_meta(doc),
                "location": doc.get("lage"),
                "kind": doc.get("typ"),
                "area": area,
                "rooms": _to_number(doc.get("zimmer")),
                "income": income,
            }
        )

    house_images = ["/haus1.png", "/haus2.png", "/haus3.png", "/haus4.png"]
    houses = []
    for index, house_id in enumerate(sorted(house_map)):
        house = house_map[house_id]
        address = _presentation_address(house_id)
        total_area = round(house["total_area"])
        meta_parts = [
            _number_label(len(house["units"]), "Einheit", "Einheiten"),
            f"{total_area} qm" if total_area > 0 else "",
        ]
        houses.append(
            {
                "id": house_id,
                "name": f"Haus {_house_number(house_id)}",
                "meta": " · ".join(part for part in meta_parts if part),
                "image": house_images[index % len(house_images)],
                "address": address,
                "mapsUrl": _maps_url(address),
                "unitCount": len(house["units"]),
                "totalArea": total_area,
                "units": house["units"],
            }
        )

    total_area = sum(house["totalArea"] for house in houses)
    meta_parts = [
        _number_label(len(houses), "Gebäude", "Gebäude"),
        _number_label(len(unit_docs), "Einheit", "Einheiten"),
        f"{total_area} qm" if total_area > 0 else "",
    ]

    return {
        "properties": [
            {
                "id": "portfolio",
                "name": "Gesamtbestand",
                "meta": " · ".join(part for part in meta_parts if part),
                "image": "/condominium.webp",
                "houses": houses,
            }
        ]
    }


@app.post("/ask")
def ask(req: AskRequest):
    result = openui_agent.invoke(
        {"messages": [HumanMessage(content=req.question)]},
        config=RunnableConfig(callbacks=[_callback], configurable={"thread_id": req.conversation_id}),
    )

    tool_calls = []
    for msg in result["messages"]:
        if isinstance(msg, AIMessage):
            for tc in msg.tool_calls or []:
                tool_calls.append(
                    {"tool": tc["name"], "input": tc["args"], "output": None}
                )
        elif isinstance(msg, ToolMessage):
            for t in reversed(tool_calls):
                if t["output"] is None:
                    t["output"] = msg.content
                    break

    response = next(
        (
            _text(m.content)
            for m in reversed(result["messages"])
            if isinstance(m, AIMessage) and _text(m.content)
        ),
        "",
    )
    return {"type": "openui", "response": response, "tool_calls": tool_calls}


@app.post("/ask/stream")
async def ask_stream(req: AskRequest):
    async def generate():
        try:
            async for event in openui_agent.astream_events(
                {"messages": [HumanMessage(content=req.question)]},
                version="v2",
                config=RunnableConfig(configurable={"thread_id": req.conversation_id}),
            ):
                kind = event["event"]
                if kind == "on_tool_start":
                    yield f"data: {json.dumps({'type': 'tool_start', 'name': event['name']})}\n\n"
                elif kind == "on_tool_end":
                    yield f"data: {json.dumps({'type': 'tool_end', 'name': event['name']})}\n\n"
                elif kind == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if not chunk:
                        continue
                    content = chunk.content
                    text = ""
                    if isinstance(content, str):
                        text = content
                    elif isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text += block.get("text", "")
                    if text:
                        yield f"data: {json.dumps({'type': 'token', 'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/ingest/file", status_code=202)
async def ingest_file_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_path: str = Form(default=""),
):
    file_bytes = await file.read()
    background_tasks.add_task(ingest, file_bytes, file.filename or "upload", source_path)
    return {"status": "accepted"}


@app.post("/ingest/stammdaten", status_code=202)
def ingest_stammdaten(background_tasks: BackgroundTasks):
    stammdaten_prefix = _raw_key("stammdaten/")
    if not minio_prefix_exists(_RAW_DATA, stammdaten_prefix):
        raise HTTPException(
            404, f"stammdaten dir not found: s3://{_RAW_DATA}/{stammdaten_prefix}"
        )
    files = sorted(
        f
        for f in list_minio_object_keys(_RAW_DATA, stammdaten_prefix)
        if Path(f).suffix == ".csv"
    )
    background_tasks.add_task(_ingest_dir, files)
    return {"status": "accepted", "file_count": len(files)}


@app.post("/ingest/day/{day}", status_code=202)
def ingest_day(day: str, background_tasks: BackgroundTasks):
    day_prefix = _raw_key(f"incremental/{day}/")
    if not minio_prefix_exists(_RAW_DATA, day_prefix):
        raise HTTPException(404, f"day dir not found: s3://{_RAW_DATA}/{day_prefix}")
    files = sorted(list_minio_object_keys(_RAW_DATA, day_prefix))
    background_tasks.add_task(_ingest_dir, files)
    return {"status": "accepted", "day": day, "file_count": len(files)}


def _resolve_path(path: str) -> tuple[str, str]:
    if path.startswith("s3://"):
        without_scheme = path[5:]
        bucket, _, key = without_scheme.partition("/")
        return bucket, key
    return _RAW_DATA, path


@app.get("/files/{path:path}")
def download_file(path: str, preview: Annotated[bool, Query()] = False):
    bucket, key = _resolve_path(path)
    file_bytes, _ = read_minio_object(bucket, key)
    filename = Path(key).name
    content_type, _ = mimetypes.guess_type(filename)
    disposition = "inline" if preview else "attachment"
    return Response(
        content=file_bytes,
        media_type=content_type or "application/octet-stream",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@app.get("/eml/parse")
def parse_eml(path: Annotated[str, Query()]):
    from ingest_file import _collect_email_parts

    bucket, key = _resolve_path(path)
    file_bytes, _ = read_minio_object(bucket, key)
    msg = message_from_bytes(file_bytes)
    body_lines, html_fallback, attachments = _collect_email_parts(msg, raw_html=True)

    body = "\n".join(body_lines) if body_lines else (html_fallback or "")
    is_html = not body_lines and html_fallback is not None

    return {
        "from": str(msg["from"] or ""),
        "to": str(msg["to"] or ""),
        "cc": str(msg["cc"] or ""),
        "subject": str(msg["subject"] or ""),
        "date": str(msg["date"] or ""),
        "body": body,
        "isHtml": is_html,
        "attachments": [
            {"index": i, "filename": name, "size": len(data)}
            for i, (name, data) in enumerate(attachments)
        ],
    }


@app.get("/eml/attachment")
def get_eml_attachment(path: Annotated[str, Query()], index: Annotated[int, Query()]):
    from ingest_file import _collect_email_parts

    bucket, key = _resolve_path(path)
    file_bytes, _ = read_minio_object(bucket, key)
    msg = message_from_bytes(file_bytes)
    _, _, attachments = _collect_email_parts(msg)
    if index < 0 or index >= len(attachments):
        raise HTTPException(404, "Attachment not found")
    name, data = attachments[index]
    content_type, _ = mimetypes.guess_type(name)
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )

@app.websocket("/voice")
async def voice_endpoint(ws: WebSocket):
    await handle_voice_call(ws)