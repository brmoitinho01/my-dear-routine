// FASE F1 — visao geral da estrutura organizacional (somente leitura).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Layers, ArrowRight, Building2, Network } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchStructure } from "@/lib/gmos/structure";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GMOS — Visão geral do Grupo Moitinho" },
      {
        name: "description",
        content:
          "Visão geral do Grupo Moitinho Operating System: estrutura organizacional e estado da Fase 1.",
      },
      { property: "og:title", content: "GMOS — Visão geral do Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Visão geral do Grupo Moitinho Operating System: estrutura organizacional e estado da Fase 1.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { user } = useAuth();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["gmos", "structure"],
    queryFn: fetchStructure,
    retry: false,
  });

  return (
    <div className="space-y-6">
      <header>
        <Badge variant="secondary" className="mb-3">
          Fase 1 — Estrutura organizacional
        </Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {data?.organization?.name ?? "Grupo Moitinho"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Grupo Moitinho Operating System — ambiente corporativo interno.
        </p>
      </header>

      {isPending ? <LoadingBlock rows={2} /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric
              label="Empresas"
              value={data.counts.companies}
              icon={<Building2 className="h-4 w-4 text-primary" />}
            />
            <Metric
              label="Unidades de negócio"
              value={data.counts.businessUnits}
              icon={<Network className="h-4 w-4 text-primary" />}
            />
            <Metric
              label="Departamentos"
              value={data.counts.departments}
              icon={<Layers className="h-4 w-4 text-primary" />}
            />
          </div>

          <Card>
            <CardContent className="divide-y p-0">
              <Row label="Usuário autenticado" value={user?.email ?? "—"} />
              <Row
                label="Etapa atual"
                value="Fase 1 — Estrutura organizacional (somente leitura)"
                icon={<ShieldCheck className="h-4 w-4 text-primary" />}
              />
              <Row
                label="Fundação"
                value="M0 — RBAC, escopos e auditoria ativos"
              />
            </CardContent>
          </Card>

          <StateCard
            title="Próximas fases"
            description="Planejamento estratégico, objetivos, KPIs e planos de ação ainda não fazem parte desta fase. Nenhum indicador é exibido aqui até que tenha origem, fórmula e responsável definidos."
          >
            <Link
              to="/estrutura"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Ver estrutura <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </StateCard>
        </>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2 break-all text-sm font-medium">
        {icon}
        {value}
      </span>
    </div>
  );
}