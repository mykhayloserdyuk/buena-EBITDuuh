import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

load_dotenv(Path(__file__).parent / ".env")

_PROVIDER = os.environ["MODEL_PROVIDER"].upper()

if _PROVIDER == "GEMINI":
    from langchain_google_genai import ChatGoogleGenerativeAI

    _llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=1.0)
elif _PROVIDER == "PRIVATE":
    from gen_ai_hub.proxy.langchain.init_models import init_llm

    _llm = init_llm("gpt-5", temperature=0, max_tokens=32000)
else:
    raise ValueError(f"Unknown MODEL_PROVIDER: {_PROVIDER}")

_db = MongoClient("mongodb://localhost:27017")["buena"]

_SCHEMA = {
    "entity_types": list(_db["entity_types"].find()),
    "interaction_types": list(_db["interaction_types"].find()),
}


@tool
def query(command_json: str) -> str:
    """Execute a raw MongoDB command using the official MongoDB Query Language.
    command_json: a MongoDB command document as JSON, passed directly to db.command().

    Examples:
      {"find": "entities", "filter": {"type": "mieter"}, "limit": 10}
      {"find": "entities", "filter": {}, "projection": {"vorname": 1, "nachname": 1}, "sort": {"nachname": 1}}
      {"count": "entities", "query": {"type": "mieter"}}
      {"aggregate": "interactions", "pipeline": [{"$match": {"done": false}}, {"$group": {"_id": "$type", "n": {"$sum": 1}}}], "cursor": {}}
    """
    try:
        return json.dumps(_db.command(json.loads(command_json)), default=str)
    except Exception as e:
        return f"QueryError: {e}"


_SYSTEM = f"""You are a helpful assistant for Buena, a property management company.
You query their MongoDB database by writing raw MongoDB commands via the query tool.
If a query returns a QueryError, fix and retry.

Database schema:
{json.dumps(_SCHEMA, indent=2, default=str)}

Entity IDs: dienstleister=DL-*, eigentuemer=EIG-*, einheit=EIN-*, mieter=MIE-*
Interaction fields: _id, type, date (ISO string), description, original, done (bool), entity_ids.
After every tool call, always write a clear text answer summarizing the results for the user.
Answer in the same language the user writes in."""

agent = create_react_agent(
    model=_llm,
    tools=[query],
    prompt=_SYSTEM,
)
