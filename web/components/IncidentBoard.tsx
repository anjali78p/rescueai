"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Radio, Phone, Search } from "lucide-react";
import { api, API } from "@/lib/api";
import { mapsLink } from "@/lib/geo";
import type { Incident, Squad, Stats, Status } from "@/lib/types";
import { NEXT_STATUS, STATUS_LABEL } from "@/lib/types";
import { PriorityTag, PRI_BORDER, StatusTag, timeAgo } from "./ui";

const RANK = { critical: 3, high: 2, medium: 1, low: 0 } as const;
const sortInc = (a: Incident, b: Incident) => RANK[b.priority] - RANK[a.priority] || a.received_at.localeCompare(b.received_at);

export default function IncidentBoard({ token }: { token: string }) {
  const [items, setItems] = useState<Map<string, Incident>>(new Map());
  const [squads, setSquads] = useState<Squad[]>([]); const [stats, setStats] = useState<Stats | null>(null);
  const [sel, setSel] = useState<string | null>(null); const [live, setLive] = useState(false);
  const [fStatus, setFStatus] = useState<"open" | "all" | Status>("open"); const [fPri, setFPri] = useState("all"); const [q, setQ] = useState("");
  const [squadPick, setSquadPick] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const upsert = useCallback((i: Incident) => setItems((m) => new Map(m).set(i.id, i)), []);
  const loadAll = useCallback(async () => {
    try {
      const [inc, sq, st] = await Promise.all([api<Incident[]>("/incidents", { token }), api<Squad[]>("/squads", { token }), api<Stats>("/stats", { token })]);
      setItems(new Map(inc.map((i) => [i.id, i]))); setSquads(sq); setStats(st);
    } catch (e) { setErr(e instanceof Error ? e.message : "Cannot load incidents."); }
  }, [token]);

  useEffect(() => { loadAll(); const t = setInterval(loadAll, 20000); return () => clearInterval(t); }, [loadAll]);
  useEffect(() => {
    const es = new EventSource(`${API}/stream?token=${encodeURIComponent(token)}`);
    es.onopen = () => setLive(true); es.onerror = () => setLive(false);
    es.addEventListener("incident", (e) => { upsert(JSON.parse((e as MessageEvent).data)); api<Squad[]>("/squads", { token }).then(setSquads).catch(() => {}); api<Stats>("/stats", { token }).then(setStats).catch(() => {}); });
    return () => es.close();
  }, [token, upsert]);

  const shown = useMemo(() => [...items.values()]
    .filter((i) => (fStatus === "open" ? i.status !== "resolved" : fStatus === "all" ? true : i.status === fStatus))
    .filter((i) => fPri === "all" || i.priority === fPri)
    .filter((i) => !q || (i.message + i.citizen_name + i.id).toLowerCase().includes(q.toLowerCase()))
    .sort(sortInc), [items, fStatus, fPri, q]);
  const cur = sel ? items.get(sel) : undefined;

  async function advance(i: Incident) {
    const n = NEXT_STATUS[i.status]; if (!n) return;
    if (n.to === "accepted" && !squadPick) { setErr("Choose a squad before accepting."); return; }
    setBusy(true); setErr("");
    try { upsert(await api<Incident>(`/incidents/${i.id}/status`, { token, body: { status: n.to, squad_id: n.to === "accepted" ? squadPick : undefined } })); setSquadPick(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Update failed."); } finally { setBusy(false); }
  }

  const open = [...items.values()].filter((i) => i.status !== "resolved");
  const Stat = ({ k, v }: { k: string; v: string | number }) => <div className="rounded border-2 border-mist bg-white px-3 py-2"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-slate2">{k}</div></div>;
  const sel_ = "rounded border-2 border-ink/30 bg-white px-2 py-1.5 text-sm";

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat k="Open incidents" v={open.length} />
        <Stat k="Critical and open" v={open.filter((i) => i.priority === "critical").length} />
        <Stat k="Waiting for a squad" v={open.filter((i) => i.status === "new").length} />
        <Stat k="Resolved" v={stats?.by_status.resolved ?? 0} />
        <Stat k="Avg minutes to accept" v={stats?.avg_minutes_to_accept ?? "n/a"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <section aria-label="Incident queue">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select aria-label="Status filter" className={sel_} value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)}>
              <option value="open">Open</option><option value="all">All</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select aria-label="Priority filter" className={sel_} value={fPri} onChange={(e) => setFPri(e.target.value)}>
              <option value="all">Any priority</option>{["critical", "high", "medium", "low"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <span className={`ml-auto inline-flex items-center gap-1 text-xs font-bold ${live ? "text-ok" : "text-signal"}`}><Radio size={14} /> {live ? "Live" : "Reconnecting"}</span>
            <label className="relative w-full"><Search size={14} className="absolute left-2 top-2.5 text-slate2" /><input aria-label="Search incidents" placeholder="Search message or name" className={`${sel_} w-full pl-7`} value={q} onChange={(e) => setQ(e.target.value)} /></label>
          </div>
          <ul className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {!shown.length && <li className="rounded border-2 border-dashed border-mist p-4 text-slate2">No incidents match. New SOS appear here as they arrive.</li>}
            {shown.map((i) => (
              <li key={i.id}>
                <button onClick={() => { setSel(i.id); setErr(""); }} aria-pressed={sel === i.id}
                  className={`w-full rounded border-2 border-l-8 bg-white p-3 text-left ${PRI_BORDER[i.priority]} ${sel === i.id ? "ring-2 ring-ink" : ""}`}>
                  <div className="flex items-center gap-2"><PriorityTag p={i.priority} /><StatusTag s={i.status} /><span className="ml-auto text-xs text-slate2">{timeAgo(i.received_at)}</span></div>
                  <p className="mt-1 line-clamp-2 text-sm">{i.message || "No message"}</p>
                  <p className="mt-1 text-xs text-slate2">{i.citizen_name} · {i.incident_type}{i.people ? ` · ${i.people} people` : ""}{i.trapped ? " · trapped" : ""}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Incident detail" className="rounded border-2 border-ink bg-white p-4">
          {!cur ? <p className="text-slate2">Select an incident to review the AI triage and dispatch a squad.</p> : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2"><PriorityTag p={cur.priority} /><StatusTag s={cur.status} />
                <span className="text-sm text-slate2">{cur.citizen_name}, received {timeAgo(cur.received_at)} (sent {timeAgo(cur.created_at)})</span></div>
              <p className="text-lg">{cur.message || "No message"}</p>

              <div className="rounded bg-paper p-3">
                <p className="font-bold">Triage suggestion <span className="font-normal text-slate2">({cur.triage_source}; a human decides)</span></p>
                <p className="text-sm">Type: {cur.incident_type} · Medical: {cur.medical_urgency} · Trapped: {cur.trapped ? "yes" : "no"} · People: {cur.people ?? "unknown"}</p>
                <p className="text-sm">Score {cur.score} → {cur.ai_priority}. Citizen marked {cur.severity}. Shown priority is the higher of the two.</p>
                <ul className="mt-1 list-disc pl-5 text-sm">{cur.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {cur.location ? <a className="inline-flex items-center gap-1 font-bold text-sea underline" target="_blank" rel="noreferrer" href={mapsLink(cur.location)}><MapPin size={16} /> Open sent location{cur.location.accuracy ? ` (about ${Math.round(cur.location.accuracy)} m)` : ""}</a> : <span className="text-slate2">No location sent</span>}
                {cur.location_at_sync && <a className="inline-flex items-center gap-1 font-bold text-sea underline" target="_blank" rel="noreferrer" href={mapsLink(cur.location_at_sync)}><MapPin size={16} /> Position when connection returned</a>}
              </div>
              {cur.profile && <div className="rounded border-2 border-mist p-3 text-sm"><p className="inline-flex items-center gap-1 font-bold"><Phone size={14} /> Shared by citizen</p>
                <p>Phone: {cur.profile.phone || "n/a"} · Contact: {cur.profile.emergency_contact || "n/a"}</p><p>Medical: {cur.profile.medical_notes || "none given"}</p></div>}

              {cur.status !== "resolved" && (
                <div className="flex flex-wrap items-center gap-2 border-t-2 border-mist pt-3">
                  {cur.status === "new" && (
                    <select aria-label="Squad" className={sel_} value={squadPick} onChange={(e) => setSquadPick(e.target.value)}>
                      <option value="">Choose squad</option>
                      {squads.map((s) => <option key={s.id} value={s.id} disabled={s.busy}>{s.name} ({s.kind}){s.busy ? ": busy" : ""}</option>)}
                    </select>)}
                  {cur.squad_name && <span className="text-sm font-bold">Squad: {cur.squad_name}</span>}
                  <button disabled={busy} onClick={() => advance(cur)} className="rounded bg-sea px-4 py-2 font-bold text-white disabled:opacity-60">{NEXT_STATUS[cur.status]?.label}</button>
                </div>)}
              {err && <p role="alert" className="text-sm font-bold text-signal">{err}</p>}

              <div><p className="mb-1 font-bold">History</p>
                <ol className="space-y-1 border-l-2 border-mist pl-3 text-sm">{cur.history.map((h, n) => <li key={n}><b>{STATUS_LABEL[h.status]}</b> by {h.actor}, {timeAgo(h.ts)}{h.note ? `: ${h.note}` : ""}</li>)}</ol></div>
            </div>)}
        </section>
      </div>
      {err && !cur && <p role="alert" className="mt-3 text-sm font-bold text-signal">{err}</p>}
    </div>
  );
}
