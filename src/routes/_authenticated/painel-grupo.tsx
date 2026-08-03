// FASE F7-D — Painel do Grupo: visão corporativa consolidada do proprietário/administrador.
// Todos os números vêm de dados reais visíveis pela RLS. Sem simulação.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink } from "lucide-react";
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
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { RequirePermission } from "@/components/gmos/permission-gate";
import {
  KpiHealthBadge,
  KpiHealthBar,
  MetricTile,
  Section,
} from "@/components/gmos/dashboard-blocks";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { fmtDate } from "@/lib/gmos/f2";
import {
  EMPTY_FILTERS,
  auditLabel,
  criticalKpis,
  fetchGroupDashboard,
  healthByCompany,
  kpiHealth,
  latestValidated,
  pendingMeasurements,
  summarizeActions,
  summarizeKpis,
  summarizeRisks,
  summarizeRoutines,
  type GroupFilters,
} from "@/lib/gmos/group-dashboard";
import { todayIso } from "@/lib/gmos/my-work";

export const Route = createFileRoute("/_authenticated/painel-grupo")({
  head: () => ({
    meta: [
      { title: "Painel do Grupo — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Visão corporativa consolidada do Grupo Moitinho: indicadores, planos de ação, rotinas, riscos e auditoria por empresa e período.",
      },
      { property: "og:title", content: "Painel do Grupo — GMOS" },
      {
        property: "og:description",
        content:
          "Consolidado corporativo de indicadores, ações, rotinas e riscos do Grupo Moitinho.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="dashboard.group" area="acessar o painel do Grupo">
      <GroupPanel />
    </RequirePermission>
  ),
});

function GroupPanel() {
  const { can, primaryRoleLabel } = useAuth();
  const { selectUnit } = useWorkspace();
  const [filters, setFilters] = useState<GroupFilters>(EMPTY_FILTERS);
  const today = todayIso();
  const includeAudit = can("audit.read");

  const q = useQuery({
    queryKey: ["gmos", "group-dashboard", filters, includeAudit],
    queryFn: () => fetchGroupDashboard(filters, { includeAudit }),
    retry: false,
  });

  const data = q.data;
  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of data?.allUnits ?? []) map.set(u.companyId, u.companyName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [data?.allUnits]);
  const unitOptions = (data?.allUnits ?? []).filter(
    (u) => !filters.companyId || u.companyId === filters.companyId,
  );

  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!data) return null;

  const kpiSummary = summarizeKpis(data.kpis, data.measurements);
  const actionSummary = summarizeActions(data.actions, today);
  const routineSummary = summarizeRoutines(data.executions, today);
  const riskSummary = summarizeRisks(data.risks);
  const pending = pendingMeasurements(data.measurements);
  const critical = criticalKpis(data.kpis, data.measurements);
  const perCompany = healthByCompany(data, today);

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Painel do Grupo" }]}
        title="Painel do Grupo"
        description="Consolidado corporativo de indicadores, planos de ação, rotinas e riscos, construído somente com dados reais já registrados."
        context={`${primaryRoleLabel} · ${data.units.length} filial(is) no recorte atual`}
        actions={<Badge variant="outline">Atualizado agora</Badge>}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="filtro-empresa">Empresa</Label>
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
              <SelectTrigger id="filtro-empresa">
                <SelectValue placeholder="Todas as empresas" />
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
          <div className="space-y-1">
            <Label htmlFor="filtro-unidade">Filial</Label>
            <Select
              value={filters.businessUnitId ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, businessUnitId: v === "all" ? null : v }))
              }
            >
              <SelectTrigger id="filtro-unidade">
                <SelectValue placeholder="Todas as filiais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as filiais</SelectItem>
                {unitOptions.map((u) => (
                  <SelectItem key={u.businessUnitId} value={u.businessUnitId}>
                    {u.businessUnitName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-de">Período de</Label>
            <Input
              id="filtro-de"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-ate">Período até</Label>
            <Input
              id="filtro-ate"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {data.units.length === 0 ? (
        <StateCard
          title="Nenhuma filial no recorte selecionado"
          description="Ajuste os filtros de empresa e filial para visualizar dados consolidados."
        />
      ) : null}

      <Section
        title="Consolidado corporativo"
        description="Indicadores consideram somente medições validadas; nada é estimado."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Indicadores"
            value={data.kpis.length}
            hint={`${kpiSummary.no_measurement} sem medição validada`}
          />
          <MetricTile
            label="Medições pendentes"
            value={pending.length}
            hint="Aguardando validação"
            tone={pending.length > 0 ? "warning" : "default"}
          />
          <MetricTile
            label="Planos de ação"
            value={actionSummary.total}
            hint={`${actionSummary.late} em atraso · ${actionSummary.averageProgress}% médio`}
            tone={actionSummary.late > 0 ? "danger" : "default"}
          />
          <MetricTile
            label="Aderência de rotinas"
            value={routineSummary.adherence === null ? "—" : `${routineSummary.adherence}%`}
            hint={`${routineSummary.planned} previstas · ${routineSummary.late} em atraso`}
            tone={routineSummary.late > 0 ? "warning" : "success"}
          />
        </div>
        <KpiHealthBar summary={kpiSummary} />
      </Section>

      <Section
        title="Saúde por empresa"
        description="Do consolidado para cada empresa e filial, com navegação direta."
      >
        {perCompany.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma empresa no recorte atual.</p>
        ) : (
          <div className="space-y-3">
            {perCompany.map((c) => (
              <Card key={c.companyId}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Building2 className="h-4 w-4 text-primary" aria-hidden />
                      {c.companyName}
                    </h3>
                    <Badge variant="secondary">{c.units.length} filial(is)</Badge>
                  </div>
                  <KpiHealthBar summary={c.kpis} />
                  <p className="text-xs text-muted-foreground">
                    {c.actions.total} plano(s) de ação · {c.actions.late} em atraso ·{" "}
                    {c.routines.adherence === null
                      ? "sem rotinas previstas"
                      : `${c.routines.adherence}% de aderência`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {c.units.map((u) => (
                      <Button
                        key={u.businessUnitId}
                        asChild
                        size="sm"
                        variant="outline"
                        onClick={() => selectUnit(u.businessUnitId)}
                      >
                        <Link to="/planejamento">
                          {u.businessUnitName}
                          <ExternalLink className="ml-2 h-3 w-3" aria-hidden />
                        </Link>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Indicadores em atenção e críticos"
        description="Baseado na última medição validada de cada indicador."
      >
        {critical.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum indicador crítico ou em atenção com medição validada no recorte atual.
          </p>
        ) : (
          <div className="space-y-2">
            {critical.slice(0, 10).map(({ kpi, measurement, health }) => (
              <Card key={kpi.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{kpi.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Última competência validada {fmtDate(measurement.periodEnd)} ·{" "}
                      {measurement.value}
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

      <Section title="Riscos ativos" description="Severidade derivada de impacto e probabilidade.">
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricTile label="Críticos" value={riskSummary.critical} tone="danger" />
          <MetricTile label="Altos" value={riskSummary.high} tone="warning" />
          <MetricTile label="Médios" value={riskSummary.medium} />
          <MetricTile label="Baixos" value={riskSummary.low} />
        </div>
      </Section>

      {includeAudit ? (
        <Section
          title="Auditoria recente"
          description="Eventos registrados automaticamente pelo banco, sem exposição de conteúdo sensível."
        >
          {data.audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento visível no momento.</p>
          ) : (
            <ul className="space-y-2">
              {data.audit.map((row) => (
                <li key={row.id} className="rounded-md border p-3 text-sm">
                  <span className="font-medium">{auditLabel(row)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {fmtDate(row.occurredAt)} · {row.eventType}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}
