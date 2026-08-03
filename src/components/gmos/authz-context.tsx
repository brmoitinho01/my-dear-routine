// FASE F7 — autorização real na interface, derivada do banco.
// Nunca usa e-mail nem regra local: apenas papéis, escopos e permissões devolvidos pelo servidor.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import {
  buildAuthorization,
  fetchAuthorization,
  type Authorization,
} from "@/lib/gmos/rbac";

type AuthzContextValue = {
  authz: Authorization | null;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
};

const AuthzContext = createContext<AuthzContextValue | null>(null);

export function AuthzProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["gmos", "authorization"],
    queryFn: fetchAuthorization,
    retry: false,
    staleTime: 60_000,
  });

  const value = useMemo<AuthzContextValue>(
    () => ({
      authz: query.data ? buildAuthorization(query.data) : null,
      isPending: query.isPending,
      error: query.error ?? null,
      refetch: () => void query.refetch(),
    }),
    [query.data, query.isPending, query.error, query.refetch],
  );

  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}

export function useAuthz(): AuthzContextValue {
  const ctx = useContext(AuthzContext);
  if (!ctx) throw new Error("useAuthz deve ser usado dentro de AuthzProvider.");
  return ctx;
}

export function NoAccessCard({ area }: { area?: string }) {
  return (
    <StateCard
      title="Você não possui acesso a esta área"
      description={
        area
          ? `Seu perfil não possui permissão para ${area}. Solicite acesso ao proprietário ou administrador do Grupo.`
          : "Seu perfil não possui permissão para esta área. Solicite acesso ao proprietário ou administrador do Grupo."
      }
    />
  );
}

/** Esconde trechos da interface. A autorização efetiva continua no banco. */
export function PermissionGate({
  permission,
  scopeId,
  children,
  fallback = null,
}: {
  permission: string;
  scopeId?: string | null;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { authz } = useAuthz();
  if (!authz || !authz.can(permission, scopeId ?? undefined)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Guarda de rota: bloqueia o conteúdo inteiro quando falta permissão. */
export function RouteGuard({
  permission,
  area,
  children,
}: {
  permission: string;
  area?: string;
  children: ReactNode;
}) {
  const { authz, isPending, error, refetch } = useAuthz();
  if (isPending) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock error={error} onRetry={refetch} />;
  if (!authz || !authz.hasAnyAssignment)
    return (
      <StateCard
        title="Nenhum papel atribuído"
        description="Seu usuário está autenticado, mas ainda não possui papel ativo no GMOS. Solicite atribuição ao proprietário ou administrador do Grupo."
      />
    );
  if (!authz.can(permission)) return <NoAccessCard area={area} />;
  return <>{children}</>;
}

export function RoleBadge({ className }: { className?: string }) {
  const { authz } = useAuthz();
  if (!authz) return null;
  return (
    <Badge variant="secondary" className={className}>
      <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
      {authz.primaryRoleLabel}
    </Badge>
  );
}