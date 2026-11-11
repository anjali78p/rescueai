"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AuthCtx { user: User | null; token: string | null; ready: boolean; signIn: (path: "login" | "register", body: object) => Promise<User>; signOut: () => void }
const Ctx = createContext<AuthCtx>(null!);
const KEY = "rescueai.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; token: string | null }>({ user: null, token: null });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setState(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);
  const signIn = useCallback(async (path: "login" | "register", body: object) => {
    const res = await api<{ token: string; user: User }>(`/auth/${path}`, { body });
    setState(res); localStorage.setItem(KEY, JSON.stringify(res)); return res.user;
  }, []);
  const signOut = useCallback(() => { setState({ user: null, token: null }); localStorage.removeItem(KEY); }, []);
  return <Ctx.Provider value={{ ...state, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
