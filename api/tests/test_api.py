from conftest import login

SOS = {"id": "sos-test-0001", "severity": "high",
       "message": "Two people trapped on the second floor, one has severe breathing difficulty",
       "location": {"lat": 26.14, "lng": 91.73, "accuracy": 30}}


def test_register_and_login(client):
    r = client.post("/auth/register", json={"name": "Meera", "email": "meera@x.in", "password": "longenough1"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "citizen"
    assert client.post("/auth/register", json={"name": "M", "email": "meera@x.in", "password": "longenough1"}).status_code == 409
    assert client.post("/auth/login", json={"email": "meera@x.in", "password": "bad"}).status_code == 401


def test_cannot_self_register_as_staff(client):
    r = client.post("/auth/register", json={"name": "H", "email": "h@x.in", "password": "longenough1", "role": "eoc"})
    assert r.json()["user"]["role"] == "citizen"


def test_sos_sync_is_idempotent(client, citizen):
    a = client.post("/sos/sync", json={"items": [SOS]}, headers=citizen).json()["results"][0]
    b = client.post("/sos/sync", json={"items": [SOS]}, headers=citizen).json()["results"][0]
    assert a["result"] == "created" and b["result"] == "duplicate"
    assert a["priority"] == "critical"


def test_rbac(client, citizen, rescue, eoc):
    client.post("/sos", json=SOS, headers=citizen)
    assert client.get("/incidents", headers=citizen).status_code == 403
    assert client.get("/incidents").status_code == 401
    assert len(client.get("/incidents", headers=rescue).json()) == 1
    assert client.get("/audit", headers=rescue).status_code == 403
    assert client.post("/broadcasts", json={"title": "t", "message": "m"}, headers=rescue).status_code == 403
    assert client.get("/audit", headers=eoc).status_code == 200


def test_citizen_cannot_hijack_others_incident_id(client, citizen):
    client.post("/sos", json=SOS, headers=citizen)
    other = client.post("/auth/register", json={"name": "O", "email": "o@x.in", "password": "longenough1"}).json()["token"]
    r = client.post("/sos/sync", json={"items": [SOS]}, headers={"Authorization": f"Bearer {other}"})
    assert r.json()["results"][0]["result"] == "error"


def test_validation_rejects_bad_coordinates(client, citizen):
    bad = {**SOS, "id": "sos-test-0002", "location": {"lat": 200, "lng": 0}}
    assert client.post("/sos", json=bad, headers=citizen).status_code == 422


def test_workflow_and_squad_rules(client, citizen, rescue):
    client.post("/sos", json=SOS, headers=citizen)
    client.post("/sos", json={**SOS, "id": "sos-test-0002"}, headers=citizen)
    url = "/incidents/sos-test-0001/status"
    assert client.post(url, json={"status": "accepted"}, headers=rescue).status_code == 422  # needs squad
    assert client.post(url, json={"status": "reached"}, headers=rescue).status_code == 409   # skipping steps
    assert client.post(url, json={"status": "accepted", "squad_id": "ndrf-alpha"}, headers=rescue).status_code == 200
    busy = client.post("/incidents/sos-test-0002/status", json={"status": "accepted", "squad_id": "ndrf-alpha"}, headers=rescue)
    assert busy.status_code == 409
    for s in ("en_route", "reached", "resolved"):
        assert client.post(url, json={"status": s}, headers=rescue).json()["status"] == s
    # squad is free again after resolve
    ok = client.post("/incidents/sos-test-0002/status", json={"status": "accepted", "squad_id": "ndrf-alpha"}, headers=rescue)
    assert ok.status_code == 200
    assert client.get("/sos/mine", headers=citizen).json()[0]["status"] in ("resolved", "accepted")


def test_broadcast_and_audit(client, citizen, eoc):
    client.post("/broadcasts", json={"title": "Evacuate", "message": "Move to higher ground", "level": "critical"}, headers=eoc)
    assert client.get("/broadcasts", headers=citizen).json()[0]["title"] == "Evacuate"
    actions = [e["action"] for e in client.get("/audit", headers=eoc).json()]
    assert "broadcast.sent" in actions


def test_priority_sorting(client, citizen, rescue):
    client.post("/sos", json={"id": "sos-low-00001", "severity": "low", "message": "safe, need info"}, headers=citizen)
    client.post("/sos", json=SOS, headers=citizen)
    ids = [i["id"] for i in client.get("/incidents", headers=rescue).json()]
    assert ids[0] == "sos-test-0001"
