import os

import env  # loads .env and .env.infra
from pymongo import MongoClient

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
