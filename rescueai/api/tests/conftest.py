import os
import sys

os.environ["GEMINI_API_KEY"] = ""
os.environ["STORE"] = "memory"
os.environ["DEMO_MODE"] = "true"
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from app import state
from app.main import app
from app.seed import seed_defaults, seed_demo_users
from app.store import MemoryStore


@pytest.fixture()
def client():
    s = MemoryStore()
    state.set_store(s)
    seed_defaults(s)
    seed_demo_users(s)
    return TestClient(app)


def login(client, email, password="rescue123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def citizen(client):
    return login(client, "citizen@demo.in")


@pytest.fixture()
def rescue(client):
    return login(client, "rescue@demo.in")


@pytest.fixture()
def eoc(client):
    return login(client, "eoc@demo.in")
