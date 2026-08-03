// FASE F7-A/F7-B — contexto de autenticação e autorização real, tipado.
// A fonte de verdade é o banco: public.gmos_my_authorization + RLS + public.has_permission.
// Não há e-mail, papel ou permissão codificados no frontend: nada aqui concede acesso.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAuthorization,
  fetchAuthorization,
  type Authorization,
  type AuthorizationPayload,
  type RoleAssignment,
  type ScopeNode,
} from "@/lib/gmos/rbac";

export type InternalUser = {
  /** id em public.users (não é o id de autenticação). */
  id: string | null;
  status: string | null;
  organizationId: string | null;
};

export type AuthContextValue = {
  /** Sessão de autenticação. */
  user: User | null;
  /** Cadastro interno correspondente em public.users. */
  internalUser: InternalUser | null;
  authorization: Authorization | null;
  payload: AuthorizationPayload | null;
  roles: string[];
  assignments: RoleAssignment[];
  permissions: string[];
  scopes: ScopeNode[];
  primaryRole: string | null;
  primaryRoleLabel: string;
  isGroupOwner: boolean;
  isGroupAdmin: boolean;
  isGroupPrivileged: boolean;
  isManager: boolean;
  isCollaborator: boolean;
  /** true quando o usuário está autenticado mas não possui atribuição ativa. */
  hasNoAssignment: boolean;
  can: (permissionCode: string, scopeId?: string | null) => boolean;
  /** true enquanto sessão ou autorização ainda não foram resolvidas. */
  loading: boolean;
  error: unknown;
  refresh: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      setUser(session?.user ?? null);
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") {
        void qc.invalidateQueries({ queryKey: ["gmos", "authorization"] });
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setSessionLoading(false);
      });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const authzQuery = useQuery({
    queryKey: ["gmos", "authorization", user?.id ?? null],
    queryFn: fetchAuthorization,
    enabled: Boolean(user),
    retry: false,
    staleTime: 60_000,
  });

  const authorization = useMemo(
    () => (authzQuery.data ? buildAuthorization(authzQuery.data) : null),
    [authzQuery.data],
  );

  const value = useMemo<AuthContextValue>(() => {
    const payload = authzQuery.data ?? null;
    const loading = sessionLoading || (Boolean(user) && authzQuery.isPending);
    return {
      user,
      internalUser: payload
        ? {
            id: payload.userId,
            status: payload.userStatus,
            organizationId: payload.organizationId,
          }
        : null,
      authorization,
      payload,
      roles: authorization?.roles ?? [],
      assignments: payload?.assignments ?? [],
      permissions: authorization?.permissions ?? [],
      scopes: payload?.scopes ?? [],
      primaryRole: authorization?.primaryRole ?? null,
      primaryRoleLabel: authorization?.primaryRoleLabel ?? "Sem papel atribuído",
      isGroupOwner: authorization?.isGroupOwner ?? false,
      isGroupAdmin: authorization?.isGroupAdmin ?? false,
      isGroupPrivileged: authorization?.isGroupPrivileged ?? false,
      isManager: authorization?.isManager ?? false,
      isCollaborator: authorization?.isCollaborator ?? false,
      hasNoAssignment: Boolean(user) && !loading && authorization?.hasAnyAssignment === false,
      can: (permissionCode, scopeId) =>
        authorization ? authorization.can(permissionCode, scopeId ?? undefined) : false,
      loading,
      error: authzQuery.error ?? null,
      refresh: () => void authzQuery.refetch(),
      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          /* sessão já inválida — segue para o redirect */
        }
      },
    };
  }, [user, sessionLoading, authorization, authzQuery]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return v;
}