// FASE F7 — Painel do Grupo: visão integral do proprietário/administrador.
// Leitura consolidada com filtros de empresa, unidade e período. Somente dados reais.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  Gauge,
  ListChecks,
  Network,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/gmos/page-header";
import { ExecutiveMetric } from "@/components/gmos/executive-metric";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { RoleBadge, RouteGuard, useAuthz } from "@/components/gmos/authz-context";
import { useWorkspace } from "@/components/gmos/workspace-context";
import {
  KPI_SITUATION_LABEL,
  SEVERITY_LABEL,
  aggregateGroupDashboard,
  auditLabel,
  fetchGroupRaw,
  todayFilterIso,
  type GroupFilters,
} from "@/lib/gmos/group-dashboard";

export const Route = createFileRoute("/_authenticated/painel-grupo")({
  head: () => ({
    meta: [
      { title: "Painel do Grupo — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Painel integral do Grupo Moitinho: KPIs, planos de ação, rotinas, riscos e auditoria consolidados.",
      },
      { property: "og:title", content: "Painel do Grupo — GMOS · Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Painel integral do Grupo Moitinho: KPIs, planos de ação, rotinas, riscos e auditoria consolidados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelGrupoPage,
});

function PainelGrupoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Painel do Grupo" }]}
        title="Painel do Grupo"
        description="Visão integral das empresas do Grupo Moitinho, com foco no que exige decisão."
        actions={<RoleBadge />}
      />
      <RouteGuard permission="dashboard.group" area="ver o painel corporativo do Grupo">
        <GroupContent />
      </RouteGuard>
    </div>
  );
}

function GroupContent() {
  const { authz } = useAuthz();
  const { options } = useWorkspace();
  const [filters, setFilters] = useState<GroupFilters>({
    companyId: null,
    businessUnitId: null,
    from: null,
    to: null,
  });

  const canAudit = Boolean(authz?.can("audit.read"));

  const query = useQuery({
    queryKey: ["gmos", "group-dashboard", filters, canAudit],
    queryFn: () => fetchGroupRaw(filters, canAudit),
    retry: false,
  });

  const dashboard = useMemo(
    () => (query.data ? aggregateGroupDashboard(query.data, todayFilterIso()) : null),
    [query.data],
  );

  const companies = Array.from(
    new Map(options.map((o) => [o.companyId, o.companyName])).entries(),
  ).map(([id, name]) => ({ id, name }));
  const units = options.filter((o) => !filters.companyId || o.companyId === filters.companyId);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Select
              value={filters.companyId ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  companyId: v === "all" ? null : v,
                  businessUnitId: null,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Filial</Label>
            <Select
              value={filters.businessUnitId ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, businessUnitId: v === "all" ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as filiais</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.businessUnitId} value={u.businessUnitId}>
                    {u.businessUnitName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="de">Período — de</Label>
            <Input
              id="de"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ate">Período — até</Label>
            <Input
              id="ate"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                setFilters({ companyId: null, businessUnitId: null, from: null, to: null })
              }
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {query.isPending ? <LoadingBlock rows={3} /> : null}
      {query.error ? <ErrorBlock error={query.error} onRetry={() => query.refetch()} /> : null}

      {dashboard && dashboard.summary.units === 0 ? (
        <StateCard
          title="Nenhuma filial no filtro selecionado"
          description="Ajuste os filtros de empresa e filial para visualizar dados consolidados."
        />
      ) : null}

      {dashboard && dashboard.summary.units > 0 ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Consolidado
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ExecutiveMetric
                label="Empresas"
                value={dashboard.summary.companies}
                icon={<Building2 className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Filiais"
                value={dashboard.summary.units}
                icon={<Network className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="KPIs no alvo"
                value={dashboard.summary.kpis.on_target}
                hint={`${dashboard.summary.kpis.critical} críticos · ${dashboard.summary.kpis.no_data} sem medição validada`}
                icon={<Gauge className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Planos de ação"
                value={dashboard.summary.actionsTotal}
                hint={`${dashboard.summary.actionsLate} em atraso · ${dashboard.summary.actionsDone} concluídos`}
                icon={<ListChecks className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Execuções de rotina"
                value={dashboard.summary.routinesTotal}
                hint={`${dashboard.summary.routinesDone} registradas · ${dashboard.summary.routinesPending} abertas`}
                icon={<CalendarClock className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Rotinas vencidas"
                value={dashboard.summary.routinesLate}
                tone={dashboard.summary.routinesLate > 0 ? "alert" : undefined}
                icon={<TriangleAlert className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Medições aguardando validação"
                value={dashboard.summary.measurementsPending}
                icon={<Gauge className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Progresso médio das ações"
                value={
                  dashboard.summary.actionsProgress === null
                    ? "—"
                    : `${dashboard.summary.actionsProgress}%`
                }
                icon={<ListChecks className="h-4 w-4 text-brand-accent" />}
              />
            </div>
            {Object.keys(dashboard.summary.risksBySeverity).length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-brand-accent" aria-hidden />
                <span className="text-sm text-muted-foreground">Riscos ativos:</span>
                {Object.entries(dashboard.summary.risksBySeverity).map(([sev, count]) => (
                  <Badge key={sev} variant={sev === "critical" ? "destructive" : "secondary"}>
                    {SEVERITY_LABEL[sev] ?? sev}: {count}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Saúde por empresa
            </h2>
            {dashboard.companies.map((c) => (
              <Card key={c.companyId}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{c.companyName}</span>
                    <Badge variant="outline">{c.units} filiais</Badge>
                    <Badge variant={c.actionsLate > 0 ? "destructive" : "secondary"}>
                      {c.actionsLate} ações em atraso
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    KPIs — {KPI_SITUATION_LABEL.on_target}: {c.kpis.on_target} ·{" "}
                    {KPI_SITUATION_LABEL.attention}: {c.kpis.attention} ·{" "}
                    {KPI_SITUATION_LABEL.critical}: {c.kpis.critical} ·{" "}
                    {KPI_SITUATION_LABEL.no_data}: {c.kpis.no_data}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aderência às rotinas no período:{" "}
                    {c.adherence === null ? "sem execuções no período" : `${c.adherence}%`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Onde agir agora
            </h2>
            {dashboard.attention.length === 0 ? (
              <StateCard
                title="Nenhum ponto crítico no filtro atual"
                description="Não há indicadores críticos, riscos altos, planos vencidos ou rotinas em atraso no período selecionado."
              />
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {dashboard.attention.slice(0, 25).map((item) => (
                    <div key={`${item.kind}-${item.id}`} className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                        <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.companyName} › {item.unitName} — {item.detail}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>

          {canAudit ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Auditoria recente
              </h2>
              {dashboard.audit.length === 0 ? (
                <StateCard
                  title="Sem eventos recentes"
                  description="Nenhum evento de auditoria disponível para o seu perfil neste momento."
                />
              ) : (
                <Card>
                  <CardContent className="divide-y p-0">
                    {dashboard.audit.map((e) => (
                      <div
                        key={e.id}
                        className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">{auditLabel(e)}</span>
                        <span className="text-xs text-muted-foreground">{e.entityType}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.occurredAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  kpi: "Indicador crítico",
  risk: "Risco",
  action: "Plano de ação",
  routine: "Rotina",
  measurement: "Medição",
};