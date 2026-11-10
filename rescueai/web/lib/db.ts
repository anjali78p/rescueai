import Dexie, { Table } from "dexie";
import type { Broadcast, Loc, Priority } from "./types";

export type SyncState = "pending" | "syncing" | "synced" | "failed";
export interface LocalSos {
  id: string; severity: Priority; message: string; people?: number; share_profile: boolean;
  location: Loc | null; created_at: string; sync: SyncState; attempts: number; last_error?: string;
  server_status?: string; server_priority?: string; server_squad?: string | null; synced_at?: string;
}

class RescueDB extends Dexie {
  sos!: Table<LocalSos, string>;
  broadcasts!: Table<Broadcast, string>;
  constructor() {
    super("rescueai");
    this.version(1).stores({ sos: "id, sync, created_at", broadcasts: "id, ts" });
  }
}
export const db = new RescueDB();
