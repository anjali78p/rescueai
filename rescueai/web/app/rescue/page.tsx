"use client";
import IncidentBoard from "@/components/IncidentBoard";
import { NetBadge, Shell, useGuard, useReachable } from "@/components/ui";

export default function Rescue() {
  const { token, ok } = useGuard("rescue");
  const reachable = useReachable();
  if (!ok || !token) return null;
  return <Shell role="rescue" title="Rescue command" net={<NetBadge ok={reachable} />}><IncidentBoard token={token} /></Shell>;
}
