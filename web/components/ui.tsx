"use client";
import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WifiOff, Wifi, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Priority, Status } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

const PRI: Record<Priority, string> = {
  critical: "bg-signal text-white", high: "bg-ember text-white", medium: "bg-sand text-ink", low: "bg-mist text-ink",
};
export const PRI_BORDER: Record<Priority, string> = {
  critical: "border-signal", high: "border-ember", medium: "border-sand", low: "border-mist",
};
export function PriorityTag({ p }: { p: Priority }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${PRI[p]}`}>{p}</span>;
}
export function StatusTag({ s }: { s: Status }) {
  const tone = s === "resolved" ? "bg-ok text-white" : s === "new" ? "bg-ink text-white" : "bg-sea text-white";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${tone}`}>{STATUS_LABEL[s]}</span>;
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" rx="22" fill="#C9302C" /><rect x="42" y="22" width="12" height="52" rx="3" fill="#fff" /><rect x="22" y="42" width="52" height="12" rx="3" fill="#fff" /></svg>
      RescueAI
    </span>
  );
}

/** Step tracker. `at` = index of the current step; at === labels.length means everything is done. */
export function Track({ labels, at }: { labels: string[]; at: number }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {labels.map((l, i) => (
        <li key={l} className="relative flex-1 text-center" aria-current={i === at ? "step" : undefined}>
          {i > 0 && <span className={`absolute left-[-50%] top-[9px] h-0.5 w-full ${i <= at ? "bg-ok" : "bg-mist"}`} />}
          <span className={`relative z-10 mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i < at ? "bg-ok text-white" : i === at ? "bg-sea text-white ring-4 ring-sea/25" : "bg-mist text-slate2"}`}>{i < at ? "✓" : i + 1}</span>
          <span className={`mt-1 block text-[11px] leading-tight ${i <= at ? "font-bold text-ink" : "text-slate2"}`}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

/** True = backend answered /health recently. navigator.onLine is unreliable (wifi without internet), so we ask the server. */
export function useReachable() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const ping = () => api("/health", { timeoutMs: 4000 }).then(() => alive && setOk(true)).catch(() => alive && setOk(false));
    ping();
    const t = setInterval(ping, 8000);
    const off = () => setOk(false);
    window.addEventListener("online", ping); window.addEventListener("offline", off);
    return () => { alive = false; clearInterval(t); window.removeEventListener("online", ping); window.removeEventListener("offline", off); };
  }, []);
  return ok;
}
export function NetBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-xs text-mist">Checking connection</span>;
  return ok
    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/20 px-2.5 py-1 text-xs font-bold text-[#7FE0B0]"><Wifi size={14} /> Connected</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full bg-signal/25 px-2.5 py-1 text-xs font-bold text-[#FFB3AE]"><WifiOff size={14} /> Offline: SOS saved on this device</span>;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function Shell({ role, title, children, net }: { role: string; title: string; children: ReactNode; net?: ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[1000] bg-night text-white shadow-lg">
        <div className="h-1 bg-gradient-to-r from-signal via-ember to-sea" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Logo />
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-mist">{title}</span>
          <div className="ml-auto flex items-center gap-3">
            {net}
            <span className="hidden text-sm text-mist md:inline">{user?.name}</span>
            <button onClick={() => { signOut(); router.replace("/"); }} className="inline-flex items-center gap-1 rounded border border-white/25 px-2.5 py-1 text-sm hover:bg-white/10">
              <LogOut size={14} /> <span className="sr-only sm:not-sr-only">Sign out</span><span className="sr-only">({role})</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}

export function useGuard(role: "citizen" | "rescue" | "eoc") {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (role === "eoc" ? user.role !== "eoc" : role === "rescue" ? user.role === "citizen" : user.role !== "citizen") router.replace("/");
  }, [ready, user, role, router]);
  return { user, token, ok: ready && !!user };
}
