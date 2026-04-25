from fastapi import FastAPI
from pydantic import BaseModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agent import agent

app = FastAPI()


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
    result = agent.invoke({"messages": [HumanMessage(content=req.question)]})

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
