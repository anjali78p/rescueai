import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from . import auth
from .auth import get_user, require
from .config import settings
from .models import (ACTIVE_STATUSES, PRIORITY_RANK, TRANSITIONS, BroadcastIn, LoginIn, RegisterIn, SosIn,
                     StatusIn, SyncIn, TriagePreviewIn)
from .seed import DEMO_MESSAGES
from .state import get_store, hub
from .triage import final_priority, run_triage

router = APIRouter()
STAFF = ("rescue", "eoc")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def audit(actor: dict, action: str, target: Optional[str] = None, detail: Optional[dict] = None) -> None:
    e = {"id": uuid.uuid4().hex, "ts": now(), "actor_id": actor["id"], "actor_name": actor["name"],
         "role": actor["role"], "action": action, "target": target, "detail": detail or {}}
    get_store().put("audit", e["id"], e)


def sort_key(i: dict):
    # highest priority first, then longest waiting first
    return (-PRIORITY_RANK[i["priority"]], i["received_at"])


# ---------------------------------------------------------------- health / auth
@router.get("/health")
async def health():
    return {"ok": True, "time": now(), "ai": "gemini" if settings.gemini_api_key else "rules", "demo": settings.demo_mode}


@router.post("/auth/register")
async def register(body: RegisterIn):
    if get_store().get("users", body.email.strip().lower()):
        raise HTTPException(409, "An account with this email already exists.")
    u = auth.create_user(body.name.strip(), body.email, body.password, "citizen", phone=body.phone,
                         emergency_contact=body.emergency_contact, medical_notes=body.medical_notes)
    return {"token": auth.make_token(u), "user": auth.public_user(u)}


@router.post("/auth/login")
async def login(body: LoginIn):
    u = get_store().get("users", body.email.strip().lower())
    if not u or not auth.verify_password(body.password, u["password"]):
        raise HTTPException(401, "Wrong email or password.")
    return {"token": auth.make_token(u), "user": auth.public_user(u)}


@router.get("/auth/me")
async def me(user: dict = Depends(get_user)):
    return auth.public_user(user)


# ---------------------------------------------------------------- SOS (citizen)
async def ingest(user: dict, p: SosIn) -> tuple[dict, bool]:
    store = get_store()
    existing = store.get("incidents", p.id)
    if existing:
        if existing["citizen_id"] != user["id"]:
            raise HTTPException(409, "Incident id already used.")
        return existing, False

    tri = await run_triage(p.message, p.people, p.severity)
    t = tri.as_dict()
    received = now()
    profile = None
    if p.share_profile:
        profile = {"phone": user.get("phone"), "emergency_contact": user.get("emergency_contact"),
                   "medical_notes": user.get("medical_notes")}
    inc = {
        "id": p.id, "citizen_id": user["id"], "citizen_name": user["name"],
        "severity": p.severity, "message": p.message, "people": p.people or t["people_detected"],
        "incident_type": t["incident_type"], "medical_urgency": t["medical_urgency"], "trapped": t["trapped"],
        "summary": t["summary"], "triage_source": t["triage_source"], "score": t["score"],
        "ai_priority": t["ai_priority"], "reasons": t["reasons"],
        "priority": final_priority(t["ai_priority"], p.severity),
        "location": p.location.model_dump() if p.location else None,
        "location_at_sync": p.location_at_sync.model_dump() if p.location_at_sync else None,
        "created_at": p.created_at or received, "received_at": received,
        "status": "new", "squad_id": None, "squad_name": None, "profile": profile,
        "history": [{"ts": received, "status": "new", "actor": user["name"], "note": "SOS received"}],
    }
    store.put("incidents", inc["id"], inc)
    audit(user, "sos.received", inc["id"], {"priority": inc["priority"], "source": inc["triage_source"]})
    hub.publish({"type": "incident", "data": inc})
    return inc, True


@router.post("/sos", status_code=201)
async def create_sos(body: SosIn, user: dict = Depends(require("citizen"))):
    inc, created = await ingest(user, body)
    return {"created": created, "incident": inc}


@router.post("/sos/sync")
async def sync_sos(body: SyncIn, user: dict = Depends(require("citizen"))):
    results = []
    for item in body.items:
        try:
            inc, created = await ingest(user, item)
            results.append({"id": item.id, "result": "created" if created else "duplicate",
                            "status": inc["status"], "priority": inc["priority"]})
        except HTTPException as e:
            results.append({"id": item.id, "result": "error", "detail": e.detail})
    return {"results": results}


@router.get("/sos/mine")
async def my_sos(user: dict = Depends(require("citizen"))):
    mine = [i for i in get_store().list("incidents") if i["citizen_id"] == user["id"]]
    return [{"id": i["id"], "status": i["status"], "priority": i["priority"], "squad_name": i["squad_name"],
             "received_at": i["received_at"]} for i in mine]


# ---------------------------------------------------------------- incidents (staff)
@router.get("/incidents")
async def list_incidents(status: Optional[str] = None, priority: Optional[str] = None, q: Optional[str] = None,
                         user: dict = Depends(require(*STAFF))):
    items = get_store().list("incidents")
    if status:
        items = [i for i in items if i["status"] == status]
    if priority:
        items = [i for i in items if i["priority"] == priority]
    if q:
        ql = q.lower()
        items = [i for i in items if ql in i["message"].lower() or ql in i["citizen_name"].lower() or ql in i["id"].lower()]
    return sorted(items, key=sort_key)


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str, user: dict = Depends(require(*STAFF))):
    inc = get_store().get("incidents", incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found.")
    return inc


@router.get("/squads")
async def squads(user: dict = Depends(require(*STAFF))):
    store = get_store()
    busy = {i["squad_id"] for i in store.list("incidents") if i["status"] in ACTIVE_STATUSES and i["squad_id"]}
    return [{**s, "busy": s["id"] in busy} for s in store.list("squads")]


@router.post("/incidents/{incident_id}/status")
async def change_status(incident_id: str, body: StatusIn, user: dict = Depends(require(*STAFF))):
    store = get_store()
    squad = None
    if body.status == "accepted":
        if not body.squad_id:
            raise HTTPException(422, "Choose a squad to accept this incident.")
        squad = store.get("squads", body.squad_id)
        if not squad:
            raise HTTPException(404, "Squad not found.")
        if any(i["squad_id"] == squad["id"] and i["status"] in ACTIVE_STATUSES for i in store.list("incidents")):
            raise HTTPException(409, f"{squad['name']} is already on another incident.")

    def apply(inc: dict) -> dict:
        allowed = TRANSITIONS[inc["status"]]
        if body.status not in allowed:
            raise HTTPException(409, f"Cannot move from {inc['status']} to {body.status}.")
        inc["status"] = body.status
        if squad:
            inc["squad_id"], inc["squad_name"] = squad["id"], squad["name"]
        inc["history"].append({"ts": now(), "status": body.status, "actor": user["name"], "note": body.note or ""})
        return inc

    try:
        inc = store.update("incidents", incident_id, apply)
    except KeyError:
        raise HTTPException(404, "Incident not found.")
    audit(user, f"incident.{body.status}", incident_id, {"squad": inc["squad_name"]})
    hub.publish({"type": "incident", "data": inc})
    return inc


@router.get("/stats")
async def stats(user: dict = Depends(require(*STAFF))):
    items = get_store().list("incidents")
    by_status = {s: 0 for s in TRANSITIONS}
    by_priority = {p: 0 for p in PRIORITY_RANK}
    waits = []
    for i in items:
        by_status[i["status"]] += 1
        by_priority[i["priority"]] += 1
        acc = next((h for h in i["history"] if h["status"] == "accepted"), None)
        if acc:
            dt = datetime.fromisoformat(acc["ts"]) - datetime.fromisoformat(i["received_at"])
            waits.append(dt.total_seconds() / 60)
    return {"total": len(items), "by_status": by_status, "by_priority": by_priority,
            "avg_minutes_to_accept": round(sum(waits) / len(waits), 1) if waits else None}


@router.post("/triage/preview")
async def triage_preview(body: TriagePreviewIn, user: dict = Depends(require(*STAFF))):
    return (await run_triage(body.message, body.people, body.severity)).as_dict()


# ---------------------------------------------------------------- broadcast / audit (EOC)
@router.post("/broadcasts", status_code=201)
async def create_broadcast(body: BroadcastIn, user: dict = Depends(require("eoc"))):
    b = {"id": uuid.uuid4().hex, "ts": now(), "author": user["name"], **body.model_dump()}
    get_store().put("broadcasts", b["id"], b)
    audit(user, "broadcast.sent", b["id"], {"level": b["level"], "title": b["title"]})
    hub.publish({"type": "broadcast", "data": b})
    return b


@router.get("/broadcasts")
async def list_broadcasts(user: dict = Depends(get_user)):
    return sorted(get_store().list("broadcasts"), key=lambda b: b["ts"], reverse=True)[:20]


@router.get("/audit")
async def list_audit(user: dict = Depends(require("eoc"))):
    return sorted(get_store().list("audit"), key=lambda e: e["ts"], reverse=True)[:200]


# ---------------------------------------------------------------- live stream (SSE)
@router.get("/stream")
async def stream(token: str = Query(...)):
    user = auth.user_from_token(token)  # EventSource cannot send headers, so the token rides in the query
    if user["role"] not in STAFF:
        raise HTTPException(403, "Your role cannot do this.")
    q = hub.subscribe()

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"event: {ev['type']}\ndata: {json.dumps(ev['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            hub.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------- demo seeding
@router.post("/dev/seed")
async def seed(user: dict = Depends(require("eoc"))):
    if not settings.demo_mode:
        raise HTTPException(403, "Demo mode is off.")
    citizen = get_store().get("users", "citizen@demo.in")
    if not citizen:
        raise HTTPException(404, "Demo citizen missing.")
    made = 0
    for sev, msg, lat, lng in DEMO_MESSAGES:
        _, created = await ingest(citizen, SosIn(id="demo-" + uuid.uuid4().hex[:12], severity=sev, message=msg,
                                                 location={"lat": lat, "lng": lng, "accuracy": 25}))
        made += int(created)
    return {"created": made}
