"""
backend/app/db.py
Async-friendly wrapper around libsql (Turso-compatible SQLite).
"""

import os
import json
from typing import Optional

import libsql
from starlette.concurrency import run_in_threadpool

TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL", "file:storage/papercomic.db")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")

_conn: Optional["libsql.Connection"] = None


def _get_conn():
    global _conn
    if _conn is None:
        if TURSO_AUTH_TOKEN:
            _conn = libsql.connect(database=TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)
        else:
            _conn = libsql.connect(database=TURSO_DATABASE_URL)
        _init_schema(_conn)
    return _conn


def _init_schema(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS users (_id TEXT PRIMARY KEY, data TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS comics (_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT, data TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS contact (_id TEXT PRIMARY KEY, data TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS webhook_logs (_id TEXT PRIMARY KEY, event_id TEXT UNIQUE, data TEXT NOT NULL)")
    conn.commit()


def _sync_find_one(table, query):
    conn = _get_conn()
    if "_id" in query and len(query) == 1:
        cur = conn.execute(f"SELECT data FROM {table} WHERE _id = ?", (query["_id"],))
        row = cur.fetchone()
        return json.loads(row[0]) if row else None
    cur = conn.execute(f"SELECT data FROM {table}")
    for (raw,) in cur.fetchall():
        doc = json.loads(raw)
        if all(doc.get(k) == v for k, v in query.items()):
            return doc
    return None


def _sync_insert_one(table, extra_cols, doc):
    conn = _get_conn()
    cols = ["_id", "data"]
    vals = [doc["_id"], json.dumps(doc)]
    if "user_id" in extra_cols:
        cols.insert(1, "user_id")
        vals.insert(1, doc.get("user_id"))
    if "created_at" in extra_cols:
        cols.insert(-1, "created_at")
        vals.insert(-1, doc.get("created_at"))
    placeholders = ", ".join("?" for _ in vals)
    conn.execute(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})", vals)
    conn.commit()
    return doc


def _sync_update_one(table, query, update):
    existing = _sync_find_one(table, query)
    if not existing:
        return None
    if "$set" in update:
        existing.update(update["$set"])
    conn = _get_conn()
    conn.execute(f"UPDATE {table} SET data = ? WHERE _id = ?", (json.dumps(existing), existing["_id"]))
    conn.commit()
    return existing


def _sync_delete_one(table, query):
    existing = _sync_find_one(table, query)
    if not existing:
        return 0
    conn = _get_conn()
    conn.execute(f"DELETE FROM {table} WHERE _id = ?", (existing["_id"],))
    conn.commit()
    return 1


def _sync_find_all(table, query, sort_field, sort_dir):
    conn = _get_conn()
    cur = conn.execute(f"SELECT data FROM {table}")
    docs = [json.loads(r[0]) for r in cur.fetchall()]
    docs = [d for d in docs if all(d.get(k) == v for k, v in query.items())]
    if sort_field:
        docs.sort(key=lambda d: d.get(sort_field, ""), reverse=sort_dir < 0)
    return docs


class Collection:
    def __init__(self, table, extra_cols=()):
        self.table = table
        self.extra_cols = extra_cols

    async def find_one(self, query):
        return await run_in_threadpool(_sync_find_one, self.table, query)

    async def insert_one(self, doc):
        return await run_in_threadpool(_sync_insert_one, self.table, self.extra_cols, doc)

    async def update_one(self, query, update):
        return await run_in_threadpool(_sync_update_one, self.table, query, update)

    async def delete_one(self, query):
        count = await run_in_threadpool(_sync_delete_one, self.table, query)
        return type("Result", (), {"deleted_count": count})()

    def find(self, query):
        return _FindCursor(self.table, query)


class _FindCursor:
    def __init__(self, table, query):
        self.table = table
        self.query = query
        self._sort_field = None
        self._sort_dir = 1
        self._rows = None
        self._idx = 0

    def sort(self, field, direction=1):
        self._sort_field = field
        self._sort_dir = direction
        return self

    def __aiter__(self):
        self._rows = None
        self._idx = 0
        return self

    async def __anext__(self):
        if self._rows is None:
            self._rows = await run_in_threadpool(
                _sync_find_all, self.table, self.query, self._sort_field, self._sort_dir
            )
        if self._idx >= len(self._rows):
            raise StopAsyncIteration
        doc = self._rows[self._idx]
        self._idx += 1
        return doc

users_col = Collection("users")
comics_col = Collection("comics", extra_cols=("user_id", "created_at"))
contact_col = Collection("contact")
webhook_logs_col = Collection("webhook_logs")  # Add this line