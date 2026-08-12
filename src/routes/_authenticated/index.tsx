// FASE F4 — Visão do Grupo com leitura executiva. As consultas são as mesmas da F3.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Compass,
  Gauge,
  Layers,
  ClipboardList,
  ListChecks,
  Network,
  Users,
  Presentation,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchStructure } from "@/lib/gmos/structure";
import { PLAN_STATUS, fmtDate } from "@/lib/gmos/f2";
import { fetchUnitSummary, type UnitSummary } from "@/lib/gmos/f3";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { RoleBadge } from "@/components/gmos/permission-gate";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { ExecutiveMetric } from "@/components/gmos/executive-metric";
import { PageHeader } from "@/components/gmos/page-header";
import { DemoBanner } from "@/components/gmos/demo-banner";
import { useIsDemoUnit } from "@/lib/gmos/use-demo";
import { METHOD_STAGES } from "@/lib/gmos/method";
import { useAuth } from "@/lib/auth-context";
import {
  HOME_FOCUS_CTA,
  homeSecondaryCtas,
  selectHomeFocus,
  type HomeFocusInput,
} from "@/lib/gmos/home-focus";
import { fetchMyWork, summarizeMyWork, todayIso } from "@/lib/gmos/my-work";
import { fetchJourneySnapshot } from "@/lib/gmos/strategy-journey";
import {
  maturityLine,
  officialPlanLine,
  summarizeJourneySnapshot,
} from "@/lib/gmos/journey-snapshot";
import { JOURNEY_PHASE_LABEL, MATURITY_BAND_LABEL } from "@/lib/gmos/strategy-recommendations";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão do Grupo — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Visão consolidada do Grupo Moitinho: empresas, filiais, ciclos estratégicos, KPIs, planos de ação e rotinas.",
      },
      { property: "og:title", content: "Visão do Grupo — GMOS · Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Visão consolidada do Grupo Moitinho: empresas, filiais, ciclos estratégicos, KPIs, planos de ação e rotinas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

const JOURNEY = [
  "Criar ciclo estratégico",
  "Definir pilares",
  "Registrar objetivos e KPIs",
  "Criar ações e rotinas",
];

/**
 * Resumo real da Jornada Estratégica da unidade em contexto (F12.1-C2B).
 * Nenhuma regra nova: leitura agregada + `deriveJourneyStatus` via
 * `summarizeJourneySnapshot`. A validação formal vem de `f8_plan_completeness`.
 */
function JourneyCard() {
  const { workspace } = useWorkspace();
  const { can } = useAuth();
  const bu = workspace?.businessUnitId ?? null;
  const canRead = can("strategy.read", workspace?.scopeId ?? null);

  const snapshotQ = useQuery({
    queryKey: ["gmos", "f12", "snapshot", bu],
    queryFn: () => fetchJourneySnapshot(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });

  const summary = snapshotQ.data ? summarizeJourneySnapshot(snapshotQ.data) : null;

  const header = (
    <div className="flex items-center gap-2">
      <Compass className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <h2 className="text-sm font-semibold">Jornada Estratégica</h2>
      <Badge variant="outline" className="ml-auto font-normal">
        Consultoria guiada
      </Badge>
    </div>
  );

  let body: React.ReactNode;
  if (!canRead) {
    body = (
      <p className="text-sm text-muted-foreground">
        Seu perfil não tem leitura do planejamento nesta unidade.
      </p>
    );
  } else if (!bu) {
    body = (
      <p className="text-sm text-muted-foreground">
        Selecione uma unidade para acompanhar a Jornada Estratégica.
      </p>
    );
  } else if (snapshotQ.isPending) {
    body = <p className="text-sm text-muted-foreground">Carregando o estado da Jornada…</p>;
  } else if (snapshotQ.error || !summary) {
    body = (
      <>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o estado da Jornada.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void snapshotQ.refetch()}>
            Tentar novamente
          </Button>
          <Button asChild size="sm">
            <Link to="/jornada-estrategica">Abrir Jornada</Link>
          </Button>
        </div>
      </>
    );
  } else {
    const d = summary.derived;
    const planLine = officialPlanLine(summary);
    const lines = [
      `${d.percent}% da Jornada estruturada`,
      maturityLine(summary.maturity, MATURITY_BAND_LABEL[summary.maturity.band]),
      `Objetivos no rascunho: ${d.pendingObjectives}`,
      `Já levados ao Planejamento: ${d.appliedObjectives}`,
      ...(planLine ? [planLine] : []),
    ];
    const nextLabel = summary.officialAction?.label ?? d.nextAction.label;
    body = (
      <>
        <p className="text-sm font-medium">{JOURNEY_PHASE_LABEL[d.phase]}</p>
        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Próxima melhor ação: {nextLabel}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to={summary.cta.to}>
              {summary.cta.label}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          {summary.cta.to === "/jornada-estrategica" && summary.hasPlan ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/planejamento">Abrir Planejamento</Link>
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col gap-3 p-5">
        {header}
        {body}
      </CardContent>
    </Card>
  );
}

/**
 * Bloco principal por perfil no topo da home, com contagens reais.
 * Nada é redirecionado automaticamente e o painel consolidado é preservado abaixo.
 */
function ProfileFocus({
  totals,
  unitSummary,
}: {
  totals: { pending: number; lateActions: number; actions: number };
  unitSummary: UnitSummary | undefined;
}) {
  const { can, isGroupOwner, isGroupAdmin, primaryRole, internalUser } = useAuth();
  const input: HomeFocusInput = {
    canGroup: can("dashboard.group"),
    canTeam: can("dashboard.team"),
    canPersonal: can("dashboard.personal"),
    isGroupOwner,
    isGroupAdmin,
    primaryRole,
  };
  const focus = selectHomeFocus(input);
  const secondary = homeSecondaryCtas(input);
  const meUserId = internalUser?.id ?? null;

  // Consulta pessoal leve: só quando o destaque é "Meu trabalho".
  const myWork = useQuery({
    queryKey: ["gmos", "my-work", meUserId],
    queryFn: () => fetchMyWork(meUserId!),
    enabled: focus === "personal" && Boolean(meUserId),
    retry: false,
  });

  if (!focus) return null;

  const cta = HOME_FOCUS_CTA[focus];
  let title = "Painel do Grupo";
  let icon = <Network className="h-4 w-4 text-brand-accent" aria-hidden />;
  let lines: string[] = [];

  if (focus === "personal") {
    title = "Meu trabalho";
    icon = <ClipboardList className="h-4 w-4 text-brand-accent" aria-hidden />;
    if (myWork.data) {
      const s = summarizeMyWork(myWork.data, todayIso());
      lines = [
        `${s.routinesLate} rotina(s) em atraso`,
        `${s.routinesToday} para hoje`,
        `${s.routinesUpcoming} nos próximos 7 dias`,
        `${s.actionsOpen} plano(s) de ação em aberto`,
      ];
    } else {
      lines = ["Carregando suas rotinas e ações atribuídas…"];
    }
  } else if (focus === "team") {
    title = "Painel da equipe";
    icon = <Users className="h-4 w-4 text-brand-accent" aria-hidden />;
    lines = unitSummary
      ? [
          `${unitSummary.pendingExecutions} execução(ões) pendente(s)`,
          `${unitSummary.activeRoutines} rotina(s) ativa(s)`,
          `${unitSummary.lateActions} plano(s) de ação em atraso`,
          `${unitSummary.kpis} KPI(s) monitorados`,
        ]
      : ["Selecione uma filial no contexto para ver o resumo da equipe."];
  } else {
    lines = [
      `${totals.pending} execução(ões) pendente(s) no Grupo`,
      `${totals.lateActions} plano(s) de ação em atraso`,
      `${totals.actions} plano(s) de ação registrados`,
    ];
  }

  return (
    <section aria-labelledby="destaque-perfil" className="space-y-3">
      <Card className="border-brand-accent/40">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {icon}
            <h2 id="destaque-perfil" className="text-sm font-semibold">
              {title}
            </h2>
            <span className="ml-auto">
              <RoleBadge />
            </span>
          </div>
          <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <Button asChild size="sm">
            <Link to={cta.to}>
              {cta.label}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
      {secondary.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {secondary.map((s) => (
            <Button key={s.to} asChild size="sm" variant="outline">
              <Link to={s.to}>{s.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function OverviewPage() {
  const { options, workspace, selectUnit, isPending, error, refetch } = useWorkspace();
  const isDemo = useIsDemoUnit(workspace?.businessUnitId);

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

  // Reaproveita o resumo já carregado da filial em contexto: nenhuma consulta extra.
  const selectedIndex = options.findIndex((o) => o.businessUnitId === workspace?.businessUnitId);
  const selectedSummary = selectedIndex >= 0 ? summaries[selectedIndex]?.data : undefined;

  return (
    <div className="space-y-7">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Visão do Grupo" }]}
        title={structure.data?.organization?.name ?? "Grupo Moitinho"}
        description="Leitura consolidada de todas as empresas e filiais visíveis ao seu perfil."
        context={
          workspace
            ? `Contexto atual: ${workspace.companyName} › ${workspace.businessUnitName}`
            : null
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/apresentacao">
              <Presentation className="mr-2 h-4 w-4" aria-hidden />
              Apresentação
            </Link>
          </Button>
        }
      />

      {isDemo ? <DemoBanner /> : null}

      <ProfileFocus
        totals={{
          pending: totals.pending,
          lateActions: totals.lateActions,
          actions: totals.actions,
        }}
        unitSummary={selectedSummary}
      />

      <JourneyCard />

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
            <h2 className="text-sm font-semibold">Método GMOS</h2>
            <Badge variant="outline" className="ml-auto font-normal">
              Universal · Modular · Evolutivo
            </Badge>
          </div>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {METHOD_STAGES.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {s.order}. {s.title}
                </Badge>
                {i < METHOD_STAGES.length - 1 ? (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
          <Link
            to="/metodo"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Conhecer o Método GMOS <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </CardContent>
      </Card>

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
            <ExecutiveMetric
              label="Empresas"
              value={structure.data.counts.companies}
              icon={<Building2 className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Unidades de negócio"
              value={structure.data.counts.businessUnits}
              icon={<Network className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Departamentos"
              value={structure.data.counts.departments}
              icon={<Layers className="h-4 w-4 text-brand-accent" />}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ExecutiveMetric
              label="Ciclos estratégicos"
              value={totals.plans}
              icon={<Target className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Objetivos"
              value={totals.objectives}
              icon={<Layers className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="KPIs"
              value={totals.kpis}
              icon={<Gauge className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Planos de ação"
              value={totals.actions}
              hint={`${totals.lateActions} em atraso`}
              icon={<ListChecks className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Rotinas ativas"
              value={totals.routines}
              icon={<CalendarClock className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Execuções pendentes"
              value={totals.pending}
              icon={<CalendarClock className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Ações em atraso"
              value={totals.lateActions}
              tone="alert"
              icon={<ListChecks className="h-4 w-4 text-brand-accent" />}
            />
            <ExecutiveMetric
              label="Filiais visíveis"
              value={options.length}
              icon={<Network className="h-4 w-4 text-brand-accent" />}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="por-empresa" className="space-y-3">
        <h2
          id="por-empresa"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Por empresa
        </h2>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {options.map((o, i) => {
            const s = summaries[i]?.data;
            const err = summaries[i]?.error;
            const selected = workspace?.businessUnitId === o.businessUnitId;
            return (
              <Card key={o.businessUnitId} className={selected ? "border-brand-accent" : undefined}>
                <CardContent className="space-y-3 p-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{o.companyName}</h3>
                      <p className="truncate text-xs text-muted-foreground">{o.businessUnitName}</p>
                    </div>
                    {selected ? <Badge variant="secondary">Contexto atual</Badge> : null}
                  </div>

                  {err ? (
                    <p className="text-xs text-muted-foreground">
                      Sem permissão de leitura ou falha ao carregar os dados desta filial.
                    </p>
                  ) : s ? (
                    <>
                      <Badge variant={s.plan ? "default" : "outline"}>
                        {s.plan ? "Configurado" : "Aguardando configuração"}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {s.plan
                          ? `${s.plan.title} · ${PLAN_STATUS[s.plan.status] ?? s.plan.status} · ciclo de ${fmtDate(s.plan.cycleStart)} a ${fmtDate(s.plan.cycleEnd)}`
                          : "Nenhum ciclo estratégico cadastrado nesta filial."}
                      </p>

                      {s.plan ? (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                          <Cell label="Objetivos" value={s.objectives} />
                          <Cell label="KPIs" value={s.kpis} />
                          <Cell label="Planos de ação" value={s.actions} />
                          <Cell label="Rotinas ativas" value={s.activeRoutines} />
                          <Cell label="Execuções pendentes" value={s.pendingExecutions} />
                          <Cell label="Ações em atraso" value={s.lateActions} />
                        </dl>
                      ) : (
                        <ol className="space-y-1.5 rounded-md bg-secondary/60 p-3 text-xs">
                          {JOURNEY.map((step, idx) => (
                            <li key={step} className="flex gap-2">
                              <span className="font-semibold tabular-nums text-muted-foreground">
                                {idx + 1}.
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Carregando dados da filial…</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {selected ? (
                      <>
                        <Link
                          to="/planejamento"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Planejamento <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                        <Link
                          to="/planos-de-acao"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Planos de ação <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                        <Link
                          to="/rotinas"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Rotinas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectUnit(o.businessUnitId)}
                      >
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

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
