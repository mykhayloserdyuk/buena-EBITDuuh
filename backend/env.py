"""
Load environment variables from two sources:
  1. .env.infra   — infra-level secrets (MONGO_URI, MINIO_*, …)
  2. .env          — app-level secrets (GEMINI_API_KEY, MODEL_PROVIDER, …)
                     also used to override infra values for local dev
                     (e.g. point MONGO_URI at the local compose service)

App-level values override infra values so local dev can shadow cloud URIs.
Both files are optional — in production secrets are injected as env vars
by the platform and no files are needed.
"""
from pathlib import Path

from dotenv import load_dotenv

_here = Path(__file__).parent

load_dotenv(_here / ".env.infra")        # infra baseline (cloud URIs, etc.)
load_dotenv(_here / ".env", override=True)  # app / local-dev overrides win
