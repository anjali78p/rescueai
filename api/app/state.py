from .config import settings
from .hub import Hub
from .store import make_store

hub = Hub()
_store = None


def get_store():
    global _store
    if _store is None:
        _store = make_store(settings)
    return _store


def set_store(s) -> None:
    global _store
    _store = s
