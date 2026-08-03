// FASE F7-D — Painel da equipe: escopo do gestor (filial selecionada) e seus descendentes.
// A visibilidade é da RLS; o filtro por filial é apenas recorte de leitura.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gmos/page-header";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { RequirePermission } from "@/components/gmos/permission-gate";
import { KpiHealthBadge, KpiHealthBar, MetricTile, Section } from "@/components/gmos/dashboard-blocks";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { EXECUTION_STATUS, PLAN_STATUS, fmtDate } from "@/lib/gmos/f2";
import {
  criticalKpis,
  fetchGroupDashboard,
  isActionLate,
  isExecutionLate,
  pendingMeasurements,
  summarizeActions,
  summarizeKpis,
  summarizeRoutines,
} from "@/lib/gmos/group-dashboard";
import { todayIso } from "@/lib/gmos/my-work";

export const Route = createFileRoute("/_authenticated/painel-equipe")({
  head: () => ({
    meta: [
      { title: "Painel da equipe — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Painel do gestor no GMOS: rotinas pendentes e atrasadas, planos de ação, indicadores e medições aguardando validação na filial selecionada.",
      },
      { property: "og:title", content: "Painel da equipe — GMOS" },
      {
        property: "og:description",
        content: "Rotinas, planos de ação e indicadores da equipe na filial selecionada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="dashboard.team" area="acessar o painel da equipe">
      <TeamPanel />
    </RequirePermission>
  ),
});

function TeamPanel() {
  const { workspace, isPending: wsPending, error: wsError, refetch } = useWorkspace();
  const today = todayIso();
  const unitId = workspace?.businessUnitId ?? null;

  const q = useQuery({
    queryKey: ["gmos", "team-dashboard", unitId],
    queryFn: () =>
      fetchGroupDashboard({
        companyId: workspace!.companyId,
        businessUnitId: unitId!,
        from: null,
        to: null,
      }),
    enabled: Boolean(unitId),
    retry: false,
  });

  if (wsPending) return <LoadingBlock rows={3} />;
  if (wsError) return <ErrorBlock error={wsError} onRetry={refetch} />;
  if (!workspace) {
    return (
      <StateCard
        title="Nenhuma filial disponível"
        description="Seu usuário ainda não possui escopo de empresa ou filial atribuído. Solicite a liberação ao proprietário ou administrador do Grupo."
      />
    );
  }
  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data!;

  const kpiSummary = summarizeKpis(data.kpis, data.measurements);
  const actionSummary = summarizeActions(data.actions, today);
  const routineSummary = summarizeRoutines(data.executions, today);
  const pending = pendingMeasurements(data.measurements);
  const critical = criticalKpis(data.kpis, data.measurements);
  const lateExecutions = data.executions.filter((e) => isExecutionLate(e, today));
  const lateActions = data.actions.filter((a) => isActionLate(a, today));
  const templateName = new Map(data.kpis.map((k) => [k.id, k.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Painel da equipe" }]}
        title="Painel da equipe"
        description="Situação real da sua filial: rotinas, planos de ação, indicadores e validações pendentes."
        context={`${workspace.companyName} · ${workspace.businessUnitName}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/rotinas">
              <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
              Gerenciar rotinas
            </Link>
          </Button>
        }
      />

      <Section title="Situação da equipe" description="Somente medições validadas alimentam o semáforo.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Rotinas pendentes"
            value={routineSummary.pending}
            hint={`${routineSummary.planned} previstas no total`}
          />
          <MetricTile
            label="Rotinas em atraso"
            value={routineSummary.late}
            tone={routineSummary.late > 0 ? "danger" : "success"}
            hint={
              routineSummary.adherence === null
                ? "Sem rotinas previstas"
                : `${routineSummary.adherence}% de aderência`
            }
          />
          <MetricTile
            label="Planos de ação"
            value={actionSummary.total}
            hint={`${actionSummary.late} em atraso · ${actionSummary.averageProgress}% médio`}
            tone={actionSummary.late > 0 ? "warning" : "default"}
          />
          <MetricTile
            label="Medições a validar"
            value={pending.length}
            tone={pending.length > 0 ? "warning" : "default"}
            hint="Aguardando validação do gestor"
          />
        </div>
        <KpiHealthBar summary={kpiSummary} />
      </Section>

      <Section
        title="Rotinas em atraso"
        description="Execuções da equipe com prazo vencido e ainda não concluídas."
      >
        {lateExecutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução em atraso nesta filial.</p>
        ) : (
          <div className="space-y-2">
            {lateExecutions.slice(0, 12).map((e) => (
              <Card key={e.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      Competência {fmtDate(e.competenceDate)} · Prazo {fmtDate(e.dueDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.ownerUserId ? "Responsável atribuído" : "Responsável a definir"}
                    </p>
                  </div>
                  <Badge variant="destructive">{EXECUTION_STATUS[e.status] ?? e.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Planos de ação em atraso" description="Ações da equipe com prazo vencido.">
        {lateActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum plano de ação em atraso.</p>
        ) : (
          <div className="space-y-2">
            {lateActions.slice(0, 12).map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Prazo {fmtDate(a.dueDate)} · {a.progress}% concluído
                    </p>
                  </div>
                  <Badge variant="outline">{PLAN_STATUS[a.status] ?? a.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/planos-de-acao">
            <ListChecks className="mr-2 h-4 w-4" aria-hidden />
            Abrir planos de ação
          </Link>
        </Button>
      </Section>

      <Section
        title="Indicadores que exigem atenção"
        description="Última medição validada de cada indicador da filial."
      >
        {critical.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum indicador crítico ou em atenção com medição validada.
          </p>
        ) : (
          <div className="space-y-2">
            {critical.slice(0, 10).map(({ kpi, measurement, health }) => (
              <Card key={kpi.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {templateName.get(kpi.id) ?? kpi.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(measurement.periodEnd)} · {measurement.value}
                      {kpi.unit ? ` ${kpi.unit}` : ""}
                    </p>
                  </div>
                  <KpiHealthBadge health={health} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {pending.length > 0 ? (
        <Section
          title="Medições aguardando validação"
          description="Enquanto não validadas, não entram no semáforo nem nos painéis executivos."
        >
          <div className="space-y-2">
            {pending.slice(0, 10).map((m) => (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {data.kpis.find((k) => k.id === m.kpiId)?.name ?? "Indicador"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Competência {fmtDate(m.periodEnd)} · valor {m.value}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                    Pendente
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/planejamento">Abrir planejamento e medições</Link>
          </Button>
        </Section>
      ) : null}
    </div>
  );
}
