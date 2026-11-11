import { api, ApiError } from "./api";
import { db } from "./db";
import { getLocation } from "./geo";

interface SyncResponse { results: { id: string; result: "created" | "duplicate" | "error"; status?: string; priority?: string; detail?: string }[] }
let running = false;

/** Upload every pending SOS. Safe to call repeatedly: the server dedupes on the client-generated id. */
export async function syncPending(token: string): Promise<{ sent: number; error?: string }> {
  if (running) return { sent: 0 };
  running = true;
  try {
    const items = await db.sos.where("sync").equals("pending").toArray();
    if (!items.length) return { sent: 0 };
    const fresh = await getLocation(4000); // newest position at the moment connectivity returns
    await db.sos.bulkUpdate(items.map((i) => ({ key: i.id, changes: { sync: "syncing" as const } })));
    try {
      const res = await api<SyncResponse>("/sos/sync", {
        method: "POST", token, timeoutMs: 15000,
        body: { items: items.map((i) => ({
          id: i.id, severity: i.severity, message: i.message, people: i.people, share_profile: i.share_profile,
          location: i.location, location_at_sync: fresh, created_at: i.created_at })) },
      });
      let sent = 0;
      for (const r of res.results) {
        if (r.result === "error") await db.sos.update(r.id, { sync: "failed", last_error: r.detail });
        else { sent++; await db.sos.update(r.id, { sync: "synced", synced_at: new Date().toISOString(), server_status: r.status, server_priority: r.priority }); }
      }
      return { sent };
    } catch (e) {
      // network/auth failure: put everything back to pending so the next attempt retries
      for (const i of items) await db.sos.update(i.id, { sync: "pending", attempts: i.attempts + 1, last_error: e instanceof Error ? e.message : "Network error" });
      return { sent: 0, error: e instanceof ApiError && e.status === 401 ? "Session expired. Sign in again to send saved SOS." : undefined };
    }
  } finally { running = false; }
}

export async function refreshStatuses(token: string) {
  const mine = await api<{ id: string; status: string; priority: string; squad_name: string | null }[]>("/sos/mine", { token });
  for (const m of mine) await db.sos.update(m.id, { server_status: m.status, server_priority: m.priority, server_squad: m.squad_name });
}
