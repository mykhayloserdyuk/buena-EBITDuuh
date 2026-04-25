import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).parent / ".env")

_db = MongoClient(os.environ["MONGO_URI"])["buena"]


def ensure_indexes():
    _db["entities"].create_index("email")
    _db["entities"].create_index("iban")
    _db["entities"].create_index("firma")
    _db["entities"].create_index("type")
    _db["interactions"].create_index("entity_ids")
    _db["interactions"].create_index("type")
    _db["interactions"].create_index("date")
    _db["interactions"].create_index("done")
