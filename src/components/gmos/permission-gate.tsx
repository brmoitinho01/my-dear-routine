// FASE F7-B — controles de exibição por permissão.
// A interface apenas esconde o que o banco já não autoriza: a decisão real é da RLS.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/gmos/states";
import { useAuth } from "@/lib/auth-context";

/** Tela profissional de acesso negado. Não expõe detalhes técnicos de policy. */
export function AccessDenied({
  area,
  reason = "permission",
}: {
  area?: string;
  reason?: "permission" | "no-assignment";
}) {
  const noAssignment = reason === "no-assignment";
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-3 p-6">
        <div className="flex items-center gap-2">
          {noAssignment ? (
            <ShieldOff className="h-5 w-5 text-muted-foreground" aria-hidden />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
          <h2 className="text-base font-semibold">
            {noAssignment ? "Acesso ainda não liberado" : "Você não tem acesso a esta área"}
          </h2>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          {noAssignment
            ? "Seu login está ativo, porém nenhum papel foi atribuído ao seu usuário no GMOS. Solicite a liberação ao proprietário ou ao administrador do Grupo."
            : `Seu perfil não possui permissão para ${area ?? "esta área"}. Solicite a liberação ao proprietário ou ao administrador do Grupo.`}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link to="/acessos">Ver meus acessos</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Esconde um trecho da interface quando falta permissão.
 * `scopeId` restringe a verificação a um escopo e seus ancestrais concedidos.
 */
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
  const { can, loading } = useAuth();
  if (loading) return null;
  if (!can(permission, scopeId)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Aguarda a autorização e bloqueia usuários sem atribuição ativa. */
export function AuthorizationGate({ children }: { children: ReactNode }) {
  const { loading, error, refresh, hasNoAssignment } = useAuth();
  if (loading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock error={error} onRetry={refresh} />;
  if (hasNoAssignment) return <AccessDenied reason="no-assignment" />;
  return <>{children}</>;
}

/** Bloqueia uma área inteira por permissão. */
export function RequirePermission({
  permission,
  area,
  children,
}: {
  permission: string;
  area?: string;
  children: ReactNode;
}) {
  const { loading, error, refresh, hasNoAssignment, can } = useAuth();
  if (loading) return <LoadingBlock rows={3} />;
  if (error) return <ErrorBlock error={error} onRetry={refresh} />;
  if (hasNoAssignment) return <AccessDenied reason="no-assignment" />;
  if (!can(permission)) return <AccessDenied area={area} />;
  return <>{children}</>;
}

/** Selo do papel principal do usuário autenticado. */
export function RoleBadge({ className }: { className?: string }) {
  const { primaryRoleLabel, loading } = useAuth();
  if (loading) return null;
  return (
    <Badge variant="secondary" className={className}>
      <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
      {primaryRoleLabel}
    </Badge>
  );
}