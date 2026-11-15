"use client";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Mic, MapPin, RotateCw, CheckCircle2, Clock, AlertTriangle, Siren, ChevronDown, Megaphone } from "lucide-react";
import { db, LocalSos } from "@/lib/db";
import { api } from "@/lib/api";
import { syncPending, refreshStatuses } from "@/lib/sync";
import { GUIDANCE } from "@/lib/guidance";
import type { Broadcast, Loc, Priority } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { NetBadge, PriorityTag, Shell, Track, timeAgo, useGuard, useReachable } from "@/components/ui";

const LEVELS: { v: Priority; label: string; hint: string }[] = [
  { v: "critical", label: "Critical", hint: "Life in danger now" }, { v: "high", label: "High", hint: "Trapped or injured" },
  { v: "medium", label: "Medium", hint: "Need help soon" }, { v: "low", label: "Low", hint: "Information or supplies" },
];
const SEV_ON: Record<Priority, string> = {
  critical: "border-signal bg-signal text-white", high: "border-ember bg-ember text-white",
  medium: "border-sand bg-sand text-ink", low: "border-slate2 bg-slate2 text-white",
};
const SEV_DOT: Record<Priority, string> = { critical: "bg-signal", high: "bg-ember", medium: "bg-sand", low: "bg-slate2" };
const QUICK = ["We are trapped.", "Someone is injured.", "Medical emergency.", "Water is rising.", "Fire nearby.", "Need food and water.", "Elderly or children with us."];
const TRACK = ["Saved", "Received", "Accepted", "On the way", "Reached", "Done"];
function stage(s: LocalSos) {
  if (s.sync !== "synced") return 0;
  return ({ accepted: 2, en_route: 3, reached: 4, resolved: 6 } as Record<string, number>)[s.server_status ?? ""] ?? 1;
}
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

function SyncChip({ s }: { s: LocalSos }) {
  if (s.sync === "synced") return <span className="inline-flex items-center gap-1 text-sm font-bold text-ok"><CheckCircle2 size={16} /> Received by rescue control</span>;
  if (s.sync === "failed") return <span className="inline-flex items-center gap-1 text-sm font-bold text-signal"><AlertTriangle size={16} /> Not accepted: {s.last_error ?? "error"}</span>;
  return <span className="inline-flex items-center gap-1 text-sm font-bold text-ember"><Clock size={16} /> {s.sync === "syncing" ? "Sending" : "Saved on this phone, will send when a connection returns"}</span>;
}

export default function Citizen() {
  const { token, ok } = useGuard("citizen");
  const reachable = useReachable();
  const [severity, setSeverity] = useState<Priority>("high");
  const [message, setMessage] = useState(""); const [people, setPeople] = useState("");
  const [share, setShare] = useState(true); const [loc, setLoc] = useState<Loc | null>(null);
  const [notice, setNotice] = useState(""); const [listening, setListening] = useState(false); const [lang, setLang] = useState("en-IN");
  const recRef = useRef<any>(null);
  const list = useLiveQuery(() => db.sos.orderBy("created_at").reverse().toArray(), []);
  const bcasts = useLiveQuery(() => db.broadcasts.orderBy("ts").reverse().limit(3).toArray(), []);

  // keep a warm location fix so SOS never waits on GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, captured_at: new Date().toISOString() }),
      () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // sync engine: on mount, on 'online', and every 12 s; also pulls broadcasts + status updates when reachable
  useEffect(() => {
    if (!token) return;
    const run = () => {
      syncPending(token).then((r) => setNotice(r.error ?? ""));
      refreshStatuses(token).catch(() => {});
      api<Broadcast[]>("/broadcasts", { token, timeoutMs: 5000 }).then((b) => db.broadcasts.bulkPut(b)).catch(() => {});
    };
    run();
    const t = setInterval(run, 12000);
    window.addEventListener("online", run);
    return () => { clearInterval(t); window.removeEventListener("online", run); };
  }, [token]);

  async function send() {
    const rec: LocalSos = { id: uid(), severity, message: message.trim(), people: people ? Math.min(500, Math.max(1, parseInt(people, 10) || 1)) : undefined,
      share_profile: share, location: loc, created_at: new Date().toISOString(), sync: "pending", attempts: 0 };
    await db.sos.add(rec);               // 1) persist locally first
    setMessage(""); setPeople("");
    if (token) syncPending(token).then((r) => setNotice(r.error ?? "")); // 2) try to send right away
  }
  async function retry(id: string) { await db.sos.update(id, { sync: "pending", last_error: undefined }); if (token) syncPending(token); }

  function dictate() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setNotice("Voice input is not supported in this browser. Type your message instead."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const r = new SR(); r.lang = lang; r.interimResults = false;
    r.onresult = (e: any) => setMessage((m) => (m ? m + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  }

  if (!ok) return null;
  const field = "w-full rounded border-2 border-ink/30 bg-white px-3 py-2 text-base";
  return (
    <Shell role="citizen" title="Emergency help" net={<NetBadge ok={reachable} />}>
      <div className="mx-auto max-w-xl space-y-6">
        {bcasts?.filter((b) => Date.now() - new Date(b.ts).getTime() < 24 * 3600e3).map((b) => (
          <div key={b.id} role="alert" className={`rounded border-l-8 bg-white p-3 ${b.level === "critical" ? "border-signal" : b.level === "warning" ? "border-ember" : "border-sea"}`}>
            <p className="flex items-center gap-2 font-bold"><Megaphone size={16} />{b.title}</p><p>{b.message}</p><p className="text-xs text-slate2">{b.author}, {timeAgo(b.ts)}</p>
          </div>
        ))}

        <section aria-labelledby="sos-h" className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[6px_6px_0_0_#12262E]">
          <h1 id="sos-h" className="text-2xl font-bold">Send an SOS</h1>
          <p className="text-sm text-slate2">It is saved on this phone first, then sent. You can close the app after sending.</p>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-bold">How serious is it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((l) => (
                <label key={l.v} className={`cursor-pointer rounded-xl border-2 p-2.5 transition ${severity === l.v ? SEV_ON[l.v] : "border-mist bg-white hover:border-ink/40"}`}>
                  <input type="radio" name="sev" className="sr-only" checked={severity === l.v} onChange={() => setSeverity(l.v)} />
                  <span className="flex items-center gap-2 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${severity === l.v ? "bg-white" : SEV_DOT[l.v]}`} />{l.label}</span>
                  <span className="block text-xs opacity-80">{l.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-sm font-bold">What is happening?
            <textarea className={field} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000}
              placeholder="Where you are, how many people, who is hurt. English, Hindi or Hinglish." />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Quick phrases">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setMessage((m) => (m.includes(q) ? m : (m ? m.trimEnd() + " " : "") + q))}
                className="rounded-full border border-ink/25 bg-paper px-3 py-1 text-sm hover:bg-ink hover:text-white">+ {q.replace(/\.$/, "")}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={dictate} className={`inline-flex items-center gap-1 rounded border-2 px-3 py-1.5 text-sm font-bold ${listening ? "border-signal bg-signal text-white" : "border-ink"}`}>
              <Mic size={16} /> {listening ? "Listening. Tap to stop" : "Speak instead"}
            </button>
            <select aria-label="Voice language" value={lang} onChange={(e) => setLang(e.target.value)} className="rounded border-2 border-ink/30 bg-white px-2 py-1.5 text-sm">
              <option value="en-IN">English</option><option value="hi-IN">Hindi</option>
            </select>
            <label className="ml-auto text-sm font-bold">People
              <input className="ml-2 w-16 rounded border-2 border-ink/30 px-2 py-1" inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </label>
          </div>
          <p className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${loc ? "bg-ok/10 text-ok" : "bg-ember/10 text-ember"}`}><MapPin size={16} className={loc ? "" : "animate-blink"} />
            {loc ? <>Location ready ({loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}{loc.accuracy ? `, about ${Math.round(loc.accuracy)} m` : ""})</> : "Finding your location. Your SOS is saved and sent even without it."}
          </p>
          <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={share} onChange={(e) => setShare(e.target.checked)} />Share my phone, emergency contact and medical notes with rescuers</label>
          {notice && <p role="alert" className="mt-2 text-sm font-bold text-signal">{notice}</p>}
          <button onClick={send} className="sos-pulse mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-signal px-4 py-5 text-2xl font-bold text-white shadow-lg transition active:scale-[.99]"><Siren size={28} /> Send SOS</button>
        </section>

        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="mb-2 text-xl font-bold">Your SOS</h2>
          {!list?.length ? <p className="rounded-xl border-2 border-dashed border-mist p-4 text-slate2">Nothing sent yet. If you need help, use the red button above.</p> : (
            <ul className="space-y-2">
              {list.map((s) => (
                <li key={s.id} className="animate-fadeUp rounded-xl border-2 border-mist bg-white p-3">
                  <div className="flex items-center gap-2"><PriorityTag p={(s.server_priority as Priority) ?? s.severity} /><span className="text-xs text-slate2">{timeAgo(s.created_at)}</span>
                    {s.server_status && <span className="ml-auto text-sm font-bold">{STATUS_LABEL[s.server_status as keyof typeof STATUS_LABEL]}{s.server_squad ? `: ${s.server_squad}` : ""}</span>}</div>
                  <p className="mt-1 line-clamp-2">{s.message || "No message"}</p>
                  {s.sync !== "failed" && <div className="mt-3 mb-2"><Track labels={TRACK} at={stage(s)} /></div>}
                  <div className="mt-1 flex items-center gap-3"><SyncChip s={s} />
                    {s.sync === "failed" && <button onClick={() => retry(s.id)} className="inline-flex items-center gap-1 text-sm font-bold underline"><RotateCw size={14} /> Try again</button>}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="g-h">
          <h2 id="g-h" className="mb-2 text-xl font-bold">Safety guidance <span className="text-sm font-normal text-slate2">(works offline)</span></h2>
          <div className="space-y-2">
            {GUIDANCE.map((g) => (
              <details key={g.title} className="rounded-xl border-2 border-mist bg-white p-3">
                <summary className="flex items-center justify-between font-bold">{g.title}<ChevronDown size={18} className="chev transition" /></summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">{g.steps.map((s) => <li key={s}>{s}</li>)}</ul>
              </details>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
