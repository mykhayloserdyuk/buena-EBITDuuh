import json
import logging
from pathlib import Path

from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from llm import make_llm
from db import _db

logger = logging.getLogger(__name__)


# Wie viele Mieteinnahmen werde ich nächstes Jahr machen mit meinem Haus? => Chart mit monatlichen Einnahmen
# Zeige mir den Emailverlauf zwischen Vermieter A und Mieter X => Markdown like mit Emails
# Welche offenen Items habe ich für Haus, Wohnung etc.? => To do liste mit offenen Items, z.B. "Rechnung von Handwerker Y bezahlen", "Mieter Z wegen Lärm beschweren", etc.
@tool
def query(command_json: str) -> str:
    """Read data from MongoDB. Use for find, aggregate, count, distinct.

    Examples:
      {"find": "entities", "filter": {"type": "mieter"}, "limit": 10}
      {"find": "interactions", "filter": {"done": false}, "sort": {"date": -1}, "limit": 20}
      {"aggregate": "interactions", "pipeline": [{"$match": {"type": "rechnung"}}, {"$lookup": {"from": "entities", "localField": "entity_ids", "foreignField": "_id", "as": "entities"}}], "cursor": {}}
      {"count": "entities", "query": {"type": "eigentuemer"}}
      {"distinct": "entities", "key": "type", "query": {}}
    """
    try:
        result = _db.command(json.loads(command_json))
        logger.debug("query result: %s", str(result)[:200])
        return json.dumps(result, default=str, ensure_ascii=False)
    except Exception as e:
        logger.warning("query error: %s", e)
        return f"QueryError: {e}"


@tool
def mutate(command_json: str) -> str:
    """Write to MongoDB. Use for insert, update, delete operations.

    Insert a new entity:
      {"insert": "entities", "documents": [{"_id": "DL-017", "type": "dienstleister", "firma": "Neue GmbH", "email": "info@neue.de"}]}

    Upsert / patch an existing entity:
      {"update": "entities", "updates": [{"q": {"_id": "DL-001"}, "u": {"$set": {"email": "new@email.de"}}, "upsert": false}]}

    Register a new entity_type:
      {"insert": "entity_types", "documents": [{"_id": "versorger", "attributes": ["firma", "email", "telefon"]}]}

    Extend an entity_type with new attributes:
      {"update": "entity_types", "updates": [{"q": {"_id": "dienstleister"}, "u": {"$addToSet": {"attributes": {"$each": ["rating", "notizen"]}}}}]}

    Register a new interaction_type:
      {"insert": "interaction_types", "documents": [{"_id": "kuendigung"}]}

    Create a new interaction:
      {"insert": "interactions", "documents": [{"_id": "KUND-00001", "type": "kuendigung", "date": "2026-04-25", "description": "...", "original": "", "done": false, "entity_ids": ["MIE-003"]}]}

    Mark interaction as done:
      {"update": "interactions", "updates": [{"q": {"_id": "EMAIL-06547"}, "u": {"$set": {"done": true}}}]}

    Delete a document:
      {"delete": "interactions", "deletes": [{"q": {"_id": "EMAIL-99999"}, "limit": 1}]}
    """
    try:
        result = _db.command(json.loads(command_json))
        logger.info("mutate result: %s", str(result)[:200])
        return json.dumps(result, default=str, ensure_ascii=False)
    except Exception as e:
        logger.warning("mutate error: %s", e)
        return f"MutateError: {e}"


_SYSTEM = """You are a helpful assistant for Buena, a property management company.
You have full read/write access to their MongoDB database via the `query` and `mutate` tools.

## Data model
- entity_types: {{_id: type_name, attributes: [...]}} — schema registry
- interaction_types: {{_id: type_name}} — event type registry
- entities: {{_id, type, ...dynamic top-level attributes}} — people, companies, properties
- interactions: {{_id, type, date (ISO), description, original, done (bool), entity_ids: [...]}}

## Current schema
{schema}

## Rules
- Use `query` for reads, `mutate` for writes — never mix them up
- Before creating a new entity_type or interaction_type, check if an existing one fits
- When upserting an entity with new attribute keys, also $addToSet those keys into the entity_type's attributes list
- For new entities, derive the next ID from the highest existing ID of that type
- Answer in the same language the user writes in
- After every tool call, write a clear summary of what was found or changed"""


def _inject_schema(state: dict) -> list:
    schema = json.dumps(
        {
            "entity_types": list(_db["entity_types"].find()),
            "interaction_types": [d["_id"] for d in _db["interaction_types"].find()],
        },
        default=str,
        ensure_ascii=False,
        indent=2,
    )
    return [SystemMessage(content=_SYSTEM.format(schema=schema))] + state["messages"]


_memory = MemorySaver()

agent = create_react_agent(
    model=make_llm(),
    tools=[query, mutate],
    prompt=_inject_schema,
    checkpointer=_memory,
)

_OPENUI_PROMPT_PATH = Path(__file__).parent / "openui_prompt.txt"


def _inject_schema_openui(state: dict) -> list:
    schema = json.dumps(
        {
            "entity_types": list(_db["entity_types"].find()),
            "interaction_types": [d["_id"] for d in _db["interaction_types"].find()],
        },
        default=str,
        ensure_ascii=False,
        indent=2,
    )
    system = _SYSTEM.format(schema=schema) + "\n\n" + _OPENUI_PROMPT_PATH.read_text()
    return [SystemMessage(content=system)] + state["messages"]


_openui_memory = MemorySaver()

openui_agent = create_react_agent(
    model=make_llm(),
    tools=[query, mutate],
    prompt=_inject_schema_openui,
    checkpointer=_openui_memory,
)
