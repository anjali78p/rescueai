"""Pluggable storage. MemoryStore (optionally persisted to a JSON file) works with zero setup;
FirestoreStore is enabled with STORE=firestore."""
import copy
import json
import os
import threading
from typing import Callable, Optional


class MemoryStore:
    def __init__(self, path: Optional[str] = None) -> None:
        self._d: dict[str, dict[str, dict]] = {}
        self._lock = threading.RLock()
        self._path = path
        if path and os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    self._d = json.load(f)
            except (OSError, ValueError):
                self._d = {}

    def _flush(self) -> None:
        if not self._path:
            return
        os.makedirs(os.path.dirname(os.path.abspath(self._path)), exist_ok=True)
        tmp = self._path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._d, f)
        os.replace(tmp, self._path)

    def get(self, coll: str, id_: str) -> Optional[dict]:
        with self._lock:
            return copy.deepcopy(self._d.get(coll, {}).get(id_))

    def put(self, coll: str, id_: str, doc: dict) -> None:
        with self._lock:
            self._d.setdefault(coll, {})[id_] = copy.deepcopy(doc)
            self._flush()

    def list(self, coll: str) -> list[dict]:
        with self._lock:
            return [copy.deepcopy(v) for v in self._d.get(coll, {}).values()]

    def update(self, coll: str, id_: str, fn: Callable[[dict], dict]) -> dict:
        """Atomic read-modify-write. fn may raise to abort."""
        with self._lock:
            cur = self._d.get(coll, {}).get(id_)
            if cur is None:
                raise KeyError(id_)
            new = fn(copy.deepcopy(cur))
            self._d[coll][id_] = copy.deepcopy(new)
            self._flush()
            return copy.deepcopy(new)


class FirestoreStore:
    def __init__(self, credentials_path: Optional[str]) -> None:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(credentials_path) if credentials_path else credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
        self._fs = firestore.client()
        self._firestore = firestore

    def get(self, coll: str, id_: str) -> Optional[dict]:
        snap = self._fs.collection(coll).document(id_).get()
        return snap.to_dict() if snap.exists else None

    def put(self, coll: str, id_: str, doc: dict) -> None:
        self._fs.collection(coll).document(id_).set(doc)

    def list(self, coll: str) -> list[dict]:
        return [d.to_dict() for d in self._fs.collection(coll).stream()]

    def update(self, coll: str, id_: str, fn: Callable[[dict], dict]) -> dict:
        ref = self._fs.collection(coll).document(id_)
        fs = self._firestore

        @fs.transactional
        def txn(t):
            snap = ref.get(transaction=t)
            if not snap.exists:
                raise KeyError(id_)
            new = fn(snap.to_dict())
            t.set(ref, new)
            return new

        return txn(self._fs.transaction())


def make_store(settings):
    if settings.store == "firestore":
        return FirestoreStore(settings.firebase_credentials)
    if settings.store == "memory":
        return MemoryStore()
    return MemoryStore(settings.data_file)
