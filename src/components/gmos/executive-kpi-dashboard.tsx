// FASE F8.1-C — Painel executivo de KPIs (leitura). Nenhuma escrita ou validação aqui.
// Situação da meta e validação da medição são exibidas separadamente, sem heurística.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { MetricTile } from "@/components/gmos/dashboard-blocks";
import { fetchExecutiveKpis } from "@/lib/gmos/executive-kpis-data";
import {
  EMPTY_EXECUTIVE_FILTERS,
  EXECUTIVE_KPI_STATUS_LABEL,
  MEASUREMENT_VALIDATION_LABEL,
  deriveExecutiveKpiStatus,
  filterExecutiveKpis,
  formatCompetence,
  formatExecutiveKpiTarget,
  formatExecutiveKpiValue,
  groupExecutiveKpisByCompany,
  summarizeExecutiveKpis,
  type ExecutiveKpi,
  type ExecutiveKpiFilters,
  type ExecutiveKpiStatus,
  type MeasurementValidation,
} from "@/lib/gmos/executive-kpis";
import { FREQUENCY } from "@/lib/gmos/f2";

const STATUS_VARIANT: Record<ExecutiveKpiStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    on_target: "default",
    off_target: "destructive",
    no_target: "outline",
    no_measurement: "outline",
  };

function StatusBadge({ status }: { status: ExecutiveKpiStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{EXECUTIVE_KPI_STATUS_LABEL[status]}</Badge>;
}

function ValidationNote({ status }: { status: string | null }) {
  if (!status) return null;
  const label = MEASUREMENT_VALIDATION_LABEL[status] ?? status;
  const tone =
    status === "validated"
      ? "text-muted-foreground"
      : status === "rejected"
        ? "text-destructive"
        : "text-amber-600 dark:text-amber-400";
  return <span className={`text-[11px] ${tone}`}>{label}</span>;
}

function KpiRow({ kpi }: { kpi: ExecutiveKpi }) {
  const status = deriveExecutiveKpiStatus(kpi);
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{kpi.kpiName}</p>
          <p className="text-[11px] text-muted-foreground">
            {FREQUENCY[kpi.frequency] ?? kpi.frequency}
            {kpi.planTitle ? ` · ${kpi.planTitle}` : ""}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor atual</dt>
          <dd className="font-medium tabular-nums">
            {formatExecutiveKpiValue(kpi.latestValue, kpi.unit)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Meta</dt>
          <dd className="font-medium tabular-nums">{formatExecutiveKpiTarget(kpi)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Última medição
          </dt>
          <dd className="font-medium">{formatCompetence(kpi.latestPeriodEnd)}</dd>
        </div>
      </dl>
      <div className="mt-1.5">
        <ValidationNote status={kpi.latestMeasurementStatus} />
      </div>
    </li>
  );
}

/**
 * Painel consolidado de KPIs de todas as empresas/unidades visíveis.
 * Renderizar somente quando o perfil tem `dashboard.group`.
 */
export function ExecutiveKpiDashboard() {
  const [filters, setFilters] = useState<ExecutiveKpiFilters>(EMPTY_EXECUTIVE_FILTERS);

  const q = useQuery({
    queryKey: ["gmos", "executive-kpis"],
    queryFn: () => fetchExecutiveKpis(),
    retry: false,
  });

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of q.data?.units ?? []) map.set(u.companyId, u.companyName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [q.data?.units]);

  const header = (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
        <h2 id="painel-kpis" className="text-sm font-semibold">
          Painel executivo de KPIs
        </h2>
        {q.data && summaryPeriod(q.data.kpis) ? (
          <Badge variant="outline" className="ml-auto font-normal">
            Dados até {summaryPeriod(q.data.kpis)}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Acompanhe os principais indicadores das empresas em uma única visão.
      </p>
    </div>
  );

  if (q.isPending) {
    return (
      <section aria-labelledby="painel-kpis" className="space-y-3">
        {header}
        <LoadingBlock rows={3} />
      </section>
    );
  }

  if (q.error) {
    return (
      <section aria-labelledby="painel-kpis" className="space-y-3">
        {header}
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      </section>
    );
  }

  const data = q.data!;
  const visible = filterExecutiveKpis(data.kpis, filters);
  const summary = summarizeExecutiveKpis(visible);
  const scopeUnits = filters.companyId
    ? data.units.filter((u) => u.companyId === filters.companyId)
    : data.units;
  const groups = groupExecutiveKpisByCompany(visible, scopeUnits);

  return (
    <section aria-labelledby="painel-kpis" className="space-y-4">
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="KPIs acompanhados"
          value={summary.total}
          hint={`${summary.measured} com medição`}
        />
        <MetricTile
          label="Na meta"
          value={summary.onTarget}
          tone="success"
          hint={
            summary.onTargetPercent === null
              ? "Sem base comparável"
              : `${summary.onTargetPercent}% dos comparáveis`
          }
        />
        <MetricTile
          label="Fora da meta"
          value={summary.offTarget}
          tone={summary.offTarget > 0 ? "danger" : "default"}
        />
        <MetricTile
          label="Sem medição"
          value={summary.noMeasurement}
          tone={summary.noMeasurement > 0 ? "warning" : "default"}
          hint={`${summary.noTarget} sem meta · ${summary.pendingValidation} pendente(s) de validação`}
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="kpi-empresa">Empresa</Label>
            <Select
              value={filters.companyId ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, companyId: v === "all" ? null : v }))
              }
            >
              <SelectTrigger id="kpi-empresa">
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
            <Label htmlFor="kpi-situacao">Situação</Label>
            <Select
              value={filters.status}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v as ExecutiveKpiStatus | "all" }))
              }
            >
              <SelectTrigger id="kpi-situacao">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="on_target">Na meta</SelectItem>
                <SelectItem value="off_target">Fora da meta</SelectItem>
                <SelectItem value="no_target">Sem meta</SelectItem>
                <SelectItem value="no_measurement">Sem medição</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="kpi-validacao">Validação</Label>
            <Select
              value={filters.validation}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, validation: v as MeasurementValidation | "all" }))
              }
            >
              <SelectTrigger id="kpi-validacao">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="validated">Validada</SelectItem>
                <SelectItem value="pending">Pendente de validação</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filters.companyId || filters.status !== "all" || filters.validation !== "all" ? (
            <div className="sm:col-span-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFilters(EMPTY_EXECUTIVE_FILTERS)}
              >
                Limpar filtros
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data.units.length === 0 ? (
        <StateCard
          title="Nenhuma empresa visível"
          description="Seu perfil ainda não enxerga nenhuma unidade do Grupo. Solicite acesso ao administrador."
        />
      ) : data.kpis.length === 0 ? (
        <StateCard
          title="Nenhum indicador cadastrado"
          description="Cadastre KPIs no Planejamento de cada unidade para acompanhar o desempenho aqui."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((company) => (
            <Card key={company.companyId}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden />
                    {company.companyName}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {company.summary.total} KPIs · {company.summary.onTarget} na meta ·{" "}
                    {company.summary.offTarget} fora da meta
                  </span>
                </div>
                {company.units.map((unit) => (
                  <div key={unit.businessUnitId} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Unidade: {unit.businessUnitName}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {unit.summary.total} KPIs · {unit.summary.onTarget} na meta ·{" "}
                        {unit.summary.offTarget} fora da meta
                      </span>
                    </div>
                    {unit.kpis.length === 0 ? (
                      <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
                        Nenhum KPI cadastrado nesta unidade.
                      </p>
                    ) : (
                      <ul className="grid gap-2 lg:grid-cols-2">
                        {unit.kpis.map((kpi) => (
                          <KpiRow key={kpi.kpiId} kpi={kpi} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function summaryPeriod(kpis: ExecutiveKpi[]): string | null {
  const s = summarizeExecutiveKpis(kpis);
  return s.latestPeriodEnd ? formatCompetence(s.latestPeriodEnd) : null;
}