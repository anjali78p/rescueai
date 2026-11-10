export type Priority = "low" | "medium" | "high" | "critical";
export type Status = "new" | "accepted" | "en_route" | "reached" | "resolved";
export type Role = "citizen" | "rescue" | "eoc";
export interface User { id: string; email: string; name: string; role: Role }
export interface Loc { lat: number; lng: number; accuracy?: number | null; captured_at?: string }
export interface HistoryItem { ts: string; status: Status; actor: string; note: string }
export interface Incident {
  id: string; citizen_name: string; severity: Priority; priority: Priority; ai_priority: Priority; score: number;
  message: string; summary: string; people: number | null; incident_type: string; medical_urgency: string;
  trapped: boolean; reasons: string[]; triage_source: string; location: Loc | null; location_at_sync: Loc | null;
  created_at: string; received_at: string; status: Status; squad_id: string | null; squad_name: string | null;
  profile: { phone?: string; emergency_contact?: string; medical_notes?: string } | null; history: HistoryItem[];
}
export interface Squad { id: string; name: string; kind: string; busy: boolean }
export interface Broadcast { id: string; ts: string; title: string; message: string; level: "info" | "warning" | "critical"; author: string }
export interface AuditEntry { id: string; ts: string; actor_name: string; role: Role; action: string; target: string | null; detail: Record<string, unknown> }
export interface Stats { total: number; by_status: Record<Status, number>; by_priority: Record<Priority, number>; avg_minutes_to_accept: number | null }
export const STATUS_LABEL: Record<Status, string> = { new: "New", accepted: "Accepted", en_route: "En route", reached: "Reached", resolved: "Resolved" };
export const NEXT_STATUS: Partial<Record<Status, { to: Status; label: string }>> = {
  new: { to: "accepted", label: "Accept" }, accepted: { to: "en_route", label: "Mark en route" },
  en_route: { to: "reached", label: "Mark reached" }, reached: { to: "resolved", label: "Resolve" },
};
