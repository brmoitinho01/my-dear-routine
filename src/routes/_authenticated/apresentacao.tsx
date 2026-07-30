// FASE F4 — Central de Apresentação Executiva. Somente dados reais retornados pela RLS.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Gauge,
  History,
  KeyRound,
  Layers,
  ListChecks,
  Lock,
  Maximize2,
  Network,
  ShieldCheck,
  Split,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExecutiveMetric } from "@/components/gmos/executive-metric";
import { CapabilityCard } from "@/components/gmos/capability-card";
import { PresentationFlow } from "@/components/gmos/presentation-flow";
import { GmosBrand } from "@/components/gmos/gmos-brand";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { DemoBanner } from "@/components/gmos/demo-banner";
import { ExecutiveDemoPanel } from "@/components/gmos/executive-demo-panel";
import { ExecutiveReading, PresentationContext } from "@/components/gmos/presentation-context";
import { useExecutivePanel } from "@/lib/gmos/use-demo";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { fetchStructure } from "@/lib/gmos/structure";
import { fetchUnitSummary } from "@/lib/gmos/f3";
import { PLAN_STATUS, fmtDate } from "@/lib/gmos/f2";

export const Route = createFileRoute("/_authenticated/apresentacao")({
  head: () => ({
    meta: [
      { title: "Apresentação executiva — GMOS" },
      {
        name: "description",
        content:
          "Central de apresentação executiva do GMOS: fluxo planejar, medir, agir, executar e governar com dados reais do Grupo Moitinho.",
      },
      { property: "og:title", content: "Apresentação executiva — GMOS" },
      {
        property: "og:description",
        content:
          "Central de apresentação executiva do GMOS: fluxo planejar, medir, agir, executar e governar com dados reais do Grupo Moitinho.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApresentacaoPage,
});

const AVAILABLE = [
  {
    title: "Multiempresa e seleção de contexto",
    description: "Grupo, empresas e filiais isolados, com troca de contexto na própria interface.",
  },
  {
    title: "Planejamento estratégico",
    description: "Ciclos, pilares e objetivos registrados por filial.",
  },
  {
    title: "KPIs e validação de medições",
    description: "Indicadores com fórmula, unidade, direção, periodicidade e medições validadas.",
  },
  {
    title: "Planos de ação 5W2H",
    description: "O quê, por quê, como, responsável, prazo, custo e progresso.",
  },
  {
    title: "Rotinas e execuções",
    description: "Rotinas recorrentes com execuções por período e evidências.",
  },
  {
    title: "Controle de acesso, escopos e auditoria",
    description: "Permissões por escopo, menor privilégio e registro das alterações.",
  },
];

const NEXT = [
  {
    title: "Reuniões, atas e decisões",
    description: "Ritual de gestão com encaminhamentos rastreáveis.",
  },
  {
    title: "Pessoas, posições, competências e PDI",
    description: "Gestão de time ligada aos objetivos.",
  },
  { title: "Alertas e notificações", description: "Avisos de desvio, atraso e pendência." },
  { title: "Execução offline", description: "Rotinas em campo com sincronização posterior." },
  {
    title: "Integrações e cockpit CRTI",
    description: "Dados de vendas, custos e manutenção conectados.",
  },
  {
    title: "Cockpit consolidado avançado",
    description: "Leitura executiva comparativa entre empresas.",
  },
];

const GOVERNANCE = [
  {
    icon: KeyRound,
    title: "Acesso por escopo",
    description: "Cada pessoa vê apenas o Grupo, a empresa ou a filial em que foi autorizada.",
  },
  {
    icon: Lock,
    title: "Menor privilégio",
    description: "Permissões concedidas por função, não por exceção.",
  },
  {
    icon: History,
    title: "Auditoria de alterações",
    description: "Quem alterou, o que alterou e quando.",
  },
  {
    icon: Layers,
    title: "Histórico preservado",
    description: "Registros são arquivados ou cancelados, nunca apagados.",
  },
  {
    icon: Split,
    title: "Isolamento entre empresas",
    description: "Cada usuário acessa somente as empresas cobertas pelos seus escopos autorizados.",
  },
];

function ApresentacaoPage() {
  const { options, workspace, selectedBusinessUnitId, isPending, error, refetch } = useWorkspace();
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const panel = useExecutivePanel(selectedBusinessUnitId);

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

  const loadingSummaries = summaries.some((q) => q.isPending);

  const totals = summaries.reduce(
    (acc, q) => {
      const d = q.data;
      if (!d) return acc;
      return {
        plans: acc.plans + (d.plan ? 1 : 0),
        objectives: acc.objectives + d.objectives,
        kpis: acc.kpis + d.kpis,
        actions: acc.actions + d.actions,
        lateActions: acc.lateActions + d.lateActions,
        routines: acc.routines + d.activeRoutines,
        pending: acc.pending + d.pendingExecutions,
      };
    },
    { plans: 0, objectives: 0, kpis: 0, actions: 0, lateActions: 0, routines: 0, pending: 0 },
  );

  async function handlePresentationMode() {
    const el = typeof document !== "undefined" ? document.documentElement : null;
    if (!el || typeof el.requestFullscreen !== "function") {
      setFullscreenNote(
        "Este navegador não permite tela cheia aqui. Use o atalho de tela cheia do navegador.",
      );
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreenNote(null);
      } else {
        await el.requestFullscreen();
        setFullscreenNote(null);
      }
    } catch {
      setFullscreenNote(
        "Não foi possível ativar a tela cheia. Use o atalho de tela cheia do navegador.",
      );
    }
  }

  return (
    <div className="space-y-10">
      {/* A. Hero */}
      <section className="overflow-hidden rounded-xl bg-sidebar p-6 text-sidebar-foreground sm:p-9">
        <GmosBrand tone="inverted" size="lg" subtitle="Grupo Moitinho" />
        <h1 className="mt-5 max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
          GMOS — O sistema operacional de gestão do Grupo Moitinho
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-sidebar-foreground/80 sm:text-base">
          Estratégia, execução, indicadores, planos e rotinas em um único ambiente, com contexto por
          empresa e filial.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Button asChild size="lg">
            <Link to="/">
              Abrir visão do Grupo <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Link to="/planejamento">Explorar planejamento</Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={handlePresentationMode}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Maximize2 className="mr-2 h-4 w-4" aria-hidden />
            Modo apresentação
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Ambiente privado e dados protegidos
          </Badge>
          <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground/80">
            Fase 5 · Demonstração controlada
          </Badge>
        </div>
        {fullscreenNote ? (
          <p role="status" className="mt-3 text-xs text-sidebar-foreground/80">
            {fullscreenNote}
          </p>
        ) : null}
      </section>

      {/* B. Contexto da apresentação */}
      <section aria-labelledby="contexto" className="space-y-4">
        <div>
          <h2 id="contexto" className="text-lg font-semibold tracking-tight sm:text-xl">
            Contexto da apresentação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O que está selecionado, qual período está sendo exibido e qual é a natureza dos dados.
          </p>
        </div>
        {panel.isPending ? (
          <LoadingBlock rows={1} />
        ) : (
          <PresentationContext workspace={workspace} panel={panel.data ?? null} />
        )}
      </section>

      {/* B1. Leitura executiva */}
      <section aria-labelledby="leitura" className="space-y-4">
        <div>
          <h2 id="leitura" className="text-lg font-semibold tracking-tight sm:text-xl">
            Leitura executiva
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumo gerado a partir dos registros da filial selecionada.
          </p>
        </div>
        {panel.isPending ? (
          <LoadingBlock rows={1} />
        ) : panel.error ? (
          <ErrorBlock error={panel.error} onRetry={() => panel.refetch()} />
        ) : panel.data ? (
          <ExecutiveReading panel={panel.data} />
        ) : (
          <StateCard
            title="Nenhum contexto selecionado"
            description="Selecione uma empresa e uma filial para gerar a leitura executiva."
          />
        )}
      </section>

      {/* B2. Painel executivo da filial selecionada */}
      <section aria-labelledby="painel-executivo" className="space-y-4">
        <div>
          <h2 id="painel-executivo" className="text-lg font-semibold tracking-tight sm:text-xl">
            Painel executivo da filial selecionada
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace
              ? `${workspace.companyName} › ${workspace.businessUnitName}. Semáforo, tendências e execuções calculados a partir dos registros do próprio sistema.`
              : "Selecione uma empresa e filial para ver os indicadores."}
          </p>
        </div>
        {panel.data?.isDemo ? <DemoBanner /> : null}
        {panel.isPending ? (
          <LoadingBlock rows={2} />
        ) : panel.error ? (
          <ErrorBlock error={panel.error} onRetry={() => panel.refetch()} />
        ) : panel.data && panel.data.kpis.length ? (
          <ExecutiveDemoPanel panel={panel.data} />
        ) : (
          <StateCard
            title="Nenhum indicador cadastrado nesta filial"
            description="Cadastre KPIs e registre medições no planejamento para que o painel exiba resultados. Nada é preenchido automaticamente."
          />
        )}
      </section>

      {/* B3. Do planejamento à execução */}
      <section aria-labelledby="fluxo" className="space-y-4">
        <div>
          <h2 id="fluxo" className="text-lg font-semibold tracking-tight sm:text-xl">
            Do planejamento à execução
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cinco etapas encadeadas — planejar, medir, agir, executar e governar — que representam a
            arquitetura operacional já construída no GMOS. Integrações, alertas automáticos e
            reuniões avançadas ainda são próximas fases.
          </p>
        </div>
        <PresentationFlow />
      </section>

      {/* C. Visão consolidada do Grupo */}
      <section aria-labelledby="visao-real" className="space-y-4">
        <div>
          <h2 id="visao-real" className="text-lg font-semibold tracking-tight sm:text-xl">
            Visão consolidada do Grupo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A estrutura organizacional é lida diretamente da base, limitada ao que o seu perfil pode
            ver. Os indicadores da RM Mineração incluem o lote demonstrativo identificado pelo
            banner desta página. Meu Querido e XRM Pré-Moldados permanecem sem dados inventados:
            aparecem vazias até que registros reais sejam cadastrados.
          </p>
        </div>

        {isPending || loadingSummaries ? <LoadingBlock rows={2} /> : null}
        {error ? <ErrorBlock error={error} onRetry={refetch} /> : null}
        {structure.error ? (
          <ErrorBlock error={structure.error} onRetry={() => structure.refetch()} />
        ) : null}

        {!isPending && !error && options.length === 0 ? (
          <StateCard
            title="Nenhuma empresa visível"
            description="Seu perfil não possui leitura em nenhuma filial do Grupo. Solicite acesso ao administrador."
          />
        ) : null}

        {!isPending && !loadingSummaries && options.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ExecutiveMetric
                label="Empresas visíveis"
                value={
                  structure.data?.counts.companies ?? new Set(options.map((o) => o.companyId)).size
                }
                icon={<Building2 className="h-4 w-4 text-brand-accent" />}
              />
              <ExecutiveMetric
                label="Filiais visíveis"
                value={options.length}
                icon={<Network className="h-4 w-4 text-brand-accent" />}
              />
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
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {options.map((o, i) => {
                const s = summaries[i]?.data;
                const err = summaries[i]?.error;
                return (
                  <Card key={o.businessUnitId} className="h-full">
                    <CardContent className="space-y-3 p-5">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{o.companyName}</h3>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.businessUnitName}
                        </p>
                      </div>

                      {err ? (
                        <p className="text-xs text-muted-foreground">
                          Sem permissão de leitura nesta filial.
                        </p>
                      ) : s ? (
                        <>
                          <Badge variant={s.plan ? "default" : "outline"}>
                            {s.plan ? "Configurado" : "Aguardando configuração"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {s.plan
                              ? `${s.plan.title} · ${PLAN_STATUS[s.plan.status] ?? s.plan.status} · ${fmtDate(s.plan.cycleStart)} a ${fmtDate(s.plan.cycleEnd)}`
                              : "Nenhum ciclo estratégico cadastrado nesta filial."}
                          </p>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <Cell label="Objetivos" value={s.objectives} />
                            <Cell label="KPIs" value={s.kpis} />
                            <Cell label="Planos de ação" value={s.actions} />
                            <Cell label="Rotinas ativas" value={s.activeRoutines} />
                            <Cell label="Execuções pendentes" value={s.pendingExecutions} />
                            <Cell label="Ações em atraso" value={s.lateActions} />
                          </dl>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Carregando dados da filial…</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      {/* D. Mapa de capacidades */}
      <section aria-labelledby="capacidades" className="space-y-4">
        <div>
          <h2 id="capacidades" className="text-lg font-semibold tracking-tight sm:text-xl">
            Mapa de capacidades
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O que já está disponível nesta versão e o que está previsto para as próximas fases.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <CapabilityCard
            variant="available"
            title="Disponível nesta versão"
            description="Capacidades já implementadas e utilizáveis nesta versão."
            items={AVAILABLE}
          />
          <CapabilityCard
            variant="next"
            title="Ainda não disponível"
            description="Planejado para as próximas fases. Nada aqui está em funcionamento no sistema."
            items={NEXT}
          />
        </div>
      </section>

      {/* E. Segurança e governança */}
      <section aria-labelledby="governanca" className="space-y-4">
        <div>
          <h2 id="governanca" className="text-lg font-semibold tracking-tight sm:text-xl">
            Segurança e governança
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O sistema protege a informação por desenho, não por confiança.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GOVERNANCE.map((g) => (
            <Card key={g.title}>
              <CardContent className="flex gap-3 p-5">
                <g.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{g.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* F. Encerramento */}
      <section aria-labelledby="encerramento">
        <Card className="border-brand-accent/50">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 id="encerramento" className="text-lg font-semibold tracking-tight">
                Pronto para demonstração
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fase 5 — protótipo executivo para validação. Não homologado para operação nem para
                uso em produção. A próxima empresa pode ser configurada a partir do planejamento da
                sua filial.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/">Abrir o GMOS</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/planejamento">Configurar próxima empresa</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
