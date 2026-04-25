import json
import textwrap
from langchain_core.callbacks import BaseCallbackHandler

RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
CYAN   = "\033[36m"
YELLOW = "\033[33m"
GREEN  = "\033[32m"
MAGENTA= "\033[35m"
RED    = "\033[31m"
BLUE   = "\033[34m"

_W = 80


def _hr(color: str, label: str = "") -> str:
    pad = f" {label} " if label else ""
    line = "─" * ((_W - len(pad)) // 2)
    return f"{color}{BOLD}{line}{pad}{line}{RESET}"


def _truncate(text: str, limit: int = 600) -> str:
    text = str(text)
    if len(text) <= limit:
        return text
    return text[:limit] + f"  {DIM}… ({len(text) - limit} more chars){RESET}"


def _fmt_json(raw: str) -> str:
    try:
        return json.dumps(json.loads(raw), indent=2, ensure_ascii=False)
    except Exception:
        return raw


class ColorLogger(BaseCallbackHandler):

    def on_chat_model_start(self, serialized, messages, **kwargs):
        print(_hr(CYAN, "LLM INPUT"))
        for batch in messages:
            for msg in batch:
                role = getattr(msg, "type", type(msg).__name__)
                content = msg.content if isinstance(msg.content, str) else json.dumps(msg.content, ensure_ascii=False)
                if role in ("system", "SystemMessage"):
                    print(f"{DIM}{CYAN}[system]{RESET} {DIM}{_truncate(content, 300)}{RESET}")
                else:
                    label = f"{CYAN}{BOLD}[{role}]{RESET}"
                    print(f"{label} {_truncate(content, 800)}")
        print()

    def on_tool_start(self, serialized, input_str, **kwargs):
        name = serialized.get("name", "?")
        print(_hr(YELLOW, f"TOOL → {name}"))
        formatted = _fmt_json(input_str)
        for line in textwrap.indent(formatted, "  ").splitlines():
            print(f"{YELLOW}{line}{RESET}")
        print()

    def on_tool_end(self, output, **kwargs):
        print(_hr(GREEN, "TOOL RESULT"))
        formatted = _fmt_json(str(output))
        for line in textwrap.indent(_truncate(formatted, 1000), "  ").splitlines():
            print(f"{GREEN}{line}{RESET}")
        print()

    def on_tool_error(self, error, **kwargs):
        print(_hr(RED, "TOOL ERROR"))
        print(f"  {RED}{error}{RESET}\n")

    def on_llm_end(self, response, **kwargs):
        for gen_list in response.generations:
            for gen in gen_list:
                msg = getattr(gen, "message", None)
                if msg is None:
                    continue
                tool_calls = getattr(msg, "tool_calls", []) or []
                if tool_calls:
                    print(_hr(MAGENTA, "AI → TOOL CALLS"))
                    for tc in tool_calls:
                        args = json.dumps(tc.get("args", {}), ensure_ascii=False)
                        print(f"  {MAGENTA}{BOLD}{tc['name']}{RESET}{MAGENTA}({_truncate(args, 400)}){RESET}")
                    print()
                else:
                    text = getattr(msg, "content", "")
                    if text:
                        print(_hr(BLUE, "AI RESPONSE"))
                        for line in textwrap.wrap(str(text), width=_W - 2):
                            print(f"  {BLUE}{line}{RESET}")
                        print()

    def on_llm_error(self, error, **kwargs):
        print(_hr(RED, "LLM ERROR"))
        print(f"  {RED}{error}{RESET}\n")


_callback = ColorLogger()
