"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import IncidentBoard from "@/components/IncidentBoard";
import { NetBadge, Shell, timeAgo, useGuard, useReachable } from "@/components/ui";
import { api } from "@/lib/api";
import type { AuditEntry, Broadcast } from "@/lib/types";

export default function EOC() {
  const { token, ok } = useGuard("eoc");
  const reachable = useReachable();
  const [tab, setTab] = useState<"incidents" | "broadcast" | "audit">("incidents");
  const [audit, setAudit] = useState<AuditEntry[]>([]); const [bc, setBc] = useState<Broadcast[]>([]);
  const [form, setForm] = useState({ title: "", message: "", level: "warning" }); const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    api<AuditEntry[]>("/audit", { token }).then(setAudit).catch(() => {});
    api<Broadcast[]>("/broadcasts", { token }).then(setBc).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load, tab]);

  async function send(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try { await api("/broadcasts", { token, body: form }); setForm({ title: "", message: "", level: "warning" }); setMsg("Broadcast sent to connected citizens."); load(); }
    catch (x) { setMsg(x instanceof Error ? x.message : "Could not send."); }
  }
  async function seed() {
    try { const r = await api<{ created: number }>("/dev/seed", { token, method: "POST", body: {} }); setMsg(`Added ${r.created} demo incidents.`); }
    catch (x) { setMsg(x instanceof Error ? x.message : "Could not add demo data."); }
  }
  if (!ok || !token) return null;
  const f = "w-full rounded border-2 border-ink/30 bg-white px-3 py-2";
  return (
    <Shell role="eoc" title="Emergency Operations Center" net={<NetBadge ok={reachable} />}>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist">
        {([["incidents", "All incidents"], ["broadcast", "Broadcast"], ["audit", "Audit log"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded px-4 py-2 font-bold ${tab === k ? "bg-ink text-white" : "bg-mist"}`}>{l}</button>))}
        <button onClick={seed} className="ml-auto rounded border-2 border-ink px-3 py-2 text-sm font-bold hover:bg-ink hover:text-white">Add demo incidents</button>
      </div>
      {msg && <p role="status" className="mb-3 rounded bg-white p-2 text-sm font-bold">{msg}</p>}
      {tab === "incidents" && <IncidentBoard token={token} />}
      {tab === "broadcast" && (
        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={send} className="space-y-3 rounded border-2 border-ink bg-white p-4">
            <h2 className="text-xl font-bold">Send an alert to all citizens</h2>
            <label className="block text-sm font-bold">Title<input required maxLength={100} className={f} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="block text-sm font-bold">Message<textarea required maxLength={500} rows={3} className={f} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
            <label className="block text-sm font-bold">Level<select className={f} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
            <button className="rounded bg-signal px-4 py-2 font-bold text-white">Send broadcast</button>
            <p className="text-xs text-slate2">Citizens receive it the next time their app reaches the server, then it stays readable offline.</p>
          </form>
          <div><h2 className="mb-2 text-xl font-bold">Recent broadcasts</h2>
            <ul className="space-y-2">{!bc.length && <li className="text-slate2">None sent yet.</li>}{bc.map((b) => <li key={b.id} className="rounded border-2 border-mist bg-white p-3"><b>{b.title}</b> <span className="text-xs text-slate2">({b.level}, {timeAgo(b.ts)})</span><p>{b.message}</p></li>)}</ul></div>
        </div>)}
      {tab === "audit" && (
        <div className="overflow-x-auto rounded border-2 border-ink bg-white">
          <table className="w-full text-left text-sm"><thead className="bg-ink text-white"><tr><th className="p-2">When</th><th className="p-2">Who</th><th className="p-2">Action</th><th className="p-2">Target</th><th className="p-2">Detail</th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id} className="border-t border-mist"><td className="p-2 whitespace-nowrap">{new Date(a.ts).toLocaleString()}</td><td className="p-2">{a.actor_name} ({a.role})</td><td className="p-2 font-bold">{a.action}</td><td className="p-2">{a.target?.slice(0, 14)}</td><td className="p-2 text-slate2">{JSON.stringify(a.detail)}</td></tr>)}</tbody></table>
          {!audit.length && <p className="p-4 text-slate2">No events yet.</p>}
        </div>)}
    </Shell>
  );
}
