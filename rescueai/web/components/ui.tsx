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
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold capitalize ${PRI[p]}`}>{p}</span>;
}
export function StatusTag({ s }: { s: Status }) {
  const tone = s === "resolved" ? "bg-ok text-white" : s === "new" ? "bg-ink text-white" : "bg-sea text-white";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${tone}`}>{STATUS_LABEL[s]}</span>;
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
  if (ok === null) return <span className="text-xs text-slate2">Checking connection</span>;
  return ok
    ? <span className="inline-flex items-center gap-1 text-xs font-bold text-ok"><Wifi size={14} /> Connected</span>
    : <span className="inline-flex items-center gap-1 text-xs font-bold text-signal"><WifiOff size={14} /> Offline: SOS are saved on this device</span>;
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
      <header className="sticky top-0 z-20 border-b-4 border-signal bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="text-lg font-bold">RescueAI</div>
          <div className="text-sm text-mist">{title}</div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:block [&_*]:!text-white">{net}</div>
            <span className="hidden text-sm text-mist md:inline">{user?.name} ({role})</span>
            <button onClick={() => { signOut(); router.replace("/"); }} className="inline-flex items-center gap-1 rounded border border-mist/40 px-2 py-1 text-sm hover:bg-white/10">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
        <div className="px-4 pb-2 sm:hidden">{net}</div>
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
