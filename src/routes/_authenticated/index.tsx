// FASE F2 — visão geral do GMOS com resumo real da Filial RM Mineração.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarClock, Gauge, Layers, ListChecks, Network, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchStructure } from "@/lib/gmos/structure";
import {
  PLAN_STATUS,
  fetchActionPlans,
  fetchPlanning,
  fetchRoutines,
  fetchWorkspace,
  fmtDate,
  isKpiIncomplete,
  isLate,
} from "@/lib/gmos/f2";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GMOS — Visão geral do Grupo Moitinho" },
      {
        name: "description",
        content: "Visão geral do Grupo Moitinho Operating System: estrutura, ciclo estratégico, KPIs, planos de ação e rotinas.",
      },
      { property: "og:title", content: "GMOS — Visão geral do Grupo Moitinho" },
      {
        property: "og:description",
        content: "Visão geral do Grupo Moitinho Operating System: estrutura, ciclo estratégico, KPIs, planos de ação e rotinas.",
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
  const structure = useQuery({ queryKey: ["gmos", "structure"], queryFn: fetchStructure, retry: false });
  const ws = useQuery({ queryKey: ["gmos", "workspace"], queryFn: fetchWorkspace, retry: false });
  const bu = ws.data?.businessUnitId;
  const planning = useQuery({ queryKey: ["gmos", "planning", bu], queryFn: () => fetchPlanning(bu!), enabled: Boolean(bu), retry: false });
  const actions = useQuery({ queryKey: ["gmos", "actions", bu], queryFn: () => fetchActionPlans(bu!), enabled: Boolean(bu), retry: false });
  const routines = useQuery({ queryKey: ["gmos", "routines", bu], queryFn: () => fetchRoutines(bu!), enabled: Boolean(bu), retry: false });

  const plan = planning.data?.plan ?? null;
  const kpis = planning.data?.kpis ?? [];
  const acts = actions.data ?? [];
  const tpls = routines.data?.templates ?? [];
  const execs = routines.data?.executions ?? [];

  return (
    <div className="space-y-6">
      <header>
        <Badge variant="secondary" className="mb-3">
          Fase 2 — Estratégia, KPIs, ações e rotinas
        </Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {structure.data?.organization?.name ?? "Grupo Moitinho"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Grupo Moitinho Operating System — ambiente corporativo interno.
        </p>
      </header>

      {structure.isPending ? <LoadingBlock rows={1} /> : null}
      {structure.error ? <ErrorBlock error={structure.error} onRetry={() => structure.refetch()} /> : null}

      {structure.data ? (
        <section aria-labelledby="estrutura-resumo" className="space-y-3">
          <h2 id="estrutura-resumo" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Estrutura
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Empresas" value={structure.data.counts.companies} icon={<Building2 className="h-4 w-4 text-primary" />} />
            <Metric label="Unidades de negócio" value={structure.data.counts.businessUnits} icon={<Network className="h-4 w-4 text-primary" />} />
            <Metric label="Departamentos" value={structure.data.counts.departments} icon={<Layers className="h-4 w-4 text-primary" />} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="rm-resumo" className="space-y-3">
        <h2 id="rm-resumo" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          RM Mineração — Filial
        </h2>

        {ws.isPending || planning.isPending || actions.isPending || routines.isPending ? <LoadingBlock rows={2} /> : null}
        {ws.error ? <ErrorBlock error={ws.error} onRetry={() => ws.refetch()} /> : null}

        {ws.data && plan ? (
          <>
            <Card>
              <CardContent className="space-y-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{plan.title}</h3>
                  <Badge>{PLAN_STATUS[plan.status] ?? plan.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ciclo de {fmtDate(plan.cycleStart)} a {fmtDate(plan.cycleEnd)} · {ws.data.companyName} › {ws.data.businessUnitName}
                </p>
                <Link to="/planejamento" className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary">
                  Abrir planejamento <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Objetivos" value={planning.data?.objectives.length ?? 0} icon={<Target className="h-4 w-4 text-primary" />} />
              <Metric
                label="KPIs configurados"
                value={kpis.filter((k) => !isKpiIncomplete(k)).length}
                icon={<Gauge className="h-4 w-4 text-primary" />}
              />
              <Metric label="Planos de ação" value={acts.length} icon={<ListChecks className="h-4 w-4 text-primary" />} />
              <Metric label="Rotinas" value={tpls.length} icon={<CalendarClock className="h-4 w-4 text-primary" />} />
            </div>

            <Card>
              <CardContent className="divide-y p-0">
                <Row label="Usuário autenticado" value={user?.email ?? "—"} />
                <Row label="Medições pendentes de validação" value={String(planning.data?.measurements.filter((m) => m.status === "pending").length ?? 0)} />
                <Row label="Planos de ação em atraso" value={String(acts.filter(isLate).length)} />
                <Row label="Execuções de rotina pendentes" value={String(execs.filter((e) => e.status === "pending").length)} />
                <Row label="Rotinas ativas" value={String(tpls.filter((t) => t.status === "active").length)} />
              </CardContent>
            </Card>
          </>
        ) : ws.data && !planning.isPending ? (
          <StateCard
            title="Nenhum ciclo de planejamento encontrado"
            description="A Filial RM Mineração ainda não possui um planejamento visível para o seu perfil."
          />
        ) : null}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-all text-sm font-medium">{value}</span>
    </div>
  );
}
