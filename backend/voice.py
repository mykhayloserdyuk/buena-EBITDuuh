"""Voice call agent — Gradium STT/TTS + LangGraph agent over WebSocket.

Protocol (browser ↔ FastAPI WebSocket):
  Client → server:
    binary frames      → raw PCM audio (16-bit signed, 24 kHz, mono)
    {"type":"end_turn"} → user finished speaking, trigger STT + agent

  Server → client:
    {"type":"transcript","text":"..."}  → STT result
    {"type":"agent_text","text":"..."}  → agent response text
    binary frames                       → TTS audio (PCM 16-bit, 24 kHz, mono)
    {"type":"tts_done"}                 → TTS stream finished
    {"type":"call_complete"}            → conversation over
    {"type":"error","message":"..."}    → error
"""

import json
import logging
import os
import ssl
from datetime import date
from pathlib import Path

import aiohttp
import certifi
import gradium

# On macOS, Python ships without a system CA bundle that aiohttp can find.
# Patch every aiohttp.ClientSession to use certifi's bundle via a shared
# TCPConnector — this must happen before the first GradiumClient call.
_SSL_CTX = ssl.create_default_context(cafile=certifi.where())
_orig_session_init = aiohttp.ClientSession.__init__

def _certifi_session_init(self, *args, **kwargs):
    if kwargs.get("connector") is None:
        kwargs["connector"] = aiohttp.TCPConnector(ssl=_SSL_CTX)
    _orig_session_init(self, *args, **kwargs)

aiohttp.ClientSession.__init__ = _certifi_session_init
from dotenv import load_dotenv
from fastapi import WebSocket, WebSocketDisconnect
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent

from agent import mutate, query
from callbacks import _callback
from db import _db

load_dotenv()

logger = logging.getLogger(__name__)

_VOICE_ID = os.environ.get("GRADIUM_VOICE_ID", "YTpq7expH9539ERJ")

_SYSTEM = """\
Du bist ein freundlicher Telefonassistent für Buena, ein deutsches Hausverwaltungsunternehmen.
Du nimmst eingehende Anrufe von Mietern, Eigentümern und Dienstleistern entgegen.

Gesprächsablauf:
1. Begrüße den Anrufer und finde heraus, wer er ist (suche in der Datenbank nach Name oder Firma)
2. Frage nach seinem Anliegen und höre aufmerksam zu
3. Erstelle einen Interaktionsdatensatz vom Typ "anruf" zur Dokumentation des Gesprächs
4. Bestätige kurz, dass das Anliegen aufgenommen wurde, und verabschiede dich

Suche:
- Suche viele Informationen
- Nutze mehr als eine Query
- Durchsuche Entitäten und Interaktionen - mehrfach
Regeln:
- DU MUSST QUERIES MACHEN. ANTWORTE NIEMALS OHNE QUERY UND RÜCKFRAGE
- Halte Antworten KURZ — maximal 1–3 Sätze (das ist Sprachausgabe)
- Sprich Deutsch, außer der Anrufer wechselt die Sprache
- Nutze `query` zum Suchen von Entitäten, `mutate` zum Speichern der Interaktion
- Interaktions-ID-Format: ANRUF-XXXXX (ermittle die nächste ID aus bestehenden)
- Interaktionsfelder: type="anruf", date={today}, description=Zusammenfassung,
  original=genaue Worte des Anrufers, done=false, entity_ids=[gefundene entity _id]
- Du musst alle entity ids zur Transkaktion hinzufügen die relevant sind.
- Du musst alle entity ids herausfinden, speicher niemals ohne entity ID.
- Wenn das Gespräch abgeschlossen ist, beende deine letzte Nachricht mit: ##CALL_COMPLETE##
- Beende das Gespräch nur wenn der nutzer dies auf Nachfrage bestätig! 
- EINE NACHRICHT MUSS IMMER EINE FRAGE ODER RÜCKFRAGE ENTHALTEN, UM WEITERES ZU ERMITTELN. ANTWORTE NIEMALS MIT EINER AUSSAGE OHNE FRAGE.

Aktuelles Schema:
{schema}
"""


def _make_voice_agent():
    import json as _json

    def _inject_prompt(state: dict) -> list:
        schema = _json.dumps(
            {
                "entity_types": list(_db["entity_types"].find()),
                "interaction_types": [d["_id"] for d in _db["interaction_types"].find()],
            },
            default=str,
            ensure_ascii=False,
            indent=2,
        )
        system = _SYSTEM.format(schema=schema, today=date.today().isoformat())
        return [SystemMessage(content=system)] + state["messages"]

    from llm import make_llm
    return create_react_agent(
        model=make_llm(),
        tools=[query, mutate],
        prompt=_inject_prompt,
    )


async def _speak(client: gradium.client.GradiumClient, ws: WebSocket, text: str) -> None:
    """Stream TTS audio (24 kHz PCM) to the WebSocket client."""
    stream = await client.tts_stream(
        setup={"voice_id": _VOICE_ID, "output_format": "pcm_24000"},
        text=text,
    )
    n_bytes = 0
    async for chunk in stream.iter_bytes():
        n_bytes += len(chunk)
        await ws.send_bytes(chunk)
    logger.debug("tts: %d bytes for %r…", n_bytes, text[:40])
    await ws.send_text(json.dumps({"type": "tts_done"}))


async def _transcribe(client: gradium.client.GradiumClient, audio_buffer: list[bytes]) -> str:
    """Run buffered 24 kHz PCM audio through Gradium STT."""
    async def _gen():
        for chunk in audio_buffer:
            yield chunk

    stream = await client.stt_stream(
        {"model_name": "default", "input_format": "pcm"},
        _gen(),
    )
    parts: list[str] = []
    async for msg in stream.iter_text():
        text = msg.text if hasattr(msg, "text") else str(msg)
        if text and text.strip():
            parts.append(text.strip())
    return " ".join(parts)


def _extract_ai_text(messages: list) -> str:
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str) and content.strip():
                return content
            if isinstance(content, list):
                text = "".join(b["text"] for b in content if isinstance(b, dict) and "text" in b)
                if text.strip():
                    return text
    return "Entschuldigung, ich habe Sie nicht verstanden."


async def handle_voice_call(ws: WebSocket) -> None:
    """Handle a complete voice call session over a WebSocket."""
    await ws.accept()

    try:
        api_key = os.environ.get("GRADIUM_API_KEY", "")
        if not api_key:
            await ws.send_text(json.dumps({"type": "error", "message": "GRADIUM_API_KEY not configured"}))
            return

        gradium_client = gradium.client.GradiumClient(api_key=api_key)
        voice_agent = _make_voice_agent()
        history: list = []
        audio_buffer: list[bytes] = []

        greeting = "Guten Tag, Sie haben Buena erreicht. Mit wem spreche ich bitte?" 
        await ws.send_text(json.dumps({"type": "agent_text", "text": greeting}))
        await _speak(gradium_client, ws, greeting)

        while True:
            data = await ws.receive()

            if "bytes" in data and data["bytes"]:
                audio_buffer.append(data["bytes"])
                continue

            if "text" not in data:
                continue

            msg = json.loads(data["text"])
            if msg.get("type") != "end_turn" or not audio_buffer:
                continue

            # --- STT ---
            transcript = await _transcribe(gradium_client, audio_buffer)
            audio_buffer = []

            if not transcript:
                nudge = "Ich konnte Sie leider nicht verstehen. Könnten Sie das bitte wiederholen?"
                await ws.send_text(json.dumps({"type": "agent_text", "text": nudge}))
                await _speak(gradium_client, ws, nudge)
                continue

            await ws.send_text(json.dumps({"type": "transcript", "text": transcript}))
            history.append(HumanMessage(content=transcript))

            # --- Agent ---
            logger.info("agent ← %r", transcript[:80])
            result = await voice_agent.ainvoke(
                {"messages": history},
                config=RunnableConfig(callbacks=[_callback]),
            )
            history = result["messages"]

            response_text = _extract_ai_text(history)
            is_complete = "##CALL_COMPLETE##" in response_text
            clean_text = response_text.replace("##CALL_COMPLETE##", "").strip()

            await ws.send_text(json.dumps({"type": "agent_text", "text": clean_text}))
            await _speak(gradium_client, ws, clean_text)

            if is_complete:
                await ws.send_text(json.dumps({"type": "call_complete"}))
                break

    except WebSocketDisconnect:
        logger.info("voice call disconnected")
    except Exception as exc:
        logger.exception("voice call error: %s", exc)
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))
        except Exception:
            pass
