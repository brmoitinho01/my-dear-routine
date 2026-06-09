import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gerente" | "lider_setor" | "operador";
export type SectorKind = "salao" | "cozinha" | "bar";
export interface Sector { id: string; name: string; kind: SectorKind }

interface AuthCtx {
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  sectors: Sector[];
  profile: { full_name: string | null; primary_sector_id: string | null } | null;
  isAdmin: boolean;
  isManager: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [profile, setProfile] = useState<AuthCtx["profile"]>(null);

  async function loadMeta(uid: string) {
    const [{ data: rolesData }, { data: profileData }, { data: sectorsData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("users_profile").select("full_name, primary_sector_id").eq("id", uid).maybeSingle(),
      supabase.from("sectors").select("id, name, kind").order("name"),
    ]);
    setRoles(((rolesData ?? []) as { role: AppRole }[]).map((r) => r.role));
    setProfile(profileData ?? null);
    setSectors((sectorsData ?? []) as Sector[]);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) await loadMeta(u.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadMeta(u.id); else { setRoles([]); setProfile(null); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const value: AuthCtx = {
    user, loading, roles, sectors, profile,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("admin") || roles.includes("gerente"),
    refresh: async () => { if (user) await loadMeta(user.id); },
    signOut: async () => { await supabase.auth.signOut(); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  gerente: "Gerente",
  lider_setor: "Líder de Setor",
  operador: "Operador",
};

export const SECTOR_LABEL: Record<SectorKind, string> = {
  salao: "Salão",
  cozinha: "Cozinha",
  bar: "Bar",
};