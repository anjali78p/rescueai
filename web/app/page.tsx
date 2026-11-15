"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Cloud, LayoutDashboard, WifiOff, BrainCircuit, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Logo } from "@/components/ui";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { citizen: "/citizen", rescue: "/rescue", eoc: "/eoc" };
const DEMOS = [["Citizen", "citizen@demo.in", "Send an SOS"], ["Rescue command", "rescue@demo.in", "Dispatch squads"], ["EOC admin", "eoc@demo.in", "Broadcast and audit"]];

function Node({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">{icon}</span>
      <span className="mt-2 text-sm font-bold">{label}</span><span className="text-xs text-mist">{sub}</span>
    </div>
  );
}
function Wire() {
  return <div className="relative mx-1 mb-8 h-0.5 flex-1 border-t-2 border-dashed border-white/30"><span className="absolute -top-[6px] h-2.5 w-2.5 animate-travel rounded-full bg-signal" /></div>;
}

export default function Landing() {
  const { user, ready, signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", emergency_contact: "", medical_notes: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [demo, setDemo] = useState(false);

  useEffect(() => { if (ready && user) router.replace(HOME[user.role]); }, [ready, user, router]);
  useEffect(() => { api<{ demo: boolean }>("/health", { timeoutMs: 4000 }).then((h) => setDemo(h.demo)).catch(() => {}); }, []);

  async function submit(e: FormEvent, override?: { email: string; password: string }) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const body = override ?? (mode === "login" ? { email: f.email, password: f.password } : { ...f, phone: f.phone || undefined, emergency_contact: f.emergency_contact || undefined, medical_notes: f.medical_notes || undefined });
      const u = await signIn(override || mode === "login" ? "login" : "register", body);
      router.replace(HOME[u.role]);
    } catch (x) { setErr(x instanceof Error && x.message !== "Failed to fetch" ? x.message : "Cannot reach the server. Check that the API is running."); }
    finally { setBusy(false); }
  }
  const field = "mt-1 w-full rounded-lg border-2 border-mist bg-white px-3 py-2.5 text-base";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <section className="bg-night bg-grid text-white">
        <div className="bg-glow">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-8 md:grid-cols-[1.15fr_1fr] md:py-14">
            <div className="animate-fadeUp">
              <Logo size={34} />
              <h1 className="mt-8 text-4xl font-bold leading-[1.1] md:text-6xl">When the network drops,<br /><span className="text-signal">your SOS should not.</span></h1>
              <p className="mt-5 max-w-xl text-lg text-mist">
                RescueAI saves an emergency request on the phone the moment it is sent, delivers it as soon as any connection returns,
                and helps rescue teams see who needs help first.
              </p>

              <div className="mt-8 rounded-2xl border border-white/15 bg-white/[.04] p-4 backdrop-blur" aria-label="How an SOS travels">
                <div className="flex items-center">
                  <Node icon={<Smartphone />} label="Phone" sub="Saved first" />
                  <Wire />
                  <Node icon={<Cloud />} label="Server" sub="Synced later" />
                  <Wire />
                  <Node icon={<LayoutDashboard />} label="Rescue team" sub="Ranked" />
                </div>
                <div className="mt-3 rounded-xl bg-white p-3 text-ink">
                  <div className="flex items-center gap-2"><span className="rounded bg-signal px-2 py-0.5 text-xs font-bold uppercase text-white">Critical</span><span className="text-xs text-slate2">Example triage</span><span className="ml-auto text-xs font-bold">Score 91</span></div>
                  <p className="mt-1 text-sm">“Two people trapped on the second floor, one has severe breathing difficulty.”</p>
                  <p className="mt-1 text-xs text-slate2">flood · 2 people · trapped · medical: critical. Humans confirm every dispatch.</p>
                </div>
              </div>
            </div>

            <section className="animate-fadeUp rounded-2xl bg-white p-5 text-ink shadow-2xl [animation-delay:.15s]" aria-label="Sign in">
              <div className="mb-4 flex gap-1 rounded-xl bg-paper p-1" role="tablist">
                {(["login", "register"] as const).map((m) => (
                  <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                    className={`flex-1 rounded-lg px-3 py-2 font-bold ${mode === m ? "bg-ink text-white shadow" : "text-slate2"}`}>{m === "login" ? "Sign in" : "Create account"}</button>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-3">
                {mode === "register" && <label className="block text-sm font-bold">Full name<input className={field} required value={f.name} onChange={set("name")} autoComplete="name" /></label>}
                <label className="block text-sm font-bold">Email<input className={field} type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></label>
                <label className="block text-sm font-bold">Password{mode === "register" && " (8 or more characters)"}<input className={field} type="password" required minLength={mode === "register" ? 8 : 1} value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
                {mode === "register" && (<>
                  <label className="block text-sm font-bold">Phone (optional)<input className={field} value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
                  <label className="block text-sm font-bold">Emergency contact (optional)<input className={field} value={f.emergency_contact} onChange={set("emergency_contact")} /></label>
                  <label className="block text-sm font-bold">Medical notes (optional; shared only if you choose)<textarea className={field} rows={2} value={f.medical_notes} onChange={set("medical_notes")} /></label>
                </>)}
                {err && <p role="alert" className="rounded-lg bg-signal/10 p-2 text-sm font-bold text-signal">{err}</p>}
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sea px-4 py-3 text-base font-bold text-white transition hover:brightness-110 disabled:opacity-60">{busy ? "Please wait" : mode === "login" ? "Sign in" : "Create account"} {!busy && <ArrowRight size={18} />}</button>
              </form>
              {demo && (
                <div className="mt-5 border-t-2 border-paper pt-4">
                  <p className="mb-2 text-sm font-bold">Try a demo account <span className="font-normal text-slate2">(password rescue123)</span></p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DEMOS.map(([label, email, sub]) => (
                      <button key={email} onClick={(e) => submit(e, { email, password: "rescue123" })} className="rounded-lg border-2 border-ink px-3 py-2 text-left transition hover:bg-ink hover:text-white">
                        <span className="block text-sm font-bold">{label}</span><span className="block text-xs opacity-70">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-2xl font-bold md:text-3xl">Built for the first hours of a disaster</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            [WifiOff, "Saved first, sent later", "Every SOS is stored on the device before anything is uploaded. Retries never create duplicates, and a fresh location is attached when the connection returns."],
            [BrainCircuit, "Triage you can explain", "AI reads the message in English, Hindi or Hinglish. A transparent score ranks it, shows its reasons, and never lowers what the citizen reported."],
            [ShieldCheck, "Accountable dispatch", "Role-based access, a strict Accept → En route → Reached → Resolve workflow, one active incident per squad, and an audit trail for every action."],
          ].map(([Icon, t, d], n) => {
            const I = Icon as typeof WifiOff;
            return (
              <article key={t as string} className="animate-fadeUp rounded-2xl border-2 border-mist bg-white p-5" style={{ animationDelay: `${n * 0.1}s` }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-night text-white"><I size={22} /></span>
                <h3 className="mt-3 text-lg font-bold">{t as string}</h3><p className="mt-1 text-slate2">{d as string}</p>
              </article>
            );
          })}
        </div>
        <p className="mt-8 text-sm text-slate2">RescueAI supports, and does not replace, official emergency services. In India you can also dial 112. This is a prototype; offline-first means SOS are kept on the phone until a connection exists.</p>
      </section>
    </div>
  );
}
