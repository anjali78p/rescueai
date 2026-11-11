"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { citizen: "/citizen", rescue: "/rescue", eoc: "/eoc" };
const DEMOS = [["Citizen", "citizen@demo.in"], ["Rescue command", "rescue@demo.in"], ["EOC admin", "eoc@demo.in"]];

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
    } catch (x) { setErr(x instanceof Error && x.message !== "Failed to fetch" ? x.message : "Cannot reach the server. Check your connection."); }
    finally { setBusy(false); }
  }
  const field = "w-full rounded border-2 border-mist bg-white px-3 py-2 text-base";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-5 py-10 md:grid-cols-[1.2fr_1fr]">
      <section>
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">When the network drops, your SOS should not.</h1>
        <p className="mt-4 max-w-prose text-lg text-slate2">
          RescueAI saves your emergency request on your phone the moment you send it, delivers it as soon as any connection returns, and
          helps rescue teams see who needs help first.
        </p>
        <ul className="mt-6 space-y-2 text-base">
          <li><b>Saved first.</b> Your SOS is stored on the device before anything is sent.</li>
          <li><b>Sent automatically.</b> It uploads, with a fresh location, when a connection comes back.</li>
          <li><b>Prioritised for humans.</b> AI reads the message; a rescue officer decides who goes where.</li>
        </ul>
        <p className="mt-6 text-sm text-slate2">RescueAI supports, and does not replace, official emergency services. In India you can also dial 112.</p>
      </section>

      <section className="rounded-lg border-2 border-ink bg-white p-5">
        <div className="mb-4 flex gap-2" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`flex-1 rounded px-3 py-2 font-bold ${mode === m ? "bg-ink text-white" : "bg-mist text-ink"}`}>{m === "login" ? "Sign in" : "Create account"}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && <label className="block text-sm font-bold">Full name<input className={field} required value={f.name} onChange={set("name")} autoComplete="name" /></label>}
          <label className="block text-sm font-bold">Email<input className={field} type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></label>
          <label className="block text-sm font-bold">Password{mode === "register" && " (8 or more characters)"}<input className={field} type="password" required minLength={mode === "register" ? 8 : 1} value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          {mode === "register" && (<>
            <label className="block text-sm font-bold">Phone (optional)<input className={field} value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
            <label className="block text-sm font-bold">Emergency contact (optional)<input className={field} value={f.emergency_contact} onChange={set("emergency_contact")} /></label>
            <label className="block text-sm font-bold">Medical notes (optional, shared only if you choose to)<textarea className={field} rows={2} value={f.medical_notes} onChange={set("medical_notes")} /></label>
          </>)}
          {err && <p role="alert" className="rounded bg-signal/10 p-2 text-sm font-bold text-signal">{err}</p>}
          <button disabled={busy} className="w-full rounded bg-sea px-4 py-3 text-base font-bold text-white disabled:opacity-60">{busy ? "Please wait" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        {demo && (
          <div className="mt-5 border-t-2 border-mist pt-4">
            <p className="mb-2 text-sm text-slate2">Demo accounts (password: rescue123)</p>
            <div className="flex flex-wrap gap-2">
              {DEMOS.map(([label, email]) => (
                <button key={email} onClick={(e) => submit(e, { email, password: "rescue123" })} className="rounded border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-ink hover:text-white">{label}</button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
