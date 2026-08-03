// FASE F7 — Painel do gestor: sua empresa/filial e descendentes de escopo.
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Gauge, ListChecks, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/gmos/page-header";
import { ExecutiveMetric } from "@/components/gmos/executive-metric";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { RoleBadge, RouteGuard } from "@/components/gmos/authz-context";
import { useWorkspace } from "@/components/gmos/workspace-context";
import {
  KPI_SITUATION_LABEL,
  aggregateGroupDashboard,
  fetchGroupRaw,
  todayFilterIso,
} from "@/lib/gmos/group-dashboard";

export const Route = createFileRoute("/_authenticated/painel-equipe")({
  head: () => ({
    meta: [
      { title: "Painel da equipe — GMOS" },
      {
        name: "description",
        content:
          "Painel do gestor no GMOS: indicadores, planos de ação e rotinas da filial sob sua responsabilidade.",
      },
      { property: "og:title", content: "Painel da equipe — GMOS" },
      {
        property: "og:description",
        content:
          "Painel do gestor no GMOS: indicadores, planos de ação e rotinas da filial sob sua responsabilidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelEquipePage,
});

function PainelEquipePage() {
  const { workspace } = useWorkspace();
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Painel da equipe" }]}
        title="Painel da equipe"
        description="Indicadores, planos e rotinas da filial selecionada, conforme o seu escopo autorizado."
        context={
          workspace ? `${workspace.companyName} › ${workspace.businessUnitName}` : null
        }
        actions={<RoleBadge />}
      />
      <RouteGuard permission="dashboard.team" area="ver o painel da equipe">
        <TeamContent />
      </RouteGuard>
    </div>
  );
}

function TeamContent() {
  const { workspace } = useWorkspace();
  const businessUnitId = workspace?.businessUnitId ?? null;

  const query = useQuery({
    queryKey: ["gmos", "team-dashboard", businessUnitId],
    queryFn: () =>
      fetchGroupRaw(
        { companyId: null, businessUnitId, from: null, to: null },
        false,
      ),
    enabled: Boolean(businessUnitId),
    retry: false,
  });

  const dashboard = useMemo(
    () => (query.data ? aggregateGroupDashboard(query.data, todayFilterIso()) : null),
    [query.data],
  );

  if (!businessUnitId)
    return (
      <StateCard
        title="Nenhuma filial visível"
        description="Seu perfil não possui escopo com filial atribuída. Solicite acesso ao proprietário ou administrador do Grupo."
      />
    );
  if (query.isPending) return <LoadingBlock rows={3} />;
  if (query.error) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;
  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ExecutiveMetric
          label="KPIs no alvo"
          value={dashboard.summary.kpis.on_target}
          hint={`${dashboard.summary.kpis.critical} críticos`}
          icon={<Gauge className="h-4 w-4 text-brand-accent" />}
        />
        <ExecutiveMetric
          label="Planos de ação"
          value={dashboard.summary.actionsTotal}
          hint={`${dashboard.summary.actionsLate} em atraso`}
          icon={<ListChecks className="h-4 w-4 text-brand-accent" />}
        />
        <ExecutiveMetric
          label="Execuções de rotina"
          value={dashboard.summary.routinesTotal}
          hint={`${dashboard.summary.routinesPending} abertas`}
          icon={<CalendarClock className="h-4 w-4 text-brand-accent" />}
        />
        <ExecutiveMetric
          label="Rotinas vencidas"
          value={dashboard.summary.routinesLate}
          tone={dashboard.summary.routinesLate > 0 ? "alert" : undefined}
          icon={<TriangleAlert className="h-4 w-4 text-brand-accent" />}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        KPIs — {KPI_SITUATION_LABEL.attention}: {dashboard.summary.kpis.attention} ·{" "}
        {KPI_SITUATION_LABEL.no_data}: {dashboard.summary.kpis.no_data} · Medições aguardando
        validação: {dashboard.summary.measurementsPending}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pontos de atenção da sua área
        </h2>
        {dashboard.attention.length === 0 ? (
          <StateCard
            title="Nenhum ponto crítico"
            description="Não há indicadores críticos, planos vencidos ou rotinas em atraso na filial selecionada."
          />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {dashboard.attention.slice(0, 20).map((item) => (
                <div key={`${item.kind}-${item.id}`} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                    <Badge variant="outline">{item.kind}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}