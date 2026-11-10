# RescueAI

Offline-first disaster response: citizens send an SOS that is **saved on the device first and delivered when any connection returns**; AI-assisted triage ranks incidents; rescue teams run an Accept → En route → Reached → Resolve workflow; an EOC admin broadcasts alerts and reviews an audit log.

> Honest scope: this is **offline-first** (queue + sync), not offline *communication*. With zero connectivity the SOS waits on the phone. Device-to-device relay (RescueMesh) is a planned native-Android module and is **not implemented** here.

## Run it (5 minutes, no accounts needed)

```bash
# terminal 1: API  (http://localhost:8000/docs)
cd api && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional: add GEMINI_API_KEY
uvicorn app.main:app --reload

# terminal 2: web  (http://localhost:3000)
cd web && npm install && npm run dev
```
Demo logins (password `rescue123`): `citizen@demo.in`, `rescue@demo.in`, `eoc@demo.in`. Log in as EOC and press **Add demo incidents**.

## Demo script (the one that proves the claim)
1. Citizen: open `/citizen` once online (caches the app shell).
2. DevTools → Network → Offline (or stop the API). Send a **Critical** SOS. It shows *Saved on this phone*.
3. Go online / restart the API. Within ~12 s it flips to *Received by rescue control*, with a fresh location attached.
4. Rescue dashboard shows it live (SSE) with triage reasons. Accept → En route → Reached → Resolve. The citizen's card updates.
5. EOC: send a broadcast, show the audit log.

## Architecture
```
Citizen PWA (Next.js)  ──▶  Dexie/IndexedDB queue  ──(sync, idempotent by client UUID)──▶  FastAPI
                                                                                          │ JWT + RBAC (citizen / rescue / eoc)
                                                                                          │ Triage: Gemini extracts → deterministic scorer → priority
                                                                                          │ Store: JSON file (default) | Firestore
Rescue / EOC dashboards  ◀── Server-Sent Events + REST ───────────────────────────────────┘
```
Key decisions worth explaining in an interview:
- **Idempotent sync**: client generates the incident ID, so retries and double-sends never duplicate.
- **LLM only extracts; code decides**: priority comes from a transparent scoring function with reasons shown to operators. Keyword rules are a safety net, so the LLM can raise but never lower medical urgency, and it cannot be talked into downgrading (prompt-injection resistant by design). Life-threatening signs have a hard *critical* floor.
- **Never downgrades the citizen**: shown priority = max(AI, citizen-selected).
- **Real reachability**: the UI pings `/health` instead of trusting `navigator.onLine`.
- **Role read from DB, not the token**; server-side RBAC on every route; medical profile shared only if the citizen opts in per SOS; audit trail for privileged actions; squad can only hold one active incident.

## Tests and evaluation
```bash
cd api && python -m pytest -q                      # 16 tests: RBAC, idempotency, workflow, squads, triage
python eval/triage_eval.py                         # dev set (30)  - rules were tuned on this, do not quote it
python eval/triage_eval.py --heldout               # held-out (15) - small, written by the author
python eval/triage_eval.py --heldout --gemini      # with Gemini (needs GEMINI_API_KEY)
```
**Before you quote a number on your resume:** build a larger held-out set (50+ messages) written or labelled by *someone else*, ideally real disaster-tweet data (e.g. CrisisNLP / CrisisLex), and report that. The bundled sets are small and author-written, so 100% on them is a smoke test, not evidence.

## Limitations (say these before an interviewer asks)
- No true offline transport; GPS accuracy varies, none is promised; Gemini needs internet (rules fallback works offline on the server side only).
- SSE hub is in-process (single instance); use Redis pub/sub to scale. Firestore store is implemented but lightly tested.
- No rate limiting, OTP, or email verification yet. Registered citizens can sign in again only while online (the saved token works offline for 7 days).
- Service worker caches the app shell after the first online visit; first-ever load must be online.

## Roadmap
Capacitor Android wrapper → rate limiting + OTP → field test → **RescueMesh** (Android Nearby Connections, store-and-forward with signed packets; claim only after a 2-phone demo works).

## Resume bullets (replace the X's with measured numbers)
- Built **RescueAI**, an offline-first disaster-response platform (Next.js, FastAPI, IndexedDB/Dexie, SSE) where SOS requests persist on-device and sync idempotently when connectivity returns.
- Designed a hybrid triage pipeline (Gemini extraction + deterministic scoring with safety floor) that reaches X% critical-case recall on a Y-message independently labelled set, with explainable reasons for every ranking.
- Implemented JWT role-based access (citizen / rescue / EOC), a validated incident workflow with squad-conflict rules and a full audit trail; 16 automated tests and CI.
