// FASE F12 — Jornada Estratégica: consultoria guiada determinística.
// Nada aqui concede acesso: RLS + public.has_permission decidem leitura e escrita,
// e a aplicação do rascunho no ciclo F8 acontece exclusivamente via f12_apply_strategy_draft.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  Pencil,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/gmos/page-header";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { useAuth } from "@/lib/auth-context";
import {
  JourneyOrientation,
  JourneyStepper,
  MaturityPanel,
  ReadOnlyNotice,
  RecommendationCard,
  SectionIntro,
  frequencyLabel,
} from "@/components/gmos/strategy-journey-ui";
import {
  BUSINESS_MODEL_LABEL,
  SIZE_BAND_LABEL,
  applyStrategyDraft,
  confirmDiagnosisReview,
  fetchAssessmentAnswers,
  fetchAssessmentQuestions,
  fetchCurrentPlan,
  fetchDecisions,
  fetchDiagnosisSelections,
  fetchDiagnosisStatements,
  fetchKpiDecisions,
  fetchPrioritySelections,
  fetchStrategyProfile,
  fetchTemplateKpis,
  fetchTemplateObjectives,
  saveAssessmentAnswer,
  saveDecision,
  saveJourneyStep,
  saveKpiDecision,
  savePrioritySelection,
  saveStrategyProfile,
  toggleDiagnosisSelection,
  type BusinessModel,
  type ProfileInput,
  type SizeBand,
} from "@/lib/gmos/strategy-journey";
import {
  DIMENSION_LABEL,
  DIMENSIONS,
  DRAFT_MAX,
  DRAFT_MIN,
  JOURNEY_STEPS,
  MATURITY_BAND_LABEL,
  PRIORITY_MAX,
  SECTOR_LABEL,
  STAGE_HELP,
  STAGE_LABEL,
  SWOT_LABEL,
  calculateMaturityScore,
  deriveJourneyStatus,
  derivePriorityThemes,
  diagnosisSummary,
  rankStrategicRecommendations,
  resolveJourneyResumeStep,
  validateStrategicDraft,
  validateKpiSelection,
  validatePrioritySelection,
  type Dimension,
  type JourneyDerivedStatus,
  type JourneyStep,
  type SectorCode,
  type Stage,
} from "@/lib/gmos/strategy-recommendations";
import {
  deriveOfficialPlanAction,
  type OfficialPlanFacts,
} from "@/lib/gmos/strategy-recommendations";
import { fetchCompleteness } from "@/lib/gmos/strategy";

export const Route = createFileRoute("/_authenticated/jornada-estrategica")({
  head: () => ({
    meta: [
      { title: "Jornada Estratégica — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Construa a estratégia da empresa passo a passo: perfil, maturidade, diagnóstico, prioridades e recomendações no GMOS.",
      },
      { property: "og:title", content: "Jornada Estratégica — GMOS · Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Consultoria guiada determinística: o GMOS organiza informações e recomenda caminhos; a liderança decide.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JornadaEstrategicaPage,
});

const SECTORS: SectorCode[] = ["general", "mining", "food_service"];
const STAGES: Stage[] = ["early", "turnaround", "growth", "consolidation"];
const MODELS = Object.keys(BUSINESS_MODEL_LABEL) as BusinessModel[];
const SIZES = Object.keys(SIZE_BAND_LABEL) as SizeBand[];

function JornadaEstrategicaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const wsCtx = useWorkspace();
  const { can } = useAuth();
  const ws = wsCtx.workspace;
  const bu = ws?.businessUnitId ?? null;
  const org = ws?.organizationId ?? null;
  const canRead = can("strategy.read", ws?.scopeId ?? null);
  const canManage = can("strategy.manage", ws?.scopeId ?? null);

  // Sem step inicial fixo: a retomada é derivada dos dados reais (F12.1-C2A).
  const [step, setStep] = useState<JourneyStep | null>(null);
  const [resumedFor, setResumedFor] = useState<string | null>(null);

  const key = (name: string) => ["gmos", "f12", name, bu] as const;

  const profileQ = useQuery({
    queryKey: key("profile"),
    queryFn: () => fetchStrategyProfile(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  const questionsQ = useQuery({
    queryKey: ["gmos", "f12", "questions"],
    queryFn: fetchAssessmentQuestions,
    enabled: canRead,
    retry: false,
  });
  const answersQ = useQuery({
    queryKey: key("answers"),
    queryFn: () => fetchAssessmentAnswers(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  const sector = profileQ.data?.sectorCode ?? "general";
  const statementsQ = useQuery({
    queryKey: ["gmos", "f12", "statements", sector],
    queryFn: () => fetchDiagnosisStatements(sector),
    enabled: canRead,
    retry: false,
  });
  const selectionsQ = useQuery({
    queryKey: key("selections"),
    queryFn: () => fetchDiagnosisSelections(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  const templatesQ = useQuery({
    queryKey: ["gmos", "f12", "templates"],
    queryFn: fetchTemplateObjectives,
    enabled: canRead,
    retry: false,
  });
  const templateKpisQ = useQuery({
    queryKey: ["gmos", "f12", "template-kpis"],
    queryFn: fetchTemplateKpis,
    enabled: canRead,
    retry: false,
  });
  const decisionsQ = useQuery({
    queryKey: key("decisions"),
    queryFn: () => fetchDecisions(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  const planQ = useQuery({
    queryKey: key("plan"),
    queryFn: () => fetchCurrentPlan(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  const kpiDecisionsQ = useQuery({
    queryKey: key("kpi-decisions"),
    queryFn: () => fetchKpiDecisions(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  const prioritiesQ = useQuery({
    queryKey: key("priorities"),
    queryFn: () => fetchPrioritySelections(bu!),
    enabled: Boolean(bu) && canRead,
    retry: false,
  });
  // Validação formal do Planejamento: RPC oficial f8_plan_completeness.
  // Sem plano, nada é consultado. Nenhum percentual é derivado dela.
  const planId = planQ.data?.id ?? null;
  const completenessQ = useQuery({
    queryKey: key(`completeness-${planId ?? "none"}`),
    queryFn: () => fetchCompleteness(planId!),
    enabled: Boolean(planId) && canRead,
    retry: false,
  });
  const officialFacts: OfficialPlanFacts | null = completenessQ.data
    ? {
        ready: completenessQ.data.ready,
        status: completenessQ.data.status,
        reviewStatus: completenessQ.data.reviewStatus,
        issues: completenessQ.data.issues,
      }
    : null;
  const officialAction = deriveOfficialPlanAction(officialFacts);

  const questions = useMemo(() => questionsQ.data ?? [], [questionsQ.data]);
  const answers = useMemo(() => answersQ.data ?? [], [answersQ.data]);
  const statements = useMemo(() => statementsQ.data ?? [], [statementsQ.data]);
  const selections = useMemo(() => selectionsQ.data ?? [], [selectionsQ.data]);
  const decisions = useMemo(() => decisionsQ.data ?? [], [decisionsQ.data]);

  const priorities = useMemo(() => prioritiesQ.data ?? [], [prioritiesQ.data]);
  const prioritySelection = useMemo(() => validatePrioritySelection(priorities), [priorities]);

  const maturity = useMemo(
    () =>
      calculateMaturityScore(
        questions,
        answers.map((a) => ({ questionId: a.questionId, score: a.optionScore })),
      ),
    [questions, answers],
  );
  const diagnosis = useMemo(
    () => diagnosisSummary(statements, selections),
    [statements, selections],
  );
  const recommendations = useMemo(() => {
    if (!profileQ.data) return [];
    return rankStrategicRecommendations({
      profile: { sectorCode: profileQ.data.sectorCode, stage: profileQ.data.stage },
      templates: templatesQ.data ?? [],
      kpis: templateKpisQ.data ?? [],
      maturity,
      diagnosis,
      priorityDimensions: priorities,
    });
  }, [profileQ.data, templatesQ.data, templateKpisQ.data, maturity, diagnosis, priorities]);

  const accepted = decisions.filter((d) => d.decision === "accepted");
  const pendingAccepted = accepted.filter((d) => !d.appliedObjectiveId);
  const draft = validateStrategicDraft(pendingAccepted.length, planQ.data?.objectiveCount ?? 0);
  const kpiDecisions = useMemo(() => kpiDecisionsQ.data ?? [], [kpiDecisionsQ.data]);
  const templateKpis = useMemo(() => templateKpisQ.data ?? [], [templateKpisQ.data]);
  /** Ausência de decisão = não selecionado. Só 'accepted' conta. */
  const selectedKpiIds = useMemo(
    () =>
      new Set(kpiDecisions.filter((d) => d.decision === "accepted").map((d) => d.templateKpiId)),
    [kpiDecisions],
  );
  const kpiSelection = useMemo(
    () =>
      validateKpiSelection(
        pendingAccepted.map((d) => d.templateObjectiveId),
        kpiDecisions,
        templateKpis,
      ),
    [pendingAccepted, kpiDecisions, templateKpis],
  );
  const themes = useMemo(() => derivePriorityThemes(maturity, diagnosis), [maturity, diagnosis]);

  const appliedDecisions = accepted.filter((d) => d.appliedObjectiveId);
  const appliedKpiCount = kpiDecisions.filter(
    (d) => d.decision === "accepted" && d.appliedKpiId,
  ).length;

  // ÚNICA fonte de verdade: progresso, etapa, retomada e próxima ação.
  const derived: JourneyDerivedStatus = deriveJourneyStatus({
    hasProfile: Boolean(profileQ.data),
    maturity,
    diagnosisReviewed: Boolean(profileQ.data?.diagnosisReviewedAt),
    diagnosisSignals: selections.length,
    priorityDimensions: priorities,
    pendingObjectiveTemplateIds: pendingAccepted.map((d) => d.templateObjectiveId),
    appliedObjectives: appliedDecisions.length,
    appliedKpis: appliedKpiCount,
    existingObjectives: planQ.data?.objectiveCount ?? 0,
    hasPlan: Boolean(planQ.data),
    planEditable: Boolean(planQ.data?.editable),
    kpiSelections: kpiDecisions,
    templateKpis,
    // Fato oficial do F8 (F12.1-C2B). O F8 não fornece percentual: fica null.
    officialPlanCompleteness: null,
    officialPlanReady: officialFacts ? officialFacts.ready : null,
  });

  const essentialsLoaded =
    Boolean(bu) &&
    !profileQ.isPending &&
    !questionsQ.isPending &&
    !answersQ.isPending &&
    !selectionsQ.isPending &&
    !decisionsQ.isPending &&
    !kpiDecisionsQ.isPending &&
    !prioritiesQ.isPending &&
    !planQ.isPending;

  // Retomada acontece uma única vez por unidade: navegação manual não é sobrescrita.
  useEffect(() => {
    if (!essentialsLoaded || !bu || resumedFor === bu) return;
    setStep(resolveJourneyResumeStep(derived, profileQ.data?.journeyStep ?? null));
    setResumedFor(bu);
  }, [essentialsLoaded, bu, resumedFor, derived, profileQ.data?.journeyStep]);

  const activeStep: JourneyStep = step ?? derived.resumeStep;
  const progress = {
    steps: derived.steps,
    completed: derived.completedSteps.length,
    total: derived.steps.length,
    percent: derived.percent,
    currentStep: derived.currentStep,
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["gmos", "f12"] });
  };

  const goStep = (next: JourneyStep) => {
    setStep(next);
    if (profileQ.data && canManage) void saveJourneyStep(profileQ.data.id, next).catch(() => {});
  };

  /* ----- mutações ----- */

  const profileMut = useMutation({
    mutationFn: (input: ProfileInput) =>
      saveStrategyProfile(
        { organizationId: org!, businessUnitId: bu!, profileId: profileQ.data?.id ?? null },
        input,
      ),
    onSuccess: () => {
      toast.success("Perfil registrado.");
      invalidate();
      setStep("maturity");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const answerMut = useMutation({
    mutationFn: (v: { questionId: string; optionValue: string; optionScore: number }) =>
      saveAssessmentAnswer({ organizationId: org!, businessUnitId: bu! }, v),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao registrar."),
  });

  const selectionMut = useMutation({
    mutationFn: (v: { statementId: string; selected: boolean }) =>
      toggleDiagnosisSelection(
        { organizationId: org!, businessUnitId: bu! },
        v.statementId,
        v.selected,
      ),
    onSuccess: () => {
      invalidate();
      if (profileQ.data?.diagnosisReviewedAt) {
        toast.info("Diagnóstico alterado: a revisão precisa ser concluída novamente.");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao registrar."),
  });

  const diagnosisReviewMut = useMutation({
    mutationFn: () => confirmDiagnosisReview(profileQ.data!.id),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.message || "Revisão do diagnóstico concluída.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao concluir a revisão."),
  });

  const decisionMut = useMutation({
    mutationFn: (v: {
      templateObjectiveId: string;
      decision: "accepted" | "discarded";
      customTitle?: string | null;
      customDescription?: string | null;
      score?: number | null;
      reasons?: string[];
    }) => saveDecision({ organizationId: org!, businessUnitId: bu! }, v),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao registrar."),
  });

  const kpiDecisionMut = useMutation({
    mutationFn: (v: {
      templateObjectiveId: string;
      templateKpiId: string;
      decision: "accepted" | "discarded";
    }) => saveKpiDecision({ organizationId: org!, businessUnitId: bu! }, v),
    onSuccess: () => invalidate(),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao registrar o indicador."),
  });

  const priorityMut = useMutation({
    mutationFn: (v: { dimension: Dimension; selected: boolean }) =>
      savePrioritySelection({ organizationId: org!, businessUnitId: bu! }, v.dimension, v.selected),
    onSuccess: () => invalidate(),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao registrar a prioridade."),
  });

  const applyMut = useMutation({
    mutationFn: () => applyStrategyDraft(planQ.data!.id),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      invalidate();
      toast.success(
        "Rascunho criado. Agora valide responsáveis, indicadores, fontes e metas antes de enviar o ciclo para aprovação.",
      );
      void navigate({ to: "/planejamento" });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar o rascunho."),
  });

  /* ----- estados de carregamento ----- */

  if (wsCtx.isPending) return <LoadingBlock />;
  if (wsCtx.error) return <ErrorBlock error={wsCtx.error} onRetry={wsCtx.refetch} />;
  if (!ws) {
    return (
      <StateCard
        title="Nenhuma unidade disponível"
        description="Seu acesso ainda não contempla uma filial. Solicite atribuição ao administrador do Grupo."
      />
    );
  }
  if (!canRead) {
    return (
      <StateCard
        title="Sem permissão"
        description="Seu perfil não possui permissão de leitura do planejamento nesta unidade."
      />
    );
  }

  const anyError =
    profileQ.error ??
    questionsQ.error ??
    answersQ.error ??
    statementsQ.error ??
    selectionsQ.error ??
    templatesQ.error ??
    templateKpisQ.error ??
    decisionsQ.error ??
    kpiDecisionsQ.error ??
    prioritiesQ.error ??
    planQ.error;
  if (anyError) return <ErrorBlock error={anyError} onRetry={invalidate} />;

  const loading =
    profileQ.isPending ||
    questionsQ.isPending ||
    answersQ.isPending ||
    statementsQ.isPending ||
    selectionsQ.isPending ||
    templatesQ.isPending ||
    templateKpisQ.isPending ||
    decisionsQ.isPending ||
    kpiDecisionsQ.isPending ||
    prioritiesQ.isPending ||
    planQ.isPending;

  const stepIndex = JOURNEY_STEPS.indexOf(activeStep);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Construa a estratégia da empresa passo a passo"
        description="O GMOS organiza informações, identifica lacunas e recomenda caminhos. A decisão continua sendo da liderança."
        crumbs={[{ label: "GMOS", to: "/" }, { label: "Jornada Estratégica" }]}
        context={`${ws.companyName} · ${ws.businessUnitName}`}
        actions={<Badge variant="outline">Recomendação não é decisão</Badge>}
      />

      <p className="text-sm text-muted-foreground">
        Não existe estratégia pronta. Existe decisão bem estruturada.
      </p>

      <JourneyOrientation
        derived={derived}
        onContinue={goStep}
        onOpenPlanning={() => void navigate({ to: "/planejamento" })}
      />

      <JourneyStepper progress={progress} active={activeStep} onSelect={goStep} />

      {!canManage ? <ReadOnlyNotice /> : null}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {activeStep === "profile" ? (
              <ProfileStep
                initial={
                  profileQ.data
                    ? {
                        sectorCode: profileQ.data.sectorCode,
                        businessModel: profileQ.data.businessModel,
                        stage: profileQ.data.stage,
                        horizonYears: profileQ.data.horizonYears,
                        sizeBand: profileQ.data.sizeBand,
                        mainChallenge: profileQ.data.mainChallenge ?? "",
                        notes: profileQ.data.notes ?? "",
                      }
                    : null
                }
                disabled={!canManage || profileMut.isPending}
                onSubmit={(v) => profileMut.mutate(v)}
              />
            ) : null}

            {activeStep === "maturity" ? (
              <MaturityStep
                questions={questions}
                answers={answers}
                disabled={!canManage || answerMut.isPending}
                onAnswer={(questionId, optionValue, optionScore) =>
                  answerMut.mutate({ questionId, optionValue, optionScore })
                }
                maturity={maturity}
              />
            ) : null}

            {activeStep === "diagnosis" ? (
              <DiagnosisStep
                statements={statements}
                selectedIds={new Set(selections.map((s) => s.statementId))}
                disabled={!canManage || selectionMut.isPending}
                onToggle={(statementId, selected) => selectionMut.mutate({ statementId, selected })}
                summary={diagnosis}
                reviewedAt={profileQ.data?.diagnosisReviewedAt ?? null}
                canConfirm={canManage && Boolean(profileQ.data)}
                confirming={diagnosisReviewMut.isPending}
                onConfirmReview={() => diagnosisReviewMut.mutate()}
              />
            ) : null}

            {activeStep === "priorities" ? (
              <PrioritiesStep
                themes={themes}
                selected={priorities}
                validation={prioritySelection}
                disabled={!canManage || priorityMut.isPending}
                onToggle={(dimension, selected) => {
                  if (selected && priorities.length >= PRIORITY_MAX) {
                    toast.error(
                      `Selecione no máximo ${PRIORITY_MAX} prioridades. Desmarque uma antes de escolher outra.`,
                    );
                    return;
                  }
                  priorityMut.mutate({ dimension, selected });
                }}
              />
            ) : null}

            {activeStep === "recommendations" ? (
              <RecommendationsStep
                recommendations={recommendations}
                decisions={decisions}
                disabled={!canManage || decisionMut.isPending}
                onDecide={(v) => decisionMut.mutate(v)}
                hasProfile={Boolean(profileQ.data)}
                selectedKpiIds={selectedKpiIds}
                kpiDisabled={!canManage || kpiDecisionMut.isPending}
                onToggleKpi={(templateObjectiveId, templateKpiId, selected) =>
                  kpiDecisionMut.mutate({
                    templateObjectiveId,
                    templateKpiId,
                    decision: selected ? "accepted" : "discarded",
                  })
                }
                missingKpiObjectiveIds={new Set(kpiSelection.missingObjectiveIds)}
              />
            ) : null}

            {activeStep === "review" ? (
              <ReviewStep
                profile={profileQ.data ?? null}
                maturity={maturity}
                themes={themes}
                priorities={priorities}
                prioritySelection={prioritySelection}
                recommendations={recommendations}
                decisions={decisions}
                plan={planQ.data ?? null}
                canManage={canManage}
                draft={draft}
                kpiSelection={kpiSelection}
                selectedKpiIds={selectedKpiIds}
                applying={applyMut.isPending}
                onApply={() => applyMut.mutate()}
                derived={derived}
                official={officialFacts}
                officialAction={officialAction}
                officialUnavailable={Boolean(planId) && Boolean(completenessQ.error)}
                officialLoading={Boolean(planId) && completenessQ.isPending}
                onOpenPlanning={() => void navigate({ to: "/planejamento" })}
              />
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={stepIndex === 0}
                onClick={() => goStep(JOURNEY_STEPS[Math.max(0, stepIndex - 1)])}
              >
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Etapa anterior
              </Button>
              <Button
                size="sm"
                disabled={stepIndex === JOURNEY_STEPS.length - 1}
                onClick={() =>
                  goStep(JOURNEY_STEPS[Math.min(JOURNEY_STEPS.length - 1, stepIndex + 1)])
                }
              >
                Próxima etapa <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Meu rascunho estratégico
                </p>
                <p className="text-3xl font-bold tracking-tight">
                  {pendingAccepted.length}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    {pendingAccepted.length === 1 ? "objetivo" : "objetivos"}
                  </span>
                </p>
                <Badge variant={draft.valid ? "secondary" : "outline"}>{draft.message}</Badge>
                <p className="text-xs text-muted-foreground">
                  {kpiSelection.selectedCount} indicador(es) selecionado(s) explicitamente.
                </p>
                <p className="text-xs text-muted-foreground">
                  {prioritySelection.count} de {PRIORITY_MAX} prioridades da liderança selecionadas.
                </p>
                {!prioritySelection.valid ? (
                  <p className="text-xs font-medium text-destructive">
                    {prioritySelection.message}
                  </p>
                ) : null}
                {!maturity.complete ? (
                  <p className="text-xs font-medium text-destructive">
                    Maturidade provisória: {maturity.answered} de {maturity.total} respostas.
                  </p>
                ) : null}
                {!kpiSelection.valid ? (
                  <p className="text-xs font-medium text-destructive">{kpiSelection.message}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  O ciclo deve terminar com {DRAFT_MIN} a {DRAFT_MAX} objetivos no total.{" "}
                  {planQ.data
                    ? `Já existem ${planQ.data.objectiveCount} no ciclo e ele comporta até ${draft.capacityRemaining} novo(s).`
                    : "Nenhum ciclo selecionado."}
                </p>
                <ul className="space-y-1 text-sm">
                  {pendingAccepted.map((d) => {
                    const rec = recommendations.find(
                      (r) => r.objective.id === d.templateObjectiveId,
                    );
                    return (
                      <li key={d.id} className="leading-snug">
                        • {d.customTitle ?? rec?.objective.title ?? "Objetivo selecionado"}
                      </li>
                    );
                  })}
                  {pendingAccepted.length === 0 ? (
                    <li className="text-muted-foreground">Nenhum objetivo selecionado ainda.</li>
                  ) : null}
                </ul>
                {activeStep !== "review" ? (
                  <Button size="sm" className="w-full" onClick={() => goStep("review")}>
                    Preparar planejamento
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="space-y-1 p-5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Menos indicadores, mais clareza.</p>
                <p>
                  O GMOS recomenda caminhos com base nas suas respostas. Você decide o que entra no
                  plano.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ---------------- etapa 1 ---------------- */

function ProfileStep({
  initial,
  disabled,
  onSubmit,
}: {
  initial: ProfileInput | null;
  disabled: boolean;
  onSubmit: (v: ProfileInput) => void;
}) {
  const [form, setForm] = useState<ProfileInput>(
    initial ?? {
      sectorCode: "general",
      businessModel: "b2b",
      stage: "growth",
      horizonYears: 2,
      sizeBand: "small",
      mainChallenge: "",
      notes: "",
    },
  );
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="space-y-4">
      <SectionIntro
        title="Perfil da empresa"
        description="Poucas informações estruturadas orientam todas as recomendações seguintes."
        hint="O perfil não é avaliação: ele define quais modelos de objetivo fazem sentido para esta unidade."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Setor de atuação</Label>
            <Select
              value={form.sectorCode}
              onValueChange={(v) => set("sectorCode", v as SectorCode)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SECTOR_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label>Modelo de negócio</Label>
            <Select
              value={form.businessModel}
              onValueChange={(v) => set("businessModel", v as BusinessModel)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {BUSINESS_MODEL_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label>Faixa de colaboradores</Label>
            <Select
              value={form.sizeBand}
              onValueChange={(v) => set("sizeBand", v as SizeBand)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SIZE_BAND_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label htmlFor="horizonte">Horizonte do ciclo (anos)</Label>
            <Input
              id="horizonte"
              type="number"
              min={1}
              max={5}
              value={form.horizonYears}
              disabled={disabled}
              onChange={(e) =>
                set("horizonYears", Math.min(5, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Momento da empresa</Label>
            <div className="grid gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => set("stage", s)}
                  className={`rounded-lg border p-3 text-left transition ${
                    form.stage === s ? "border-primary bg-primary/5" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="text-sm font-semibold">{STAGE_LABEL[s]}</span>
                  <span className="block text-xs text-muted-foreground">{STAGE_HELP[s]}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <Label htmlFor="desafio">Principal desafio hoje</Label>
          <Textarea
            id="desafio"
            rows={3}
            value={form.mainChallenge}
            disabled={disabled}
            placeholder="Em uma frase, o que mais atrapalha o resultado desta unidade hoje."
            onChange={(e) => set("mainChallenge", e.target.value)}
          />
          <Label htmlFor="notas">Observações da liderança (opcional)</Label>
          <Textarea
            id="notas"
            rows={2}
            value={form.notes}
            disabled={disabled}
            onChange={(e) => set("notes", e.target.value)}
          />
          <div className="pt-1">
            <Button disabled={disabled} onClick={() => onSubmit(form)}>
              Salvar perfil e continuar
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------------- etapa 2 ---------------- */

function MaturityStep({
  questions,
  answers,
  disabled,
  onAnswer,
  maturity,
}: {
  questions: Awaited<ReturnType<typeof fetchAssessmentQuestions>>;
  answers: Awaited<ReturnType<typeof fetchAssessmentAnswers>>;
  disabled: boolean;
  onAnswer: (questionId: string, optionValue: string, optionScore: number) => void;
  maturity: ReturnType<typeof calculateMaturityScore>;
}) {
  const answerBy = new Map(answers.map((a) => [a.questionId, a.optionValue]));
  const dims = Array.from(new Set(questions.map((q) => q.dimension)));

  return (
    <section className="space-y-4">
      <SectionIntro
        title="Maturidade de gestão"
        description="Escolha a alternativa que descreve a realidade atual. Não existe resposta certa: existe retrato honesto."
        hint="Escala: 0 não existe · 1 informal · 2 parcial · 3 estruturado · 4 gerenciado."
      />

      {questions.length === 0 ? (
        <StateCard
          title="Questionário indisponível"
          description="A biblioteca de perguntas não está acessível para o seu perfil."
        />
      ) : null}

      {dims.map((dim) => (
        <Card key={dim}>
          <CardContent className="space-y-4 p-5">
            <h3 className="text-sm font-semibold">{DIMENSION_LABEL[dim]}</h3>
            {questions
              .filter((q) => q.dimension === dim)
              .map((q) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium leading-snug">{q.prompt}</p>
                  {q.helpText ? (
                    <p className="text-xs text-muted-foreground">{q.helpText}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o) => {
                      const active = answerBy.get(q.id) === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => onAnswer(q.id, o.value, o.score)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          {o.score} — {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}

      {maturity.answered > 0 ? <MaturityPanel maturity={maturity} /> : null}
    </section>
  );
}

/* ---------------- etapa 3 ---------------- */

function DiagnosisStep({
  statements,
  selectedIds,
  disabled,
  onToggle,
  summary,
  reviewedAt,
  canConfirm,
  confirming,
  onConfirmReview,
}: {
  statements: Awaited<ReturnType<typeof fetchDiagnosisStatements>>;
  selectedIds: Set<string>;
  disabled: boolean;
  onToggle: (statementId: string, selected: boolean) => void;
  summary: ReturnType<typeof diagnosisSummary>;
  reviewedAt: string | null;
  canConfirm: boolean;
  confirming: boolean;
  onConfirmReview: () => void;
}) {
  return (
    <section className="space-y-4">
      <SectionIntro
        title="Diagnóstico guiado"
        description="Marque situações que representam sua operação hoje."
        hint="Só entram no diagnóstico as afirmações que você reconhecer. O GMOS não escreve narrativa por você."
      />

      {summary.bySwot.map((group) => {
        const items = statements.filter((s) => s.swotCategory === group.category);
        if (!items.length) return null;
        return (
          <Card key={group.category}>
            <CardContent className="space-y-3 p-5">
              <h3 className="text-sm font-semibold">{SWOT_LABEL[group.category]}</h3>
              <ul className="space-y-2">
                {items.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      id={s.id}
                      checked={selectedIds.has(s.id)}
                      disabled={disabled}
                      onCheckedChange={(v) => onToggle(s.id, v === true)}
                    />
                    <label htmlFor={s.id} className="min-w-0 cursor-pointer text-sm leading-snug">
                      {s.statement}
                      <span className="block text-[11px] text-muted-foreground">
                        {DIMENSION_LABEL[s.dimension]}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">Resumo do diagnóstico</h3>
          {summary.totalSignals === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma situação marcada ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {summary.byDimension
                .filter((d) => d.signals > 0)
                .map((d) => (
                  <li key={d.dimension} className="flex items-center justify-between gap-3">
                    <span>{DIMENSION_LABEL[d.dimension]}</span>
                    <span className="text-muted-foreground">
                      {d.signals} {d.signals === 1 ? "sinal" : "sinais"} · prioridade {d.pressure}
                    </span>
                  </li>
                ))}
            </ul>
          )}

          <div className="rounded-lg border border-dashed p-3">
            {reviewedAt ? (
              <p className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Revisão do diagnóstico concluída. Se você alterar qualquer seleção, a confirmação
                  é invalidada e uma nova revisão passa a ser exigida.
                </span>
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Você pode concluir sem marcar nenhum sinal. A confirmação registra que o
                  diagnóstico foi revisado.
                </p>
                <Button size="sm" disabled={!canConfirm || confirming} onClick={onConfirmReview}>
                  <Check className="mr-1 h-4 w-4" aria-hidden /> Concluir revisão do diagnóstico
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------------- etapa 4 ---------------- */

function PrioritiesStep({
  themes,
  selected,
  validation,
  disabled,
  onToggle,
}: {
  themes: ReturnType<typeof derivePriorityThemes>;
  selected: Dimension[];
  validation: ReturnType<typeof validatePrioritySelection>;
  disabled: boolean;
  onToggle: (dimension: Dimension, selected: boolean) => void;
}) {
  const isSelected = (d: Dimension) => selected.includes(d);
  return (
    <section className="space-y-4">
      <SectionIntro
        title="Prioridades"
        description={`Escolha de 1 a ${PRIORITY_MAX} temas que a liderança considera prioritários neste ciclo.`}
        hint="Tema sugerido pelo diagnóstico é leitura do sistema. Prioridade escolhida pela liderança é decisão registrada e influencia as recomendações."
      />

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Prioridades escolhidas pela liderança</h3>
            <Badge variant={validation.valid ? "secondary" : "outline"}>
              {validation.count} de {PRIORITY_MAX} prioridades selecionadas
            </Badge>
          </div>
          {!validation.valid ? (
            <p className="text-xs font-medium text-destructive">{validation.message}</p>
          ) : null}
          <ul className="grid gap-2 md:grid-cols-2">
            {DIMENSIONS.map((d) => {
              const active = isSelected(d);
              const blocked = !active && selected.length >= PRIORITY_MAX;
              return (
                <li key={d} className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id={`prio-${d}`}
                    className="mt-0.5"
                    checked={active}
                    disabled={disabled}
                    onCheckedChange={(v) => onToggle(d, v === true)}
                  />
                  <label htmlFor={`prio-${d}`} className="min-w-0 cursor-pointer text-sm">
                    <span className="font-medium">{DIMENSION_LABEL[d]}</span>
                    {active ? (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Prioridade da liderança
                      </Badge>
                    ) : null}
                    {blocked ? (
                      <span className="block text-[11px] text-muted-foreground">
                        Limite de {PRIORITY_MAX} atingido: desmarque uma prioridade para escolher
                        esta.
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <h3 className="pt-2 text-sm font-semibold">Temas sugeridos pelo diagnóstico</h3>
      {themes.length === 0 ? (
        <StateCard
          title="Ainda não há temas sugeridos"
          description="Complete a maturidade e marque o diagnóstico para que os temas sugeridos apareçam. Eles não substituem a escolha da liderança."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {themes.map((t) => (
            <div key={t.dimension} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{t.title}</span>
                <Badge variant="outline">{DIMENSION_LABEL[t.dimension]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {t.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              {isSelected(t.dimension) ? (
                <Badge variant="secondary" className="mt-2 text-[10px]">
                  Também é prioridade da liderança
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- etapa 5 ---------------- */

function RecommendationsStep({
  recommendations,
  decisions,
  disabled,
  onDecide,
  hasProfile,
  selectedKpiIds,
  kpiDisabled,
  onToggleKpi,
  missingKpiObjectiveIds,
}: {
  recommendations: ReturnType<typeof rankStrategicRecommendations>;
  decisions: Awaited<ReturnType<typeof fetchDecisions>>;
  disabled: boolean;
  onDecide: (v: {
    templateObjectiveId: string;
    decision: "accepted" | "discarded";
    customTitle?: string | null;
    customDescription?: string | null;
    score?: number | null;
    reasons?: string[];
  }) => void;
  hasProfile: boolean;
  selectedKpiIds: Set<string>;
  kpiDisabled: boolean;
  onToggleKpi: (templateObjectiveId: string, templateKpiId: string, selected: boolean) => void;
  missingKpiObjectiveIds: Set<string>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const decisionBy = new Map(decisions.map((d) => [d.templateObjectiveId, d]));

  if (!hasProfile) {
    return (
      <StateCard
        title="Complete o perfil primeiro"
        description="As recomendações dependem do setor e do momento informados na etapa 1."
      />
    );
  }

  return (
    <section className="space-y-4">
      <SectionIntro
        title="Recomendações"
        description="Modelos curados, ordenados pelas suas respostas. Cada card explica por que apareceu."
        hint="Adicionar ao rascunho não cria objetivo oficial: nada entra no planejamento sem a etapa final."
      />

      {recommendations.length === 0 ? (
        <StateCard
          title="Nenhuma recomendação disponível"
          description="A biblioteca curada não retornou modelos aplicáveis a este perfil."
        />
      ) : null}

      {recommendations.map((rec) => {
        const decision = decisionBy.get(rec.objective.id);
        const state = decision?.decision ?? "pending";
        const isEditing = editing === rec.objective.id;
        return (
          <div key={rec.objective.id} className="space-y-2">
            <RecommendationCard
              recommendation={rec}
              state={state}
              selectedKpiIds={selectedKpiIds}
              kpiDisabled={kpiDisabled}
              onToggleKpi={(templateKpiId, selected) =>
                onToggleKpi(rec.objective.id, templateKpiId, selected)
              }
              showKpiWarning={state === "accepted" && missingKpiObjectiveIds.has(rec.objective.id)}
              actions={
                <>
                  {state !== "accepted" ? (
                    <Button
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        onDecide({
                          templateObjectiveId: rec.objective.id,
                          decision: "accepted",
                          score: rec.score,
                          reasons: rec.reasons,
                        })
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar ao rascunho
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        onDecide({
                          templateObjectiveId: rec.objective.id,
                          decision: "discarded",
                          customTitle: decision?.customTitle ?? null,
                          customDescription: decision?.customDescription ?? null,
                          score: rec.score,
                          reasons: rec.reasons,
                        })
                      }
                    >
                      <Undo2 className="mr-1 h-4 w-4" aria-hidden /> Remover do rascunho
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => {
                      setEditing(isEditing ? null : rec.objective.id);
                      setTitle(decision?.customTitle ?? rec.objective.title);
                      setDescription(decision?.customDescription ?? rec.objective.description);
                    }}
                  >
                    <Pencil className="mr-1 h-4 w-4" aria-hidden /> Editar antes de adicionar
                  </Button>
                  {state !== "discarded" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() =>
                        onDecide({
                          templateObjectiveId: rec.objective.id,
                          decision: "discarded",
                          score: rec.score,
                          reasons: rec.reasons,
                        })
                      }
                    >
                      <X className="mr-1 h-4 w-4" aria-hidden /> Descartar
                    </Button>
                  ) : null}
                </>
              }
            />
            {isEditing ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <Label htmlFor={`t-${rec.objective.id}`}>Título do objetivo</Label>
                  <Input
                    id={`t-${rec.objective.id}`}
                    value={title}
                    disabled={disabled}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <Label htmlFor={`d-${rec.objective.id}`}>Descrição</Label>
                  <Textarea
                    id={`d-${rec.objective.id}`}
                    rows={3}
                    value={description}
                    disabled={disabled}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={disabled || title.trim().length === 0}
                      onClick={() => {
                        onDecide({
                          templateObjectiveId: rec.objective.id,
                          decision: "accepted",
                          customTitle: title.trim(),
                          customDescription: description.trim() || null,
                          score: rec.score,
                          reasons: rec.reasons,
                        });
                        setEditing(null);
                      }}
                    >
                      <Check className="mr-1 h-4 w-4" aria-hidden /> Salvar e adicionar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- etapa 6 ---------------- */

function ReviewStep({
  profile,
  maturity,
  themes,
  priorities,
  prioritySelection,
  recommendations,
  decisions,
  plan,
  canManage,
  draft,
  kpiSelection,
  selectedKpiIds,
  applying,
  onApply,
  derived,
}: {
  profile: Awaited<ReturnType<typeof fetchStrategyProfile>>;
  maturity: ReturnType<typeof calculateMaturityScore>;
  official: OfficialPlanFacts | null;
  themes: ReturnType<typeof derivePriorityThemes>;
  priorities: Dimension[];
  prioritySelection: ReturnType<typeof validatePrioritySelection>;
  recommendations: ReturnType<typeof rankStrategicRecommendations>;
  decisions: Awaited<ReturnType<typeof fetchDecisions>>;
  plan: Awaited<ReturnType<typeof fetchCurrentPlan>>;
  canManage: boolean;
  draft: ReturnType<typeof validateStrategicDraft>;
  kpiSelection: ReturnType<typeof validateKpiSelection>;
  selectedKpiIds: Set<string>;
  applying: boolean;
  onApply: () => void;
  derived: JourneyDerivedStatus;
  official: OfficialPlanFacts | null;
  officialAction: ReturnType<typeof deriveOfficialPlanAction>;
  officialUnavailable: boolean;
  officialLoading: boolean;
  onOpenPlanning: () => void;
}) {
  const accepted = decisions.filter((d) => d.decision === "accepted" && !d.appliedObjectiveId);
  const eligibleCycle = Boolean(plan?.editable);
  const missingAnswers = Math.max(maturity.total - maturity.answered, 0);
  // O gate final é o estado central: nada aqui recalcula regra de negócio.
  const enabled = canManage && derived.readyToApply && !applying;

  return (
    <section className="space-y-4">
      <SectionIntro
        title="Preparar planejamento"
        description="Revisão executiva do que foi registrado e do que ainda depende de decisão humana."
      />

      <Card className="border-dashed">
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">
            Rascunho pendente: {derived.pendingObjectives} objetivo(s) e {derived.pendingKpis}{" "}
            indicador(es).
          </p>
          <p className="text-muted-foreground">
            Já levado ao planejamento neste ciclo: {derived.appliedObjectives} objetivo(s) e{" "}
            {derived.appliedKpis} indicador(es). Esse histórico não volta a ser pendência.
          </p>
          {!profile?.diagnosisReviewedAt ? (
            <p className="text-muted-foreground">
              A revisão do diagnóstico ainda não foi concluída.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <h3 className="text-sm font-semibold">Perfil da empresa</h3>
            {profile ? (
              <ul className="space-y-1 text-muted-foreground">
                <li>Setor: {SECTOR_LABEL[profile.sectorCode]}</li>
                <li>Momento: {STAGE_LABEL[profile.stage]}</li>
                <li>Modelo: {BUSINESS_MODEL_LABEL[profile.businessModel]}</li>
                <li>Porte: {SIZE_BAND_LABEL[profile.sizeBand]}</li>
                <li>Horizonte: {profile.horizonYears} ano(s)</li>
              </ul>
            ) : (
              <p className="text-muted-foreground">Perfil ainda não registrado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <h3 className="text-sm font-semibold">Maturidade</h3>
            {maturity.complete ? (
              <>
                <Badge variant="secondary">Concluída</Badge>
                <p className="text-muted-foreground">
                  Score {maturity.overall}/100 · {MATURITY_BAND_LABEL[maturity.band]}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Três maiores lacunas
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  {maturity.gaps.map((g) => (
                    <li key={g}>• {DIMENSION_LABEL[g]}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <Badge variant="outline">Resultado provisório</Badge>
                <p className="text-muted-foreground">
                  {maturity.answered} de {maturity.total} respostas · score parcial{" "}
                  {maturity.overall}/100 (provisório)
                </p>
                <p className="text-xs font-medium text-destructive">
                  Faltam {missingAnswers} resposta(s). Complete o questionário para ver a
                  classificação de maturidade e as principais lacunas.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <h3 className="text-sm font-semibold">Prioridades escolhidas pela liderança</h3>
          <p className="text-xs text-muted-foreground">
            Decisão humana registrada — de 1 a {PRIORITY_MAX} temas por ciclo.
          </p>
          {priorities.length ? (
            <ul className="space-y-1 text-muted-foreground">
              {priorities.map((d) => (
                <li key={d}>• {DIMENSION_LABEL[d]}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-medium text-destructive">{prioritySelection.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <h3 className="text-sm font-semibold">Temas sugeridos pelo diagnóstico</h3>
          {themes.length ? (
            <ul className="space-y-1 text-muted-foreground">
              {themes.slice(0, 5).map((t) => (
                <li key={t.dimension}>• {t.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nenhum tema derivado ainda.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">Rascunho estratégico</h3>
          <p className="text-xs text-muted-foreground">
            {plan
              ? `Este ciclo já tem ${draft.existing} objetivo(s) e comporta até ${draft.capacityRemaining} novo(s). Total final previsto: ${draft.finalCount}.`
              : "Nenhum ciclo de planejamento selecionado."}
          </p>
          {!draft.valid ? (
            <p className="text-xs font-medium text-destructive">{draft.message}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {accepted.length} novo(s) objetivo(s) · {kpiSelection.selectedCount} indicador(es)
            selecionado(s). Fonte, responsáveis, baseline e metas continuarão pendentes para
            validação no Planejamento.
          </p>
          {!kpiSelection.valid ? (
            <p className="text-xs font-medium text-destructive">{kpiSelection.message}</p>
          ) : null}
          {accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum objetivo aceito ainda.</p>
          ) : (
            <ul className="space-y-3">
              {accepted.map((d) => {
                const rec = recommendations.find((r) => r.objective.id === d.templateObjectiveId);
                return (
                  <li key={d.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">
                      {d.customTitle ?? rec?.objective.title ?? "Objetivo selecionado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.customDescription ?? rec?.objective.description ?? ""}
                    </p>
                    {rec?.relatedKpis.some((k) => selectedKpiIds.has(k.id)) ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Indicadores selecionados:{" "}
                        {rec.relatedKpis
                          .filter((k) => selectedKpiIds.has(k.id))
                          .map((k) => `${k.name} (${frequencyLabel(k.frequency)})`)
                          .join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-medium text-destructive">
                        Escolha pelo menos 1 indicador para este objetivo antes de levar o rascunho
                        ao planejamento.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="space-y-2 p-5 text-sm">
          <h3 className="text-sm font-semibold">O que o sistema NÃO decidiu por você</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Responsáveis por cada objetivo e indicador</li>
            <li>• Baseline real de cada indicador</li>
            <li>• Metas do ciclo</li>
            <li>• Fonte oficial dos dados</li>
            <li>• Validação da liderança</li>
            <li>• Aprovação e ativação do ciclo</li>
          </ul>
          <p className="pt-1 text-xs">
            O rascunho organiza boas hipóteses. O planejamento só se torna oficial depois que a
            liderança valida responsáveis, indicadores, metas e aprova o ciclo.
          </p>
        </CardContent>
      </Card>

      {!eligibleCycle ? (
        <StateCard
          title="Ciclo não elegível"
          description={
            plan
              ? "O ciclo vigente não está em rascunho editável (situação e revisão precisam estar em rascunho). Crie uma nova versão no planejamento antes de aplicar o rascunho."
              : "Esta unidade ainda não possui um ciclo de planejamento. Crie o ciclo em Planejamento para receber o rascunho."
          }
        />
      ) : null}

      <ConfirmAction
        title="Levar rascunho para o planejamento"
        description={`Serão criados ${accepted.length} novo(s) objetivo(s) e ${kpiSelection.selectedCount} indicador(es) selecionado(s), todos em rascunho. Fonte, responsáveis, baseline e metas continuarão pendentes para validação no Planejamento. O ciclo terminará com ${draft.finalCount} objetivo(s). Nada será aprovado nem ativado.`}
        actionLabel="Levar rascunho"
        onConfirm={onApply}
        trigger={
          <Button disabled={!enabled}>
            <Compass className="mr-1 h-4 w-4" aria-hidden /> Levar rascunho para o planejamento
          </Button>
        }
      />
    </section>
  );
}
