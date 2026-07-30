// FASE F3 — visão corporativa do Grupo Moitinho: todas as empresas visíveis ao usuário.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Gauge,
  Layers,
  ListChecks,
  Network,
  Target,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchStructure } from "@/lib/gmos/structure";
import { PLAN_STATUS, fmtDate } from "@/lib/gmos/f2";
import { fetchUnitSummary } from "@/lib/gmos/f3";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GMOS — Visão corporativa do Grupo Moitinho" },
      {
        name: "description",
        content:
          "Visão corporativa do Grupo Moitinho Operating System: empresas, filiais, ciclos estratégicos, KPIs, planos de ação e rotinas.",
      },
      { property: "og:title", content: "GMOS — Visão corporativa do Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Visão corporativa do Grupo Moitinho Operating System: empresas, filiais, ciclos estratégicos, KPIs, planos de ação e rotinas.",
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
  const { options, workspace, selectUnit, isPending, error, refetch } = useWorkspace();

  const structure = useQuery({
    queryKey: ["gmos", "structure"],
    queryFn: fetchStructure,
    retry: false,
  });

  const summaries = useQueries({
    queries: options.map((o) => ({
      queryKey: ["gmos", "unit-summary", o.businessUnitId],
      queryFn: () => fetchUnitSummary(o.businessUnitId),
      retry: false,
    })),
  });

  const totals = summaries.reduce(
    (acc, q) => {
      const d = q.data;
      if (!d) return acc;
      return {
        objectives: acc.objectives + d.objectives,
        kpis: acc.kpis + d.kpis,
        actions: acc.actions + d.actions,
        lateActions: acc.lateActions + d.lateActions,
        routines: acc.routines + d.activeRoutines,
        pending: acc.pending + d.pendingExecutions,
        plans: acc.plans + (d.plan ? 1 : 0),
      };
    },
    { objectives: 0, kpis: 0, actions: 0, lateActions: 0, routines: 0, pending: 0, plans: 0 },
  );

  const loadingSummaries = summaries.some((q) => q.isPending);

  return (
    <div className="space-y-6">
      <header>
        <Badge variant="secondary" className="mb-3">
          Visão corporativa
        </Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {structure.data?.organization?.name ?? "Grupo Moitinho"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Grupo Moitinho Operating System — todas as empresas e filiais visíveis ao seu perfil.
        </p>
      </header>

      {structure.error ? (
        <ErrorBlock error={structure.error} onRetry={() => structure.refetch()} />
      ) : null}

      {structure.data ? (
        <section aria-labelledby="estrutura-resumo" className="space-y-3">
          <h2
            id="estrutura-resumo"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Estrutura do Grupo
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric
              label="Empresas"
              value={structure.data.counts.companies}
              icon={<Building2 className="h-4 w-4 text-primary" />}
            />
            <Metric
              label="Unidades de negócio"
              value={structure.data.counts.businessUnits}
              icon={<Network className="h-4 w-4 text-primary" />}
            />
            <Metric
              label="Departamentos"
              value={structure.data.counts.departments}
              icon={<Layers className="h-4 w-4 text-primary" />}
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="consolidado" className="space-y-3">
        <h2
          id="consolidado"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Consolidado do Grupo
        </h2>

        {isPending || loadingSummaries ? <LoadingBlock rows={2} /> : null}
        {error ? <ErrorBlock error={error} onRetry={refetch} /> : null}

        {!isPending && !error && options.length === 0 ? (
          <StateCard
            title="Nenhuma empresa visível"
            description="Seu perfil não possui permissão de leitura em nenhuma filial do Grupo. Solicite acesso ao administrador."
          />
        ) : null}

        {!loadingSummaries && options.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                label="Ciclos estratégicos"
                value={totals.plans}
                icon={<Target className="h-4 w-4 text-primary" />}
              />
              <Metric
                label="KPIs"
                value={totals.kpis}
                icon={<Gauge className="h-4 w-4 text-primary" />}
              />
              <Metric
                label="Planos de ação"
                value={totals.actions}
                icon={<ListChecks className="h-4 w-4 text-primary" />}
              />
              <Metric
                label="Rotinas ativas"
                value={totals.routines}
                icon={<CalendarClock className="h-4 w-4 text-primary" />}
              />
            </div>

            <Card>
              <CardContent className="divide-y p-0">
                <Row label="Usuário autenticado" value={user?.email ?? "—"} />
                <Row label="Objetivos estratégicos" value={String(totals.objectives)} />
                <Row label="Planos de ação em atraso" value={String(totals.lateActions)} />
                <Row label="Execuções de rotina pendentes" value={String(totals.pending)} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>

      <section aria-labelledby="por-empresa" className="space-y-3">
        <h2
          id="por-empresa"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Por empresa
        </h2>

        <div className="space-y-3">
          {options.map((o, i) => {
            const s = summaries[i]?.data;
            const err = summaries[i]?.error;
            const selected = workspace?.businessUnitId === o.businessUnitId;
            return (
              <Card key={o.businessUnitId} className={selected ? "border-primary" : undefined}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {o.companyName} <span className="text-muted-foreground">› {o.businessUnitName}</span>
                    </h3>
                    {selected ? <Badge variant="secondary">Contexto atual</Badge> : null}
                  </div>

                  {err ? (
                    <p className="text-xs text-muted-foreground">
                      Sem permissão de leitura ou falha ao carregar os dados desta filial.
                    </p>
                  ) : s ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {s.plan
                          ? `${s.plan.title} · ${PLAN_STATUS[s.plan.status] ?? s.plan.status} · ciclo de ${fmtDate(s.plan.cycleStart)} a ${fmtDate(s.plan.cycleEnd)}`
                          : "Nenhum ciclo estratégico cadastrado."}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                        <Cell label="Objetivos" value={s.objectives} />
                        <Cell label="KPIs" value={s.kpis} />
                        <Cell label="Ações (atraso)" value={s.actions} extra={s.lateActions} />
                        <Cell label="Rotinas ativas" value={s.activeRoutines} />
                      </dl>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Carregando dados da filial…</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {selected ? (
                      <Link
                        to="/planejamento"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                      >
                        Abrir planejamento <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => selectUnit(o.businessUnitId)}>
                        Usar esta filial
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, extra }: { label: string; value: number; extra?: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">
        {value}
        {extra !== undefined && extra > 0 ? (
          <span className="ml-1 text-destructive">({extra})</span>
        ) : null}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-all text-sm font-medium">{value}</span>
    </div>
  );
}
