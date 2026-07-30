import { AlertTriangle, Loader2, Lock, LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionError, SessionExpiredError } from "@/lib/gmos/structure";

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando dados…
      </div>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof SessionExpiredError) {
    return (
      <StateCard
        icon={<LogIn className="h-5 w-5 text-destructive" />}
        title="Sessão expirada"
        description="Sua sessão não é mais válida. Entre novamente para continuar."
      >
        <Button asChild size="sm">
          <Link to="/auth">Entrar novamente</Link>
        </Button>
      </StateCard>
    );
  }

  if (error instanceof PermissionError) {
    return (
      <StateCard
        icon={<Lock className="h-5 w-5 text-muted-foreground" />}
        title="Sem permissão"
        description="Seu perfil não possui permissão para visualizar estas informações. Solicite acesso ao administrador do Grupo."
      />
    );
  }

  const message = error instanceof Error ? error.message : "Não foi possível carregar os dados.";

  return (
    <StateCard
      icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
      title="Falha ao carregar"
      description={message}
    >
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </StateCard>
  );
}

export function StateCard({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-2 p-5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        {children ? <div className="pt-2">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
