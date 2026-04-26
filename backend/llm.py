import os

import env  # loads .env and .env.infra

_PROVIDER = os.environ["MODEL_PROVIDER"].upper()


def make_llm():
    if _PROVIDER == "GEMINI":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    elif _PROVIDER == "PRIVATE":
        from gen_ai_hub.proxy.langchain.init_models import init_llm
        return init_llm("gpt-5", temperature=0, max_tokens=32000)
    else:
        raise ValueError(f"Unknown MODEL_PROVIDER: {_PROVIDER}")
