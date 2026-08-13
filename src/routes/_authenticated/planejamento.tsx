// FASE F3 — planejamento estratégico da empresa/filial selecionada no contexto.
// FASE F8 — assistente do ciclo: direcionamento, diagnóstico, objetivos, indicadores, revisão.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Target,
  Gauge,
  Ruler,
  ShieldAlert,
  AlertTriangle,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { InitiativesSection } from "@/components/gmos/initiatives-section";
import {
  fetchDerivedActionPlans,
  fetchInitiativesByPlan,
  initiativeIndicators,
} from "@/lib/gmos/initiatives";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { PageHeader } from "@/components/gmos/page-header";
import { DemoBanner } from "@/components/gmos/demo-banner";
import { useIsDemoUnit } from "@/lib/gmos/use-demo";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import {
  RecordDialog,
  toNullable,
  toNumeric,
  type Field,
  type FormValues,
} from "@/components/gmos/record-dialog";
import {
  CycleStatusBar,
  DiagnosisForm,
  IdentityForm,
  PendingList,
  ReviewPanel,
  StrategyStepper,
} from "@/components/gmos/strategy-assistant";
import { StrategicDirectionBuilder } from "@/components/gmos/strategic-direction-builder";
import { GuidedPlanningDiagnosis } from "@/components/gmos/guided-planning-diagnosis";
import { AdvancedSection } from "@/components/gmos/advanced-section";
import type { DirectionChoices } from "@/lib/gmos/strategic-direction-builder";
import { fetchPlanningDiagnosisInput, fetchPrioritySelections } from "@/lib/gmos/strategy-journey";
import {
  activatePlan,
  approvePlan,
  EMPTY_COMPLETENESS,
  fetchCompleteness,
  fetchDiagnostic,
  fetchIdentity,
  fetchPlanDirectionChoices,
  isSubmittable,
  pendingsBySection,
  saveDiagnostic,
  saveIdentity,
  savePlanDirectionChoices,
  stageProgress,
  submitPlanForReview,
  workflowActions,
  type DiagnosticInput,
  type IdentityInput,
  type StageId,
} from "@/lib/gmos/strategy";
import {
  DIRECTION,
  DRAFT_PLAN_NOTE,
  FREQUENCY,
  KPI_STATUS,
  LEVEL,
  MEASUREMENT_STATUS,
  OBJECTIVE_STATUS,
  PLAN_STATUS,
  RISK_STATUS,
  ACTION_STATUS,
  fetchActionPlans,
  fetchPlanning,
  fmtDate,
  fmtNumber,
  insertRow,
  isKpiIncomplete,
  ownerLabel,
  updateRow,
  type ActionPlan,
  type Objective,
  type Kpi,
  type Plan,
  type Measurement,
  type Risk,
  type Workspace,
} from "@/lib/gmos/f2";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento estratégico — GMOS Grupo Moitinho" },
      {
        name: "description",
        content: "Pilares, objetivos, KPIs, medições e riscos da empresa selecionada no GMOS.",
      },
      { property: "og:title", content: "Planejamento estratégico — GMOS Grupo Moitinho" },
      {
        property: "og:description",
        content: "Pilares, objetivos, KPIs, medições e riscos da empresa selecionada no GMOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanejamentoPage,
});

const selectOpts = (map: Record<string, string>) =>
  Object.entries(map).map(([value, label]) => ({ value, label }));

function PlanejamentoPage() {
  const qc = useQueryClient();
  const wsCtx = useWorkspace();
  const { can } = useAuth();
  const isDemo = useIsDemoUnit(wsCtx.selectedBusinessUnitId);
  const ws = {
    isPending: wsCtx.isPending,
    error: wsCtx.error,
    data: wsCtx.workspace,
    refetch: wsCtx.refetch,
  };
  const bu = ws.data?.businessUnitId;
  const planning = useQuery({
    queryKey: ["gmos", "planning", bu],
    queryFn: () => fetchPlanning(bu!),
    enabled: Boolean(bu),
    retry: false,
  });

  // Cadeia objetivo → KPI → ação: os planos de ação vêm da mesma filial e da mesma RLS.
  const actionsQuery = useQuery({
    queryKey: ["gmos", "actions", bu],
    queryFn: () => fetchActionPlans(bu!),
    enabled: Boolean(bu),
    retry: false,
  });

  // F8 — identidade, diagnóstico e completude do ciclo. O planId só existe após a leitura do plano.
  const planId = planning.data?.plan?.id ?? null;
  const [stage, setStage] = useState<StageId>("direction");

  // F9 — iniciativas do ciclo (mesmo cache usado pelas seções por objetivo).
  const initiativesQuery = useQuery({
    queryKey: ["gmos", "initiatives", planId],
    queryFn: () => fetchInitiativesByPlan(planId!),
    enabled: Boolean(planId),
    retry: false,
  });
  const derivedQuery = useQuery({
    queryKey: ["gmos", "derived-actions", bu],
    queryFn: () => fetchDerivedActionPlans(bu!),
    enabled: Boolean(bu),
    retry: false,
  });

  const identityQuery = useQuery({
    queryKey: ["gmos", "strategy", "identity", planId],
    queryFn: () => fetchIdentity(planId!),
    enabled: Boolean(planId),
    retry: false,
  });
  const diagnosticQuery = useQuery({
    queryKey: ["gmos", "strategy", "diagnostic", planId],
    queryFn: () => fetchDiagnostic(planId!),
    enabled: Boolean(planId),
    retry: false,
  });
  const completenessQuery = useQuery({
    queryKey: ["gmos", "strategy", "completeness", planId],
    queryFn: () => fetchCompleteness(planId!),
    enabled: Boolean(planId),
    retry: false,
  });

  // F8.1-A — decisões estruturadas do direcionamento e insumos da Jornada (F12).
  const choicesQuery = useQuery({
    queryKey: ["gmos", "strategy", "direction-choices", planId],
    queryFn: () => fetchPlanDirectionChoices(planId!),
    enabled: Boolean(planId),
    retry: false,
  });
  const journeyPrioritiesQuery = useQuery({
    queryKey: ["gmos", "strategy", "journey-priorities", bu],
    queryFn: () => fetchPrioritySelections(bu!),
    enabled: Boolean(bu),
    retry: false,
  });
  const diagnosisInputQuery = useQuery({
    queryKey: ["gmos", "strategy", "journey-diagnosis-input", bu],
    queryFn: () => fetchPlanningDiagnosisInput(bu!),
    enabled: Boolean(bu),
    retry: false,
  });

  function invalidateStrategy() {
    qc.invalidateQueries({ queryKey: ["gmos", "strategy"] });
    qc.invalidateQueries({ queryKey: ["gmos", "planning"] });
  }

  const identityMutation = useMutation({
    mutationFn: (v: IdentityInput) => saveIdentity(planId!, v),
    onSuccess: () => {
      invalidateStrategy();
      toast.success("Direcionamento salvo.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  // F8.1-A.1 — uma única transação no banco: escolhas + identidade oficial, tudo ou nada.
  // A RPC é a autoridade de escopo, permissão, cardinalidades e autoria.
  const directionMutation = useMutation({
    mutationFn: (v: { choices: DirectionChoices; identity: IdentityInput }) =>
      confirmStructuredDirection(planId!, v.choices, v.identity),
    onSuccess: () => {
      invalidateStrategy();
      toast.success("Direcionamento estratégico atualizado a partir das suas escolhas.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const diagnosticMutation = useMutation({
    mutationFn: (v: DiagnosticInput) =>
      saveDiagnostic(
        {
          planId: planId!,
          organizationId: wsCtx.workspace?.organizationId ?? "",
          businessUnitId: wsCtx.workspace?.businessUnitId ?? "",
          diagnosticId: diagnosticQuery.data?.id ?? null,
        },
        v,
      ),
    onSuccess: () => {
      invalidateStrategy();
      toast.success("Diagnóstico salvo.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  // Transições existem apenas via RPC auditada; a decisão final é do banco.
  const workflowMutation = useMutation({
    mutationFn: async (op: { kind: "submit" | "approve" | "activate"; notes?: string }) => {
      if (op.kind === "submit") return submitPlanForReview(planId!);
      if (op.kind === "approve") return approvePlan(planId!, op.notes ?? null);
      return activatePlan(planId!);
    },
    onSuccess: (_res, op) => {
      invalidateStrategy();
      toast.success(
        op.kind === "submit"
          ? "Planejamento enviado para revisão."
          : op.kind === "approve"
            ? "Planejamento aprovado."
            : "Ciclo ativado.",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação."),
  });

  const save = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmos", "planning"] });
      toast.success("Registro salvo.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  // Após criar/alterar o ciclo, atualiza a filial atual e a Visão do Grupo.
  function invalidatePlanning(businessUnitId: string) {
    qc.invalidateQueries({ queryKey: ["gmos", "planning", businessUnitId] });
    qc.invalidateQueries({ queryKey: ["gmos", "unit-summary", businessUnitId] });
  }

  if (ws.isPending || (ws.data && planning.isPending)) return <LoadingBlock rows={3} />;
  if (ws.error) return <ErrorBlock error={ws.error} onRetry={() => ws.refetch()} />;
  if (!ws.data)
    return (
      <StateCard
        title="Nenhuma filial disponível"
        description="Seu perfil não possui permissão de leitura em nenhuma filial do Grupo. Solicite acesso ao administrador."
      />
    );
  if (planning.error)
    return <ErrorBlock error={planning.error} onRetry={() => planning.refetch()} />;

  const w = ws.data as Workspace;
  const data = planning.data!;
  const canEdit = w.canStrategy;

  if (!data.plan) {
    return (
      <div className="space-y-4">
        <PageHeader
          crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Planejamento" }]}
          title="Planejamento estratégico"
          description="Ciclo estratégico da filial selecionada."
          context={`${w.companyName} › ${w.businessUnitName}`}
        />
        {isDemo ? <DemoBanner /> : null}
        <StateCard
          title="Nenhum planejamento cadastrado"
          description={
            canEdit
              ? "Esta filial ainda não possui um ciclo de planejamento. Crie o ciclo para começar; pilares, objetivos, KPIs e rotinas continuam sendo cadastrados manualmente."
              : "Ainda não existe um ciclo de planejamento para a filial selecionada ou seu perfil não tem permissão de leitura."
          }
        >
          {canEdit ? (
            <CreatePlan workspace={w} onDone={() => invalidatePlanning(w.businessUnitId)} />
          ) : null}
        </StateCard>
      </div>
    );
  }

  const plan = data.plan;
  const pillarById = new Map(data.pillars.map((p) => [p.id, p]));
  const kpiById = new Map(data.kpis.map((k) => [k.id, k]));
  const incompleteKpis = data.kpis.filter(isKpiIncomplete).length;
  const pendingMeasurements = data.measurements.filter((m) => m.status === "pending").length;

  const pillarOpts = data.pillars.map((p) => ({ value: p.id, label: p.title }));
  const objectiveOpts = data.objectives.map((o) => ({ value: o.id, label: o.title }));
  const ownerOpts = [
    { value: "none", label: "Sem responsável definido" },
    ...(w.meUserId ? [{ value: w.meUserId, label: `Eu (${w.meEmail ?? "usuário atual"})` }] : []),
  ];
  const base = {
    organization_id: w.organizationId,
    business_unit_id: w.businessUnitId,
    plan_id: plan.id,
  };
  const owner = (v: FormValues, key = "owner_user_id") => {
    const raw = String(v[key] ?? "");
    return raw && raw !== "none" ? raw : null;
  };

  // F8 — estado do assistente. Permissões vêm do banco: strategy.manage e strategy.approve.
  const identity = identityQuery.data ?? null;
  const diagnostic = diagnosticQuery.data ?? null;
  const completeness = completenessQuery.data ?? EMPTY_COMPLETENESS;
  const pendings = pendingsBySection(completeness.pendings);
  const canApprovePermission = can("strategy.approve", w.scopeId);
  const actions = workflowActions({
    canManage: canEdit,
    canApprovePermission,
    reviewStatus: identity?.reviewStatus ?? "draft",
    planStatus: plan.status,
    ready: completeness.ready,
    submittable: isSubmittable(completeness.pendings),
  });
  const progress = stageProgress({
    identity,
    diagnostic,
    objectives: data.objectives.map((o) => ({ status: o.status, ownerUserId: o.ownerUserId })),
    kpis: data.kpis.map((k) => ({
      status: k.status,
      objectiveId: k.objectiveId,
      incomplete: isKpiIncomplete(k),
    })),
    reviewStatus: identity?.reviewStatus ?? "draft",
    planStatus: plan.status,
  });
  const initiativeStats = initiativeIndicators(
    initiativesQuery.data ?? [],
    derivedQuery.data ?? [],
  );
  const approvedLocked = (identity?.reviewStatus ?? "draft") === "approved";
  const canEditStrategyContent = canEdit && !approvedLocked;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Planejamento" }]}
        title={plan.title}
        description={`Ciclo de ${fmtDate(plan.cycleStart)} a ${fmtDate(plan.cycleEnd)}.`}
        context={`${w.companyName} › ${w.businessUnitName}`}
        actions={
          <>
            <Badge>{PLAN_STATUS[plan.status] ?? plan.status}</Badge>
            {plan.status === "draft" ? (
              <span className="text-xs text-muted-foreground">{DRAFT_PLAN_NOTE}</span>
            ) : null}
            {canEdit ? (
              <PlanEditor
                plan={plan}
                onSave={(vals) => save.mutate(() => updateRow("strategic_plans", plan.id, vals))}
              />
            ) : (
              <span className="text-xs text-muted-foreground">Perfil somente leitura.</span>
            )}
          </>
        }
      />

      {isDemo ? <DemoBanner /> : null}

      <div className="space-y-4">
        <CycleStatusBar identity={identity} planStatus={plan.status} completeness={completeness} />
        <StrategyStepper progress={progress} active={stage} onSelect={setStage} />
        {approvedLocked ? (
          <p className="text-xs text-muted-foreground">
            Ciclo aprovado: o conteúdo estratégico fica preservado como registro. Novos ajustes
            devem ser tratados em uma revisão do ciclo.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          icon={<Target className="h-4 w-4 text-primary" />}
          label="Objetivos"
          value={data.objectives.length}
        />
        <Metric
          icon={<Gauge className="h-4 w-4 text-primary" />}
          label="KPIs configurados"
          value={data.kpis.length - incompleteKpis}
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="KPIs incompletos"
          value={incompleteKpis}
        />
        <Metric
          icon={<Ruler className="h-4 w-4 text-primary" />}
          label="Medições pendentes"
          value={pendingMeasurements}
        />
        <Metric
          icon={<GitBranch className="h-4 w-4 text-primary" />}
          label="Iniciativas ativas"
          value={initiativeStats.live}
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="Iniciativas sem plano"
          value={initiativeStats.approvedWithoutActionPlan}
        />
      </div>

      <Tabs value={stage} onValueChange={(v) => setStage(v as StageId)}>
        {/* ETAPA 1 — DIRECIONAMENTO */}
        <TabsContent value="direction" className="space-y-3 pt-2">
          <PendingList items={pendings.direction ?? []} />
          <StrategicDirectionBuilder
            identity={identity}
            choices={choicesQuery.data ?? null}
            journeyPriorities={journeyPrioritiesQuery.data ?? []}
            context={{
              sectorCode: diagnosisInputQuery.data?.profile?.sectorCode ?? null,
              horizonYears: null,
            }}
            canEdit={canEditStrategyContent}
            saving={directionMutation.isPending}
            onConfirm={(choices, synthesized) =>
              directionMutation.mutate({ choices, identity: synthesized })
            }
          />
          <AdvancedSection
            title="Modo avançado — escrever o texto manualmente"
            microcopy="Use apenas se a liderança quiser redigir o direcionamento por conta própria. O caminho recomendado é decidir nos cards acima e deixar o sistema escrever."
          >
            <IdentityForm
              identity={identity}
              canEdit={canEditStrategyContent}
              saving={identityMutation.isPending}
              onSave={(v) => identityMutation.mutate(v)}
            />
          </AdvancedSection>
        </TabsContent>

        {/* ETAPA 2 — DIAGNÓSTICO */}
        <TabsContent value="diagnosis" className="space-y-3 pt-2">
          <PendingList items={pendings.diagnosis ?? []} />
          {diagnosisInputQuery.isPending ? (
            <LoadingBlock rows={2} />
          ) : diagnosisInputQuery.error ? (
            <ErrorBlock
              error={diagnosisInputQuery.error}
              onRetry={() => diagnosisInputQuery.refetch()}
            />
          ) : (
            <GuidedPlanningDiagnosis
              input={
                diagnosisInputQuery.data ?? {
                  profile: null,
                  maturity: null,
                  statements: [],
                  selections: [],
                  priorityDimensions: [],
                }
              }
              diagnostic={diagnostic}
              canEdit={canEditStrategyContent}
              saving={diagnosticMutation.isPending}
              onConfirm={(v) => diagnosticMutation.mutate(v)}
            />
          )}
          <AdvancedSection
            title="Modo avançado — ajustar o diagnóstico manualmente"
            microcopy="Ajustes manuais são permitidos, mas a origem recomendada é o Diagnóstico da Jornada Estratégica."
          >
            <DiagnosisForm
              diagnostic={diagnostic}
              canEdit={canEditStrategyContent}
              saving={diagnosticMutation.isPending}
              onSave={(v) => diagnosticMutation.mutate(v)}
            />
          </AdvancedSection>
        </TabsContent>

        {/* ETAPA 3 — OBJETIVOS (pilares, objetivos e riscos) */}
        <TabsContent value="objectives" className="space-y-3 pt-2">
          <PendingList items={pendings.objectives ?? []} />
          <PillarsSection
            pillars={data.pillars}
            objectives={data.objectives}
            kpis={data.kpis}
            canEdit={canEdit}
            onSave={(id, vals) => save.mutate(() => updateRow("strategic_pillars", id, vals))}
          />
          {canEdit ? (
            <NewButton
              label="Novo objetivo"
              title="Novo objetivo"
              fields={objectiveFields(pillarOpts, ownerOpts)}
              onSubmit={async (v) =>
                insertRow("strategic_objectives", {
                  ...base,
                  pillar_id: v.pillar_id,
                  title: v.title,
                  description: toNullable(v.description),
                  owner_user_id: owner(v),
                  due_date: toNullable(v.due_date),
                  status: v.status || "draft",
                  progress: toNumeric(v.progress) ?? 0,
                })
              }
              onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
            />
          ) : null}

          {data.objectives.length === 0 ? (
            <StateCard
              title="Nenhum objetivo cadastrado"
              description="Os objetivos deste ciclo ainda não foram definidos. Nada é preenchido automaticamente."
            />
          ) : (
            data.objectives.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{o.title}</h3>
                    <Badge variant="outline">{OBJECTIVE_STATUS[o.status] ?? o.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pillarById.get(o.pillarId)?.title ?? "—"} · Prazo: {fmtDate(o.dueDate)}
                  </p>
                  {o.description ? (
                    <p className="text-sm text-muted-foreground">{o.description}</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Progress value={o.progress} className="h-2" />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {o.progress}%
                    </span>
                  </div>
                  <ObjectiveChain
                    objective={o}
                    kpis={data.kpis}
                    measurements={data.measurements}
                    actions={actionsQuery.data ?? []}
                  />
                  <InitiativesSection
                    organizationId={w.organizationId}
                    businessUnitId={w.businessUnitId}
                    planId={plan.id}
                    objectiveId={o.id}
                    pillarId={o.pillarId}
                    kpiOpts={data.kpis
                      .filter((k) => !k.objectiveId || k.objectiveId === o.id)
                      .map((k) => ({ value: k.id, label: k.name }))}
                    riskOpts={data.risks
                      .filter((r) => !r.objectiveId || r.objectiveId === o.id)
                      .map((r) => ({ value: r.id, label: r.title }))}
                    ownerOpts={ownerOpts}
                    canManage={canEdit}
                    canApprove={canApprovePermission}
                    canManageActions={w.canAction}
                  />
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <EditButton
                        title="Editar objetivo"
                        fields={objectiveFields(pillarOpts, ownerOpts)}
                        initial={{
                          pillar_id: o.pillarId,
                          title: o.title,
                          description: o.description ?? "",
                          owner_user_id: o.ownerUserId ?? "none",
                          due_date: o.dueDate ?? "",
                          status: o.status,
                          progress: String(o.progress),
                        }}
                        onSubmit={async (v) =>
                          updateRow("strategic_objectives", o.id, {
                            pillar_id: v.pillar_id,
                            title: v.title,
                            description: toNullable(v.description),
                            owner_user_id: owner(v),
                            due_date: toNullable(v.due_date),
                            status: v.status,
                            progress: toNumeric(v.progress) ?? 0,
                          })
                        }
                        onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
                      />
                      {o.status !== "cancelled" ? (
                        <ConfirmAction
                          trigger={
                            <Button size="sm" variant="ghost">
                              Cancelar objetivo
                            </Button>
                          }
                          title="Cancelar objetivo?"
                          description="O objetivo permanece no histórico com status cancelado. Nada é excluído."
                          actionLabel="Cancelar objetivo"
                          onConfirm={() =>
                            save.mutate(() =>
                              updateRow("strategic_objectives", o.id, { status: "cancelled" }),
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}

          <h2 className="pt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Riscos do ciclo
          </h2>
          {canEdit ? (
            <NewButton
              label="Novo risco"
              title="Novo risco"
              fields={riskFields(objectiveOpts, ownerOpts)}
              onSubmit={async (v) =>
                insertRow("strategic_risks", {
                  ...base,
                  objective_id: v.objective_id && v.objective_id !== "none" ? v.objective_id : null,
                  title: v.title,
                  description: toNullable(v.description),
                  impact: v.impact || "medium",
                  probability: v.probability || "medium",
                  contingency: toNullable(v.contingency),
                  owner_user_id: owner(v),
                  status: v.status || "open",
                })
              }
              onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
            />
          ) : null}
          {data.risks.length === 0 ? (
            <StateCard
              title="Nenhum risco mapeado"
              description="Registre riscos com impacto, probabilidade e contingência."
            />
          ) : (
            data.risks.map((r) => (
              <RiskCard
                key={r.id}
                r={r}
                canEdit={canEdit}
                objectiveOpts={objectiveOpts}
                ownerOpts={ownerOpts}
                owner={owner}
                onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
              />
            ))
          )}
        </TabsContent>

        {/* ETAPA 4 — INDICADORES, METAS E MEDIÇÕES */}
        <TabsContent value="kpis" className="space-y-3 pt-2">
          <PendingList items={pendings.kpis ?? []} />
          {canEdit ? (
            <NewButton
              label="Novo KPI"
              title="Novo KPI"
              description="Fórmula, fonte e responsável são exigidos para o indicador ser considerado configurado."
              fields={kpiFields(pillarOpts, objectiveOpts, ownerOpts)}
              onSubmit={async (v) => insertRow("kpis", { ...base, ...kpiPayload(v, owner) })}
              onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
            />
          ) : null}

          {data.kpis.length === 0 ? (
            <StateCard
              title="Nenhum KPI cadastrado"
              description="Nenhum indicador é exibido sem origem e regra de cálculo. Cadastre KPIs com fórmula, fonte e responsável."
            />
          ) : (
            data.kpis.map((k) => (
              <KpiCard
                key={k.id}
                kpi={k}
                canEdit={canEdit}
                pillarOpts={pillarOpts}
                objectiveOpts={objectiveOpts}
                ownerOpts={ownerOpts}
                owner={owner}
                onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
                save={(fn) => save.mutate(fn)}
              />
            ))
          )}

          <h2 className="pt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Medições
          </h2>
          {canEdit && data.kpis.length > 0 ? (
            <NewButton
              label="Nova medição"
              title="Nova medição"
              fields={measurementFields(data.kpis)}
              onSubmit={async (v) =>
                insertRow("kpi_measurements", {
                  organization_id: w.organizationId,
                  business_unit_id: w.businessUnitId,
                  kpi_id: v.kpi_id,
                  period_start: v.period_start,
                  period_end: v.period_end,
                  value: toNumeric(v.value),
                  source_evidence: toNullable(v.source_evidence),
                  notes: toNullable(v.notes),
                  status: "pending",
                })
              }
              onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "planning"] })}
            />
          ) : null}

          {data.measurements.length === 0 ? (
            <StateCard
              title="Nenhuma medição registrada"
              description="As medições aparecem aqui após serem lançadas para um KPI existente. Nenhum valor é estimado pelo sistema."
            />
          ) : (
            data.measurements.map((m) => (
              <MeasurementCard
                key={m.id}
                m={m}
                kpiName={kpiById.get(m.kpiId)?.name ?? "—"}
                unit={kpiById.get(m.kpiId)?.unit ?? null}
                canEdit={canEdit}
                onValidate={(status) =>
                  save.mutate(() =>
                    updateRow("kpi_measurements", m.id, {
                      status,
                      validated_by: w.meUserId,
                      validated_at: new Date().toISOString(),
                    }),
                  )
                }
              />
            ))
          )}
        </TabsContent>

        {/* ETAPA 5 — REVISÃO E ATIVAÇÃO */}
        <TabsContent value="review" className="space-y-3 pt-2">
          <ReviewPanel
            identity={identity}
            completeness={completeness}
            actions={actions}
            busy={workflowMutation.isPending}
            onSubmit={() => workflowMutation.mutate({ kind: "submit" })}
            onApprove={(notes) => workflowMutation.mutate({ kind: "approve", notes })}
            onActivate={() => workflowMutation.mutate({ kind: "activate" })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- pilares ---------- */

function PillarsSection({
  pillars,
  objectives,
  kpis,
  canEdit,
  onSave,
}: {
  pillars: {
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    status: string;
  }[];
  objectives: Objective[];
  kpis: Kpi[];
  canEdit: boolean;
  onSave: (id: string, vals: Record<string, unknown>) => void;
}) {
  if (pillars.length === 0) return null;
  return (
    <section aria-labelledby="pilares" className="space-y-3">
      <h2
        id="pilares"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Pilares
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {pillars.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-snug">{p.title}</h3>
                {p.status === "archived" ? <Badge variant="outline">Arquivado</Badge> : null}
              </div>
              {p.description ? (
                <p className="text-sm text-muted-foreground">{p.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {objectives.filter((o) => o.pillarId === p.id).length} objetivo(s) ·{" "}
                {kpis.filter((k) => k.pillarId === p.id).length} KPI(s)
              </p>
              {canEdit ? <PillarEditor pillar={p} onSave={(vals) => onSave(p.id, vals)} /> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------- campos ---------- */

type Opt = { value: string; label: string };

function objectiveFields(pillars: Opt[], owners: Opt[]): Field[] {
  return [
    { name: "pillar_id", label: "Pilar", type: "select", required: true, options: pillars },
    { name: "title", label: "Título do objetivo", type: "text", required: true },
    { name: "description", label: "Descrição", type: "textarea" },
    { name: "owner_user_id", label: "Responsável", type: "select", options: owners },
    { name: "due_date", label: "Prazo", type: "date" },
    { name: "status", label: "Status", type: "select", options: selectOpts(OBJECTIVE_STATUS) },
    { name: "progress", label: "Progresso (%)", type: "number", min: 0, max: 100 },
  ];
}

function kpiFields(pillars: Opt[], objectives: Opt[], owners: Opt[]): Field[] {
  return [
    { name: "name", label: "Nome do KPI", type: "text", required: true },
    {
      name: "pillar_id",
      label: "Pilar",
      type: "select",
      options: [{ value: "none", label: "Sem pilar" }, ...pillars],
    },
    {
      name: "objective_id",
      label: "Objetivo",
      type: "select",
      options: [{ value: "none", label: "Sem objetivo" }, ...objectives],
    },
    { name: "unit", label: "Unidade", type: "text", placeholder: "t, R$, %, h…" },
    {
      name: "formula",
      label: "Fórmula de cálculo",
      type: "textarea",
      help: "Obrigatória para o KPI ser considerado configurado.",
    },
    {
      name: "source",
      label: "Fonte do dado",
      type: "text",
      help: "Obrigatória para o KPI ser considerado configurado.",
    },
    {
      name: "frequency",
      label: "Periodicidade",
      type: "select",
      options: selectOpts(FREQUENCY).filter((o) => o.value !== "custom"),
    },
    { name: "direction", label: "Direção da meta", type: "select", options: selectOpts(DIRECTION) },
    { name: "baseline_value", label: "Baseline", type: "number", step: "any" },
    { name: "target_value", label: "Meta", type: "number", step: "any" },
    { name: "owner_user_id", label: "Responsável", type: "select", options: owners },
    { name: "status", label: "Status", type: "select", options: selectOpts(KPI_STATUS) },
  ];
}

function kpiPayload(v: FormValues, owner: (v: FormValues, k?: string) => string | null) {
  return {
    name: v.name,
    pillar_id: v.pillar_id && v.pillar_id !== "none" ? v.pillar_id : null,
    objective_id: v.objective_id && v.objective_id !== "none" ? v.objective_id : null,
    unit: toNullable(v.unit),
    formula: toNullable(v.formula),
    source: toNullable(v.source),
    frequency: v.frequency || "monthly",
    direction: v.direction || "higher_better",
    baseline_value: toNumeric(v.baseline_value),
    target_value: toNumeric(v.target_value),
    owner_user_id: owner(v),
    status: v.status || "draft",
  };
}

function measurementFields(kpis: Kpi[]): Field[] {
  return [
    {
      name: "kpi_id",
      label: "KPI",
      type: "select",
      required: true,
      options: kpis.map((k) => ({ value: k.id, label: k.name })),
    },
    { name: "period_start", label: "Início do período", type: "date", required: true },
    { name: "period_end", label: "Fim do período", type: "date", required: true },
    { name: "value", label: "Valor realizado", type: "number", step: "any", required: true },
    { name: "source_evidence", label: "Fonte / evidência", type: "text" },
    { name: "notes", label: "Observação", type: "textarea" },
  ];
}

function riskFields(objectives: Opt[], owners: Opt[]): Field[] {
  return [
    { name: "title", label: "Risco", type: "text", required: true },
    {
      name: "objective_id",
      label: "Objetivo relacionado",
      type: "select",
      options: [{ value: "none", label: "Sem objetivo" }, ...objectives],
    },
    { name: "description", label: "Descrição", type: "textarea" },
    { name: "impact", label: "Impacto", type: "select", options: selectOpts(LEVEL) },
    { name: "probability", label: "Probabilidade", type: "select", options: selectOpts(LEVEL) },
    { name: "contingency", label: "Contingência", type: "textarea" },
    { name: "owner_user_id", label: "Responsável", type: "select", options: owners },
    { name: "status", label: "Status", type: "select", options: selectOpts(RISK_STATUS) },
  ];
}

/* ---------- blocos ---------- */

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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

function NewButton({
  label,
  title,
  description,
  fields,
  initial,
  onSubmit,
  onDone,
}: {
  label: string;
  title: string;
  description?: string;
  fields: Field[];
  initial?: FormValues;
  onSubmit: (v: FormValues) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          await onSubmit(v);
          onDone();
          toast.success("Registro criado.");
        }}
      />
    </>
  );
}

function EditButton({
  title,
  fields,
  initial,
  onSubmit,
  onDone,
}: {
  title: string;
  fields: Field[];
  initial: FormValues;
  onSubmit: (v: FormValues) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          await onSubmit(v);
          onDone();
          toast.success("Registro atualizado.");
        }}
      />
    </>
  );
}

function PlanEditor({
  plan,
  onSave,
}: {
  plan: Plan;
  onSave: (v: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar ciclo
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Editar planejamento"
        fields={[
          { name: "title", label: "Título", type: "text", required: true },
          { name: "description", label: "Descrição", type: "textarea" },
          { name: "cycle_start", label: "Início do ciclo", type: "date", required: true },
          { name: "cycle_end", label: "Fim do ciclo", type: "date", required: true },
          { name: "status", label: "Status", type: "select", options: selectOpts(PLAN_STATUS) },
        ]}
        initial={{
          title: plan.title,
          description: plan.description ?? "",
          cycle_start: plan.cycleStart,
          cycle_end: plan.cycleEnd,
          status: plan.status,
        }}
        onSubmit={async (v) => {
          onSave({
            title: v.title,
            description: toNullable(v.description),
            cycle_start: v.cycle_start,
            cycle_end: v.cycle_end,
            status: v.status,
          });
        }}
      />
    </>
  );
}

function PillarEditor({
  pillar,
  onSave,
}: {
  pillar: {
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    status: string;
  };
  onSave: (v: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar pilar
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Editar pilar"
        fields={[
          { name: "title", label: "Título", type: "text", required: true },
          { name: "description", label: "Descrição", type: "textarea" },
          { name: "sort_order", label: "Ordem", type: "number", min: 0 },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Ativo" },
              { value: "archived", label: "Arquivado" },
            ],
          },
        ]}
        initial={{
          title: pillar.title,
          description: pillar.description ?? "",
          sort_order: String(pillar.sortOrder),
          status: pillar.status,
        }}
        onSubmit={async (v) => {
          onSave({
            title: v.title,
            description: toNullable(v.description),
            sort_order: toNumeric(v.sort_order) ?? 0,
            status: v.status,
          });
        }}
      />
    </>
  );
}

function KpiCard({
  kpi,
  canEdit,
  pillarOpts,
  objectiveOpts,
  ownerOpts,
  owner,
  onDone,
  save,
}: {
  kpi: Kpi;
  canEdit: boolean;
  pillarOpts: Opt[];
  objectiveOpts: Opt[];
  ownerOpts: Opt[];
  owner: (v: FormValues, k?: string) => string | null;
  onDone: () => void;
  save: (fn: () => Promise<void>) => void;
}) {
  const incomplete = isKpiIncomplete(kpi);
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{kpi.name}</h3>
          <div className="flex gap-2">
            {incomplete ? (
              <Badge variant="destructive">Configuração incompleta</Badge>
            ) : (
              <Badge variant="outline">Configurado</Badge>
            )}
            <Badge variant="secondary">{KPI_STATUS[kpi.status] ?? kpi.status}</Badge>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          <Info label="Periodicidade" value={FREQUENCY[kpi.frequency] ?? kpi.frequency} />
          <Info label="Direção" value={DIRECTION[kpi.direction] ?? kpi.direction} />
          <Info label="Unidade" value={kpi.unit ?? "—"} />
          <Info label="Baseline" value={fmtNumber(kpi.baselineValue, kpi.unit)} />
          <Info label="Meta" value={fmtNumber(kpi.targetValue, kpi.unit)} />
          <Info label="Responsável" value={ownerLabel(kpi.ownerUserId)} />
          <Info label="Fórmula" value={kpi.formula ?? "Não informada"} />
          <Info label="Fonte" value={kpi.source ?? "Não informada"} />
        </dl>
        {canEdit ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <EditButton
              title="Editar KPI"
              fields={kpiFields(pillarOpts, objectiveOpts, ownerOpts)}
              initial={{
                name: kpi.name,
                pillar_id: kpi.pillarId ?? "none",
                objective_id: kpi.objectiveId ?? "none",
                unit: kpi.unit ?? "",
                formula: kpi.formula ?? "",
                source: kpi.source ?? "",
                frequency: kpi.frequency,
                direction: kpi.direction,
                baseline_value: kpi.baselineValue === null ? "" : String(kpi.baselineValue),
                target_value: kpi.targetValue === null ? "" : String(kpi.targetValue),
                owner_user_id: kpi.ownerUserId ?? "none",
                status: kpi.status,
              }}
              onSubmit={async (v) => updateRow("kpis", kpi.id, kpiPayload(v, owner))}
              onDone={onDone}
            />
            {kpi.status !== "archived" ? (
              <ConfirmAction
                trigger={
                  <Button size="sm" variant="ghost">
                    Arquivar
                  </Button>
                }
                title="Arquivar KPI?"
                description="O KPI e seu histórico permanecem registrados; apenas deixa de ser acompanhado."
                actionLabel="Arquivar"
                onConfirm={() => save(() => updateRow("kpis", kpi.id, { status: "archived" }))}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MeasurementCard({
  m,
  kpiName,
  unit,
  canEdit,
  onValidate,
}: {
  m: Measurement;
  kpiName: string;
  unit: string | null;
  canEdit: boolean;
  onValidate: (status: "validated" | "rejected") => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{kpiName}</h3>
          <Badge
            variant={
              m.status === "validated"
                ? "default"
                : m.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            {MEASUREMENT_STATUS[m.status] ?? m.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Período de {fmtDate(m.periodStart)} a {fmtDate(m.periodEnd)}
        </p>
        <p className="text-lg font-bold tabular-nums">{fmtNumber(m.value, unit)}</p>
        {m.sourceEvidence ? (
          <p className="text-xs text-muted-foreground">Fonte: {m.sourceEvidence}</p>
        ) : null}
        {m.notes ? <p className="text-sm text-muted-foreground">{m.notes}</p> : null}
        {canEdit && m.status === "pending" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => onValidate("validated")}>
              Validar
            </Button>
            <ConfirmAction
              trigger={
                <Button size="sm" variant="outline">
                  Rejeitar
                </Button>
              }
              title="Rejeitar medição?"
              description="A medição permanece registrada com status rejeitada."
              actionLabel="Rejeitar"
              onConfirm={() => onValidate("rejected")}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RiskCard({
  r,
  canEdit,
  objectiveOpts,
  ownerOpts,
  owner,
  onDone,
}: {
  r: Risk;
  canEdit: boolean;
  objectiveOpts: Opt[];
  ownerOpts: Opt[];
  owner: (v: FormValues, k?: string) => string | null;
  onDone: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            {r.title}
          </h3>
          <Badge variant="outline">{RISK_STATUS[r.status] ?? r.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Impacto {LEVEL[r.impact]} · Probabilidade {LEVEL[r.probability]}
        </p>
        {r.description ? <p className="text-sm text-muted-foreground">{r.description}</p> : null}
        {r.contingency ? (
          <p className="text-sm">
            <span className="font-medium">Contingência:</span> {r.contingency}
          </p>
        ) : null}
        {canEdit ? (
          <EditButton
            title="Editar risco"
            fields={riskFields(objectiveOpts, ownerOpts)}
            initial={{
              title: r.title,
              objective_id: r.objectiveId ?? "none",
              description: r.description ?? "",
              impact: r.impact,
              probability: r.probability,
              contingency: r.contingency ?? "",
              owner_user_id: "none",
              status: r.status,
            }}
            onSubmit={async (v) =>
              updateRow("strategic_risks", r.id, {
                title: v.title,
                objective_id: v.objective_id && v.objective_id !== "none" ? v.objective_id : null,
                description: toNullable(v.description),
                impact: v.impact,
                probability: v.probability,
                contingency: toNullable(v.contingency),
                owner_user_id: owner(v),
                status: v.status,
              })
            }
            onDone={onDone}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

/**
 * Criação do ciclo de planejamento da filial selecionada.
 * organization_id, company_id e business_unit_id vêm exclusivamente do WorkspaceProvider
 * e não são campos editáveis. As constraints e a RLS revalidam tudo no servidor.
 */
function CreatePlan({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Criar planejamento
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Criar planejamento"
        description={`Ciclo estratégico de ${workspace.companyName} › ${workspace.businessUnitName}. Pilares, objetivos, KPIs e rotinas não são criados automaticamente.`}
        submitLabel="Criar planejamento"
        fields={[
          {
            name: "title",
            label: "Título do ciclo",
            type: "text",
            required: true,
            placeholder: "Ex.: Planejamento estratégico 2027",
          },
          { name: "description", label: "Descrição (opcional)", type: "textarea" },
          { name: "cycle_start", label: "Início do ciclo", type: "date", required: true },
          { name: "cycle_end", label: "Fim do ciclo", type: "date", required: true },
          { name: "status", label: "Status", type: "select", options: selectOpts(PLAN_STATUS) },
        ]}
        initial={{ title: "", description: "", cycle_start: "", cycle_end: "", status: "draft" }}
        onSubmit={async (v) => {
          const title = String(v.title ?? "").trim();
          const start = String(v.cycle_start ?? "").trim();
          const end = String(v.cycle_end ?? "").trim();
          if (title.length > 200) throw new Error("O título deve ter no máximo 200 caracteres.");
          if (!start || !end) throw new Error("Informe o início e o fim do ciclo.");
          if (end <= start) throw new Error("O fim do ciclo deve ser posterior ao início.");

          await insertRow("strategic_plans", {
            organization_id: workspace.organizationId,
            company_id: workspace.companyId,
            business_unit_id: workspace.businessUnitId,
            title,
            description: toNullable(v.description),
            cycle_start: start,
            cycle_end: end,
            status: String(v.status ?? "") || "draft",
          });
          onDone();
          toast.success("Planejamento criado.");
        }}
      />
    </>
  );
}

/** Cadeia visual objetivo → KPI (histórico e meta) → plano de ação, sem dados inventados. */
function ObjectiveChain({
  objective,
  kpis,
  measurements,
  actions,
}: {
  objective: Objective;
  kpis: Kpi[];
  measurements: Measurement[];
  actions: ActionPlan[];
}) {
  const linkedKpis = kpis.filter((k) => k.objectiveId === objective.id);
  const linkedActions = actions.filter(
    (a) =>
      a.objectiveId === objective.id ||
      (a.kpiId ? linkedKpis.some((k) => k.id === a.kpiId) : false),
  );

  if (!linkedKpis.length && !linkedActions.length) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Nenhum KPI ou plano de ação vinculado a este objetivo.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Objetivo › KPI › ação
      </p>
      {linkedKpis.length ? (
        <ul className="space-y-1.5">
          {linkedKpis.map((k) => {
            const hist = measurements
              .filter((m) => m.kpiId === k.id)
              .slice()
              .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
            const last = hist.length ? hist[hist.length - 1] : null;
            return (
              <li key={k.id} className="text-xs">
                <span className="font-medium">{k.name}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {last
                    ? `${fmtDate(last.periodStart)}: ${fmtNumber(last.value, k.unit)}`
                    : "sem medição registrada"}
                  {" · meta "}
                  {fmtNumber(k.targetValue, k.unit)}
                  {" · "}
                  {DIRECTION[k.direction] ?? k.direction}
                  {hist.length > 1 ? ` · ${hist.length} medições no histórico` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum KPI vinculado a este objetivo.</p>
      )}
      {linkedActions.length ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {linkedActions.map((a) => (
            <Badge key={a.id} variant="outline" className="font-normal">
              {a.title} · {ACTION_STATUS[a.status] ?? a.status} · {a.progress}%
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhum plano de ação vinculado a este objetivo ou aos seus KPIs.
        </p>
      )}
    </div>
  );
}
