// FASE F12 — motor determinístico da Jornada Estratégica.
// Todas as funções deste arquivo são PURAS: mesma entrada, mesma saída.
// Não há IA, aleatoriedade, data/hora ou chamada externa. O banco continua sendo
// a fonte da autorização; aqui só existe cálculo explicável sobre dados registrados.

/* ---------------- dimensões e rótulos ---------------- */

export const DIMENSIONS = [
  "finance",
  "marketing_sales",
  "operations",
  "people",
  "governance",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  finance: "Finanças",
  marketing_sales: "Marketing e Vendas",
  operations: "Operações",
  people: "Pessoas",
  governance: "Governança",
};

export type SectorCode = "general" | "mining" | "food_service";

export const SECTOR_LABEL: Record<SectorCode, string> = {
  general: "Genérico (aplicável a vários setores)",
  mining: "Mineração",
  food_service: "Restaurante / Alimentação",
};

export type Stage = "early" | "growth" | "consolidation" | "turnaround";

export const STAGE_LABEL: Record<Stage, string> = {
  early: "Organizar",
  turnaround: "Estabilizar",
  growth: "Crescer",
  consolidation: "Escalar",
};

export const STAGE_HELP: Record<Stage, string> = {
  early: "Criar clareza, papéis e controles básicos.",
  turnaround: "Reduzir variação e tornar a operação previsível.",
  growth: "Aumentar receita e capacidade sem perder controle.",
  consolidation: "Criar gestão replicável e reduzir dependência de pessoas-chave.",
};

/* ---------------- maturidade ---------------- */

export type MaturityQuestion = {
  id: string;
  code: string;
  dimension: Dimension;
  weight: number;
  /** maior score possível entre as opções da pergunta (normalmente 4). */
  maxScore: number;
};

export type MaturityAnswer = { questionId: string; score: number };

export type MaturityBand = "initial" | "structuring" | "managed" | "scalable";

export const MATURITY_BAND_LABEL: Record<MaturityBand, string> = {
  initial: "Inicial",
  structuring: "Estruturando",
  managed: "Gerenciado",
  scalable: "Escalável",
};

export type DimensionScore = {
  dimension: Dimension;
  /** 0–100; null quando a dimensão ainda não tem resposta. */
  score: number | null;
  answered: number;
  total: number;
};

export type MaturityScore = {
  /** 0–100 considerando apenas perguntas respondidas. */
  overall: number;
  band: MaturityBand;
  answered: number;
  total: number;
  byDimension: DimensionScore[];
  /** até 3 dimensões com menor score — vazio enquanto o questionário estiver incompleto. */
  gaps: Dimension[];
  /** todas as perguntas ativas respondidas. */
  complete: boolean;
  /** 0–100 de conclusão do questionário. */
  completionPercent: number;
  /** resultado ainda provisório: não classifica maturidade nem influencia ranking. */
  isProvisional: boolean;
};

const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function maturityLevel(score: number): MaturityBand {
  if (score < 40) return "initial";
  if (score < 60) return "structuring";
  if (score < 80) return "managed";
  return "scalable";
}

export function calculateMaturityScore(
  questions: MaturityQuestion[],
  answers: MaturityAnswer[],
): MaturityScore {
  const answerById = new Map(answers.map((a) => [a.questionId, a.score]));

  let weighted = 0;
  let possible = 0;
  let answered = 0;

  const byDimension: DimensionScore[] = DIMENSIONS.map((dimension) => {
    const qs = questions.filter((q) => q.dimension === dimension);
    let dWeighted = 0;
    let dPossible = 0;
    let dAnswered = 0;
    for (const q of qs) {
      const raw = answerById.get(q.id);
      if (raw === undefined) continue;
      const max = q.maxScore > 0 ? q.maxScore : 4;
      const score = clamp(raw, 0, max);
      const weight = q.weight > 0 ? q.weight : 1;
      dWeighted += score * weight;
      dPossible += max * weight;
      dAnswered += 1;
    }
    weighted += dWeighted;
    possible += dPossible;
    answered += dAnswered;
    return {
      dimension,
      score: dPossible > 0 ? round((dWeighted / dPossible) * 100) : null,
      answered: dAnswered,
      total: qs.length,
    };
  });

  const overall = possible > 0 ? round((weighted / possible) * 100) : 0;
  const total = questions.length;
  const complete = total > 0 && answered === total;

  return {
    overall,
    band: maturityLevel(overall),
    answered,
    total,
    byDimension,
    // Enquanto incompleto não declaramos "3 maiores lacunas": 1 resposta não é diagnóstico.
    gaps: complete
      ? rankMaturityDimensions(byDimension)
          .slice(0, 3)
          .map((d) => d.dimension)
      : [],
    complete,
    completionPercent: total > 0 ? round((answered / total) * 100) : 0,
    isProvisional: !complete,
  };
}

/** Dimensões respondidas ordenadas do menor para o maior score (empate: ordem canônica). */
export function rankMaturityDimensions(byDimension: DimensionScore[]): DimensionScore[] {
  return byDimension
    .filter((d): d is DimensionScore & { score: number } => d.score !== null)
    .sort(
      (a, b) =>
        a.score - b.score || DIMENSIONS.indexOf(a.dimension) - DIMENSIONS.indexOf(b.dimension),
    );
}

/* ---------------- diagnóstico ---------------- */

export type SwotCategory = "strength" | "weakness" | "opportunity" | "threat";

export const SWOT_LABEL: Record<SwotCategory, string> = {
  strength: "Forças",
  weakness: "Fraquezas",
  opportunity: "Oportunidades",
  threat: "Ameaças",
};

export type DiagnosisStatement = {
  id: string;
  code: string;
  sectorCode: SectorCode;
  dimension: Dimension;
  swotCategory: SwotCategory;
  statement: string;
  weight: number;
  sortOrder: number;
};

export type DiagnosisSelection = {
  statementId: string;
  intensity: "low" | "medium" | "high";
};

const INTENSITY_FACTOR: Record<DiagnosisSelection["intensity"], number> = {
  low: 0.5,
  medium: 1,
  high: 1.5,
};

export type DiagnosisDimensionSummary = {
  dimension: Dimension;
  signals: number;
  /** soma de peso × intensidade dos sinais de atenção (fraquezas e ameaças). */
  pressure: number;
  statements: DiagnosisStatement[];
};

export type DiagnosisSummary = {
  totalSignals: number;
  byDimension: DiagnosisDimensionSummary[];
  bySwot: { category: SwotCategory; statements: DiagnosisStatement[] }[];
  /** dimensões com mais pressão registrada, da maior para a menor. */
  criticalDimensions: Dimension[];
};

export function diagnosisSummary(
  statements: DiagnosisStatement[],
  selections: DiagnosisSelection[],
): DiagnosisSummary {
  const intensityById = new Map(selections.map((s) => [s.statementId, s.intensity]));
  const selected = statements.filter((s) => intensityById.has(s.id));

  const byDimension: DiagnosisDimensionSummary[] = DIMENSIONS.map((dimension) => {
    const items = selected.filter((s) => s.dimension === dimension);
    const pressure = items
      .filter((s) => s.swotCategory === "weakness" || s.swotCategory === "threat")
      .reduce(
        (acc, s) =>
          acc + (s.weight > 0 ? s.weight : 1) * INTENSITY_FACTOR[intensityById.get(s.id)!],
        0,
      );
    return { dimension, signals: items.length, pressure: round(pressure), statements: items };
  });

  const bySwot = (Object.keys(SWOT_LABEL) as SwotCategory[]).map((category) => ({
    category,
    statements: selected.filter((s) => s.swotCategory === category),
  }));

  return {
    totalSignals: selected.length,
    byDimension,
    bySwot,
    criticalDimensions: byDimension
      .filter((d) => d.pressure > 0)
      .sort(
        (a, b) =>
          b.pressure - a.pressure ||
          DIMENSIONS.indexOf(a.dimension) - DIMENSIONS.indexOf(b.dimension),
      )
      .map((d) => d.dimension),
  };
}

/* ---------------- recomendações ---------------- */

export type TemplateKpiClass = "result" | "performance" | "quality";

export const KPI_CLASS_LABEL: Record<TemplateKpiClass, string> = {
  result: "Resultado",
  performance: "Performance",
  quality: "Qualidade",
};

export type TemplateKpi = {
  id: string;
  templateObjectiveId: string;
  code: string;
  name: string;
  kpiClass: TemplateKpiClass;
  description: string | null;
  unit: string | null;
  formula: string | null;
  sourceHint: string | null;
  direction: string;
  frequency: string;
  sortOrder: number;
};

export type TemplateObjective = {
  id: string;
  code: string;
  sectorCode: SectorCode;
  dimension: Dimension;
  stages: Stage[];
  title: string;
  description: string;
  rationale: string;
  baseWeight: number;
  sortOrder: number;
};

export type JourneyProfile = {
  sectorCode: SectorCode;
  stage: Stage;
};

export type Adherence = "high" | "medium" | "low";

export const ADHERENCE_LABEL: Record<Adherence, string> = {
  high: "Alta aderência",
  medium: "Média aderência",
  low: "Baixa aderência",
};

export type Recommendation = {
  objective: TemplateObjective;
  score: number;
  adherence: Adherence;
  reasons: string[];
  relatedKpis: TemplateKpi[];
};

export type RankInput = {
  profile: JourneyProfile;
  templates: TemplateObjective[];
  kpis: TemplateKpi[];
  maturity: MaturityScore;
  diagnosis: DiagnosisSummary;
  /** Dimensões marcadas explicitamente pela liderança como prioridade do ciclo. */
  priorityDimensions?: Dimension[];
};

/** Peso material e documentado da decisão humana de prioridade no ranking. */
export const PRIORITY_BONUS = 20;
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 3;

export function priorityReason(dimension: Dimension): string {
  return `A liderança marcou ${DIMENSION_LABEL[dimension]} como prioridade para este ciclo.`;
}

/**
 * Razões rastreáveis. Cada frase corresponde a um dado registrado pelo usuário
 * ou a um atributo do template curado — nunca a uma interpretação inventada.
 */
export function recommendationReasons(
  objective: TemplateObjective,
  input: Omit<RankInput, "templates" | "kpis">,
): string[] {
  const { profile, maturity, diagnosis, priorityDimensions = [] } = input;
  const reasons: string[] = [];

  // Decisão humana vem primeiro: é a razão mais forte e mais explicável.
  if (priorityDimensions.includes(objective.dimension)) {
    reasons.push(priorityReason(objective.dimension));
  }

  if (objective.sectorCode === profile.sectorCode && objective.sectorCode !== "general") {
    reasons.push(`O modelo é aplicável ao setor de ${sectorNoun(objective.sectorCode)}.`);
  }

  if (objective.stages.includes(profile.stage)) {
    reasons.push(
      `Este objetivo é recomendado para empresas na fase "${STAGE_LABEL[profile.stage]}".`,
    );
  }

  // Maturidade só sustenta razão depois de o questionário estar completo.
  if (maturity.complete && maturity.gaps.includes(objective.dimension)) {
    reasons.push(
      `${DIMENSION_LABEL[objective.dimension]} está entre as dimensões com menor maturidade registrada.`,
    );
  }

  const dimDiagnosis = diagnosis.byDimension.find((d) => d.dimension === objective.dimension);
  if (dimDiagnosis && dimDiagnosis.signals > 0) {
    reasons.push(
      dimDiagnosis.signals === 1
        ? `Você registrou 1 sinal de atenção em ${DIMENSION_LABEL[objective.dimension]}.`
        : `Você registrou ${dimDiagnosis.signals} sinais de atenção em ${DIMENSION_LABEL[objective.dimension]}.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push("Recomendado com base nas respostas registradas.");
  }

  return reasons.slice(0, 3);
}

function sectorNoun(sector: SectorCode): string {
  if (sector === "mining") return "mineração";
  if (sector === "food_service") return "restaurante e alimentação";
  return "aplicação geral";
}

export function recommendationAdherence(score: number): Adherence {
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/**
 * Ranking determinístico e explicável. Templates de outro setor específico são
 * descartados: um modelo de mineração não é oferecido a um restaurante.
 */
export function rankStrategicRecommendations(input: RankInput): Recommendation[] {
  const { profile, templates, kpis, maturity, diagnosis, priorityDimensions = [] } = input;
  const dimScore = new Map(maturity.byDimension.map((d) => [d.dimension, d.score]));
  const priorities = new Set(priorityDimensions);

  return (
    templates
      // Prioridade humana nunca contorna o filtro de setor.
      .filter((t) => t.sectorCode === "general" || t.sectorCode === profile.sectorCode)
      .map<Recommendation>((objective) => {
        let score = clamp((objective.baseWeight > 0 ? objective.baseWeight : 1) * 10, 0, 20);

        score +=
          objective.sectorCode === profile.sectorCode && objective.sectorCode !== "general"
            ? 25
            : 10;

        score += objective.stages.includes(profile.stage) ? 15 : -10;

        // Maturidade incompleta não distorce o ranking: nem bônus, nem penalidade.
        if (maturity.complete) {
          const gapIndex = maturity.gaps.indexOf(objective.dimension);
          if (gapIndex === 0) score += 20;
          else if (gapIndex === 1) score += 15;
          else if (gapIndex === 2) score += 10;
          else {
            const s = dimScore.get(objective.dimension);
            if (typeof s === "number" && s >= 80) score -= 5;
          }
        }

        if (priorities.has(objective.dimension)) score += PRIORITY_BONUS;

        const critical = diagnosis.criticalDimensions.indexOf(objective.dimension);
        if (critical === 0) score += 15;
        else if (critical > 0) score += 10;

        const dim = diagnosis.byDimension.find((d) => d.dimension === objective.dimension);
        if (dim && dim.signals > 0) score += Math.min(10, dim.signals * 3);

        const finalScore = round(clamp(score, 0, 100));

        return {
          objective,
          score: finalScore,
          adherence: recommendationAdherence(finalScore),
          reasons: recommendationReasons(objective, {
            profile,
            maturity,
            diagnosis,
            priorityDimensions,
          }),
          relatedKpis: kpis
            .filter((k) => k.templateObjectiveId === objective.id)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.objective.sortOrder - b.objective.sortOrder ||
          a.objective.code.localeCompare(b.objective.code),
      )
  );
}

/** Agrupa os KPIs sugeridos por classe, preservando a ordem curada. */
export function groupKpisByClass(kpis: TemplateKpi[]): {
  kpiClass: TemplateKpiClass;
  items: TemplateKpi[];
}[] {
  return (["result", "performance", "quality"] as TemplateKpiClass[])
    .map((kpiClass) => ({ kpiClass, items: kpis.filter((k) => k.kpiClass === kpiClass) }))
    .filter((g) => g.items.length > 0);
}

/* ---------------- rascunho e progresso ---------------- */

export const DRAFT_MIN = 3;
export const DRAFT_MAX = 7;

export type DraftValidation = {
  valid: boolean;
  status: "too_few" | "ok" | "too_many" | "over_limit";
  message: string;
  /** Objetivos válidos já existentes no ciclo. */
  existing: number;
  /** Total final do ciclo caso o rascunho seja aplicado. */
  finalCount: number;
  /** Quantos novos objetivos ainda cabem no ciclo. */
  capacityRemaining: number;
};

/**
 * A faixa 3–7 vale para o TOTAL FINAL do ciclo (objetivos existentes + novos),
 * exatamente como a completude do F8 conta objetivos válidos.
 */
export function validateStrategicDraft(acceptedCount: number, existingCount = 0): DraftValidation {
  const finalCount = existingCount + acceptedCount;
  const capacityRemaining = Math.max(DRAFT_MAX - existingCount, 0);
  const base = { existing: existingCount, finalCount, capacityRemaining };

  if (existingCount > DRAFT_MAX) {
    return {
      valid: false,
      status: "over_limit",
      message: `Este ciclo já tem ${existingCount} objetivos ativos, acima do limite de ${DRAFT_MAX}.`,
      ...base,
    };
  }
  if (finalCount > DRAFT_MAX) {
    return {
      valid: false,
      status: "too_many",
      message: `Este ciclo comporta até ${capacityRemaining} novo(s) objetivo(s).`,
      ...base,
    };
  }
  if (finalCount < DRAFT_MIN) {
    return {
      valid: false,
      status: "too_few",
      message: `O ciclo precisa terminar com ao menos ${DRAFT_MIN} objetivos: hoje há ${existingCount} e você selecionou ${acceptedCount}.`,
      ...base,
    };
  }
  return {
    valid: true,
    status: "ok",
    message: `Total final do ciclo: ${finalCount} objetivo(s).`,
    ...base,
  };
}

/* ---------------- seleção humana de indicadores (F12.1-B) ---------------- */

/** Decisão explícita de indicador. Ausência de registro = não selecionado. */
export type KpiSelection = {
  templateObjectiveId: string;
  templateKpiId: string;
  decision: "accepted" | "discarded";
};

/**
 * Indicadores aceitos de um objetivo do catálogo. Só conta decisão 'accepted' que
 * pertença àquele objetivo tanto na decisão quanto no próprio indicador do catálogo.
 */
export function acceptedKpiIds(
  templateObjectiveId: string,
  selections: KpiSelection[],
  kpis: TemplateKpi[],
): string[] {
  const owned = new Set(
    kpis.filter((k) => k.templateObjectiveId === templateObjectiveId).map((k) => k.id),
  );
  return selections
    .filter(
      (s) =>
        s.decision === "accepted" &&
        s.templateObjectiveId === templateObjectiveId &&
        owned.has(s.templateKpiId),
    )
    .map((s) => s.templateKpiId);
}

export type KpiSelectionValidation = {
  valid: boolean;
  /** Objetivos aceitos sem nenhum indicador escolhido. */
  missingObjectiveIds: string[];
  /** Total de indicadores explicitamente selecionados nos objetivos aceitos. */
  selectedCount: number;
  message: string;
};

/** Cada objetivo aceito precisa de ao menos 1 indicador escolhido — nunca um número fixo maior. */
export function validateKpiSelection(
  acceptedObjectiveTemplateIds: string[],
  selections: KpiSelection[],
  kpis: TemplateKpi[],
): KpiSelectionValidation {
  const missingObjectiveIds: string[] = [];
  let selectedCount = 0;
  for (const objectiveId of acceptedObjectiveTemplateIds) {
    const ids = acceptedKpiIds(objectiveId, selections, kpis);
    if (ids.length === 0) missingObjectiveIds.push(objectiveId);
    selectedCount += ids.length;
  }
  return {
    valid: missingObjectiveIds.length === 0,
    missingObjectiveIds,
    selectedCount,
    message: missingObjectiveIds.length
      ? "Selecione pelo menos um indicador para cada objetivo antes de levar o rascunho ao planejamento."
      : `${selectedCount} indicador(es) selecionado(s).`,
  };
}

export const JOURNEY_STEPS = [
  "profile",
  "business",
  "maturity",
  "diagnosis",
  "priorities",
  "recommendations",
  "review",
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export const JOURNEY_STEP_LABEL: Record<JourneyStep, string> = {
  profile: "Perfil da empresa",
  business: "Retrato do negócio",
  maturity: "Maturidade de gestão",
  diagnosis: "Diagnóstico guiado",
  priorities: "Prioridades",
  recommendations: "Recomendações",
  review: "Preparar planejamento",
};

/**
 * @deprecated F12.1-C2A.2 — contrato legado de entrada. Use `JourneyStatusInput`
 * com `deriveJourneyStatus`: este tipo não representa KPIs reais por objetivo
 * nem prioridades por dimensão. Mantido apenas por compatibilidade.
 */
export type JourneyState = {
  hasProfile: boolean;
  answered: number;
  totalQuestions: number;
  diagnosisSignals: number;
  /** confirmação explícita de revisão do diagnóstico (F12.1-C2A). */
  diagnosisReviewed?: boolean;
  /** prioridades explicitamente escolhidas pela liderança (1–3). */
  prioritiesSelected?: number;
  acceptedObjectives: number;
  appliedObjectives: number;
  /** objetivos válidos já existentes no ciclo F8. */
  existingObjectives?: number;
  /** ciclo F8 em rascunho editável. */
  planEditable?: boolean;
  /** completude do ciclo F8, quando já existe planejamento. */
  planReady: boolean;
  hasPlan: boolean;
};

export type JourneyProgress = {
  steps: { step: JourneyStep; label: string; done: boolean; blocked?: boolean; reason?: string }[];
  completed: number;
  total: number;
  percent: number;
  currentStep: JourneyStep;
};

/* ---------------- máquina central de estado (F12.1-C2A) ---------------- */

/**
 * Fases substantivas da Jornada. `applied` existe no contrato mas NÃO é emitida
 * nesta C2A: enquanto a completude oficial do F8 não está integrada, o estado
 * posterior à aplicação é sempre `formalizing_plan`. `complete` só é emitida se
 * alguém informar `officialPlanReady === true` — nunca é derivada aqui.
 */
export type JourneyPhase =
  | "not_started"
  | "profile"
  | "business"
  | "maturity"
  | "diagnosis"
  | "priorities"
  | "recommendations"
  | "ready_to_apply"
  | "applied"
  | "formalizing_plan"
  | "complete";

export type JourneyNextAction = {
  step?: JourneyStep;
  href?: string;
  label: string;
  reason?: string;
};

export const JOURNEY_PHASE_LABEL: Record<JourneyPhase, string> = {
  not_started: "Jornada não iniciada",
  profile: "Perfil da empresa",
  business: "Retrato do negócio",
  maturity: "Maturidade de gestão",
  diagnosis: "Diagnóstico guiado",
  priorities: "Prioridades da liderança",
  recommendations: "Montagem do rascunho",
  ready_to_apply: "Pronto para levar ao planejamento",
  applied: "Rascunho aplicado",
  formalizing_plan: "Formalizando o plano no Planejamento",
  complete: "Jornada estruturada · Planejamento sem pendências",
};

/* ---------------- validação formal do F8 (F12.1-C2B) ---------------- */

/**
 * Fatos oficiais do ciclo F8, exatamente como a RPC `f8_plan_completeness`
 * devolve. Tipo estrutural de propósito: este módulo é puro e não pode
 * importar a camada de acesso (`strategy.ts`).
 *
 * `ready` é SEMPRE do banco. Nada aqui recalcula completude, e o F8 não
 * fornece percentual — logo não existe percentual de completude oficial.
 */
export type OfficialPlanIssue = { code: string; section: string; message: string };

export type OfficialPlanFacts = {
  ready: boolean;
  status: string | null;
  reviewStatus: string | null;
  issues: OfficialPlanIssue[];
};

export type OfficialPlanActionKind =
  | "resolve_pendings"
  | "submit_for_review"
  | "follow_review"
  | "activate_cycle"
  | "open_active_cycle";

export type OfficialPlanAction = {
  kind: OfficialPlanActionKind;
  href: string;
  label: string;
  reason: string;
  issueCount: number;
};

/**
 * Próxima ação no workflow oficial do plano. Pura e composta na UI: não
 * duplica a regra de `ready`, que vem do banco, e não inventa completude.
 * Retorna null quando não há plano/completude consultada.
 */
export function deriveOfficialPlanAction(
  facts: OfficialPlanFacts | null | undefined,
): OfficialPlanAction | null {
  if (!facts) return null;
  const issues = facts.issues ?? [];
  if (!facts.ready) {
    const first = issues[0]?.message?.trim();
    return {
      kind: "resolve_pendings",
      href: PLANNING_HREF,
      label: "Resolver pendências no Planejamento",
      reason:
        first && first.length > 0 ? first : `Existem ${issues.length} pendências formais no plano.`,
      issueCount: issues.length,
    };
  }
  if (facts.status === "active") {
    return {
      kind: "open_active_cycle",
      href: PLANNING_HREF,
      label: "Abrir ciclo ativo",
      reason: "O ciclo está ativo e sem pendências de completude.",
      issueCount: 0,
    };
  }
  if (facts.reviewStatus === "in_review") {
    return {
      kind: "follow_review",
      href: PLANNING_HREF,
      label: "Acompanhar revisão do plano",
      reason: "O plano está em revisão pela liderança.",
      issueCount: 0,
    };
  }
  if (facts.reviewStatus === "approved") {
    return {
      kind: "activate_cycle",
      href: PLANNING_HREF,
      label: "Ativar ciclo no Planejamento",
      reason: "O plano está aprovado e ainda não foi ativado.",
      issueCount: 0,
    };
  }
  return {
    kind: "submit_for_review",
    href: PLANNING_HREF,
    label: "Enviar plano para revisão",
    reason: "Sem pendências de completude. O envio para revisão continua sendo decisão humana.",
    issueCount: 0,
  };
}

export type JourneyStepStatus = {
  step: JourneyStep;
  label: string;
  done: boolean;
  blocked: boolean;
  reason?: string;
};

export type JourneyDerivedStatus = {
  phase: JourneyPhase;
  currentStep: JourneyStep;
  resumeStep: JourneyStep;
  percent: number;
  completedSteps: JourneyStep[];
  steps: JourneyStepStatus[];
  nextAction: JourneyNextAction;
  readyToApply: boolean;
  applied: boolean;
  /** Rascunho pendente vs. histórico já levado ao Planejamento. */
  pendingObjectives: number;
  appliedObjectives: number;
  pendingKpis: number;
  appliedKpis: number;
  draft: DraftValidation;
  kpiSelection: KpiSelectionValidation;
  priority: PriorityValidation;
  /** Contrato preparado para a F12.1-C2B — nunca calculado no frontend. */
  officialPlanCompleteness: number | null;
  officialPlanReady: boolean | null;
};

/**
 * Fatos do Retrato do negócio (F8.1-B1), exatamente como a camada pura
 * `businessPortraitReadiness` os expõe. Tipo estrutural de propósito: este
 * módulo não importa `business-facts.ts` para não criar acoplamento circular.
 *
 * `coveragePercent` é SINAL DE CONFIANÇA para a futura recomendação — nunca
 * autorização: 35%, 60% ou 90% não bloqueiam a Jornada.
 */
export type BusinessPortraitFacts = {
  hasSnapshot: boolean;
  /** Todos os blocos essenciais respondidos (valor OU "não disponível"). */
  coreAnswered: boolean;
  reviewed: boolean;
  coveragePercent: number;
  missingCoreLabels?: string[];
};

export type JourneyStatusInput = {
  /** Perfil persistido e válido conforme o schema atual. */
  hasProfile: boolean;
  /**
   * Retrato do negócio. `undefined` = contrato legado (chamador anterior ao
   * F8.1-B1): a etapa fica neutra em vez de bloquear a Jornada.
   */
  businessPortrait?: BusinessPortraitFacts | null;
  maturity: Pick<MaturityScore, "complete" | "answered" | "total">;
  /** Confirmação explícita de revisão do diagnóstico (pode existir com 0 sinais). */
  diagnosisReviewed: boolean;
  diagnosisSignals: number;
  /** Prioridades da liderança persistidas com selected = true. */
  priorityDimensions: Dimension[];
  /** Objetivos aceitos ainda NÃO aplicados (applied_objective_id IS NULL). */
  pendingObjectiveTemplateIds: string[];
  /** Decisões de objetivo já aplicadas (histórico). */
  appliedObjectives: number;
  /** Indicadores aceitos ainda não aplicados / já aplicados (histórico). */
  pendingKpis?: number;
  appliedKpis?: number;
  /** Objetivos válidos já existentes no ciclo F8. */
  existingObjectives: number;
  hasPlan: boolean;
  planEditable: boolean;
  kpiSelections: KpiSelection[];
  templateKpis: TemplateKpi[];
  /** Vem da função oficial do F8 (F12.1-C2B). Null = ainda não consultada. */
  officialPlanCompleteness?: number | null;
  officialPlanReady?: boolean | null;
};

/** Percentual máximo enquanto a completude oficial do F8 não está integrada. */
export const JOURNEY_FORMALIZING_MAX_PERCENT = 95;

const PLANNING_HREF = "/planejamento";

/**
 * ÚNICA fonte de verdade da continuidade da Jornada. Pura, sem data/hora,
 * sem IA e sem side effect. Conclusão de etapa é sempre dado registrado —
 * nunca clique do usuário nem `journey_step` persistido.
 */
export function deriveJourneyStatus(input: JourneyStatusInput): JourneyDerivedStatus {
  const pendingIds = Array.from(new Set(input.pendingObjectiveTemplateIds));
  const applied = input.appliedObjectives > 0;

  const priority = validatePrioritySelection(input.priorityDimensions);
  const draft = validateStrategicDraft(pendingIds.length, input.existingObjectives);
  const kpiSelection = validateKpiSelection(pendingIds, input.kpiSelections, input.templateKpis);

  const profileDone = input.hasProfile;
  const portrait = input.businessPortrait;
  // Contrato legado (portrait ausente): etapa neutra, nunca bloqueio silencioso.
  const businessDone = portrait
    ? portrait.hasSnapshot && portrait.coreAnswered && portrait.reviewed
    : true;
  // Contrato legado (portrait ausente): a etapa espelha o perfil — não bloqueia
  // as seguintes, não infla a jornada intocada e não vira alvo de retomada.
  const businessCompleted = portrait ? businessDone : profileDone;
  const maturityDone = input.maturity.complete;
  const diagnosisDone = input.diagnosisReviewed;
  const prioritiesDone = priority.valid;
  const prerequisites =
    profileDone && businessDone && maturityDone && diagnosisDone && prioritiesDone;
  const draftPrepared = pendingIds.length > 0 && draft.valid && kpiSelection.valid;
  const recommendationsDone = draftPrepared || (applied && pendingIds.length === 0);
  const reviewDone = applied;

  const readyToApply = prerequisites && draftPrepared && input.hasPlan && input.planEditable;

  const doneMap: Record<JourneyStep, boolean> = {
    profile: profileDone,
    business: businessCompleted,
    maturity: maturityDone,
    diagnosis: diagnosisDone,
    priorities: prioritiesDone,
    recommendations: recommendationsDone,
    review: reviewDone,
  };

  const blockedReason = (step: JourneyStep): string | undefined => {
    if (step === "business" && !profileDone) {
      return "Complete o perfil da empresa antes de montar o Retrato do negócio.";
    }
    if (step === "maturity" && !businessDone) {
      return "Informe e revise o Retrato do negócio antes de avaliar a maturidade.";
    }
    if (step === "recommendations" && !prerequisites) {
      return "Complete perfil, retrato do negócio, maturidade, revisão do diagnóstico e prioridades antes de montar o rascunho.";
    }
    if (step === "review" && !prerequisites) {
      return "As etapas anteriores ainda têm pendências reais.";
    }
    if (step === "review" && !draftPrepared && !applied) {
      return "Nenhum rascunho pendente pronto para levar ao Planejamento.";
    }
    return undefined;
  };

  const steps: JourneyStepStatus[] = JOURNEY_STEPS.map((step) => {
    const reason = blockedReason(step);
    return {
      step,
      label: JOURNEY_STEP_LABEL[step],
      done: doneMap[step],
      blocked: Boolean(reason),
      ...(reason ? { reason } : {}),
    };
  });

  const completedSteps = steps.filter((s) => s.done).map((s) => s.step);
  const firstPending = steps.find((s) => !s.done)?.step;

  const officialPlanReady = input.officialPlanReady ?? null;
  const officialPlanCompleteness = input.officialPlanCompleteness ?? null;

  const nextAction = deriveNextAction({
    input,
    pendingIds,
    applied,
    priority,
    draft,
    kpiSelection,
    profileDone,
    businessDone,
    maturityDone,
    diagnosisDone,
    prioritiesDone,
    readyToApply,
  });

  let phase: JourneyPhase;
  if (applied && pendingIds.length === 0) {
    phase = officialPlanReady === true ? "complete" : "formalizing_plan";
  } else if (!profileDone) {
    const untouched =
      input.maturity.answered === 0 &&
      input.diagnosisSignals === 0 &&
      input.priorityDimensions.length === 0 &&
      pendingIds.length === 0 &&
      !applied;
    phase = untouched ? "not_started" : "profile";
  } else if (!businessDone) phase = "business";
  else if (!maturityDone) phase = "maturity";
  else if (!diagnosisDone) phase = "diagnosis";
  else if (!prioritiesDone) phase = "priorities";
  else if (!draftPrepared) phase = "recommendations";
  else if (readyToApply) phase = "ready_to_apply";
  else phase = "recommendations";

  const resumeStep: JourneyStep =
    applied && pendingIds.length === 0 ? "review" : (firstPending ?? "review");
  const currentStep: JourneyStep = nextAction.step ?? resumeStep;

  // 7 gates substantivos com peso igual (F8.1-B1 acrescentou o Retrato do negócio). Enquanto a completude oficial do F8
  // não está integrada (C2B), o topo é 95%: rascunho aplicado ≠ jornada concluída.
  const rawPercent = Math.round((completedSteps.length / JOURNEY_STEPS.length) * 100);
  const percent =
    phase === "formalizing_plan"
      ? Math.min(rawPercent, JOURNEY_FORMALIZING_MAX_PERCENT)
      : rawPercent;

  return {
    phase,
    currentStep,
    resumeStep,
    percent,
    completedSteps,
    steps,
    nextAction,
    readyToApply,
    applied,
    pendingObjectives: pendingIds.length,
    appliedObjectives: input.appliedObjectives,
    pendingKpis: input.pendingKpis ?? kpiSelection.selectedCount,
    appliedKpis: input.appliedKpis ?? 0,
    draft,
    kpiSelection,
    priority,
    officialPlanCompleteness,
    officialPlanReady,
  };
}

function deriveNextAction(args: {
  input: JourneyStatusInput;
  pendingIds: string[];
  applied: boolean;
  priority: PriorityValidation;
  draft: DraftValidation;
  kpiSelection: KpiSelectionValidation;
  profileDone: boolean;
  businessDone: boolean;
  maturityDone: boolean;
  diagnosisDone: boolean;
  prioritiesDone: boolean;
  readyToApply: boolean;
}): JourneyNextAction {
  const { input, pendingIds, applied, priority, draft, kpiSelection } = args;

  if (!args.profileDone) {
    return {
      step: "profile",
      label: "Complete o perfil da empresa",
      reason: "Sem perfil não existe recomendação aplicável ao setor e ao momento da empresa.",
    };
  }
  if (!args.businessDone) {
    const portrait = input.businessPortrait;
    if (!portrait || !portrait.hasSnapshot) {
      return {
        step: "business",
        label: "Comece o Retrato do negócio",
        reason:
          "Sem números registrados, qualquer recomendação seria genérica. Você não precisa ter todos os dados.",
      };
    }
    if (!portrait.coreAnswered) {
      const missing = portrait.missingCoreLabels ?? [];
      return {
        step: "business",
        label: "Complete os dados essenciais do negócio",
        reason: missing.length
          ? `Blocos essenciais sem resposta: ${missing.join(", ")}. "Não tenho este dado" também vale.`
          : 'Responda todos os blocos essenciais. "Não tenho este dado" também vale como resposta.',
      };
    }
    return {
      step: "business",
      label: "Revise e confirme o Retrato do negócio",
      reason: `Blocos essenciais respondidos · ${portrait.coveragePercent}% de dados disponíveis. A confirmação da revisão é decisão da liderança.`,
    };
  }
  if (!args.maturityDone) {
    const missing = Math.max(input.maturity.total - input.maturity.answered, 0);
    return {
      step: "maturity",
      label: "Continue o questionário de maturidade",
      reason: `Faltam ${missing} de ${input.maturity.total} respostas. Enquanto incompleto, o resultado é provisório e não influencia as recomendações.`,
    };
  }
  if (!args.diagnosisDone) {
    return {
      step: "diagnosis",
      label: "Conclua a revisão do diagnóstico",
      reason:
        input.diagnosisSignals === 0
          ? "Você pode concluir sem marcar nenhum sinal: a confirmação registra que o diagnóstico foi revisado."
          : `${input.diagnosisSignals} sinal(is) marcado(s). Falta confirmar a revisão do diagnóstico.`,
    };
  }
  if (!args.prioritiesDone) {
    return { step: "priorities", label: "Escolha de 1 a 3 prioridades", reason: priority.message };
  }
  if (pendingIds.length === 0 && !applied) {
    return {
      step: "recommendations",
      label: "Selecione os objetivos recomendados",
      reason: draft.message,
    };
  }
  if (pendingIds.length > 0 && !draft.valid) {
    return {
      step: "recommendations",
      label: "Revise os objetivos do ciclo",
      reason: draft.message,
    };
  }
  if (pendingIds.length > 0 && !kpiSelection.valid) {
    return {
      step: "recommendations",
      label: "Selecione indicadores para cada objetivo",
      reason: `${kpiSelection.missingObjectiveIds.length} objetivo(s) do rascunho ainda sem nenhum indicador escolhido.`,
    };
  }
  if (pendingIds.length > 0 && !input.hasPlan) {
    return {
      href: PLANNING_HREF,
      label: "Abrir Planejamento para criar o ciclo",
      reason: "Esta unidade ainda não tem um ciclo de planejamento para receber o rascunho.",
    };
  }
  if (pendingIds.length > 0 && !input.planEditable) {
    return {
      href: PLANNING_HREF,
      label: "Abrir Planejamento e usar um ciclo em rascunho",
      reason:
        "O ciclo vigente não está editável: situação e revisão precisam estar em rascunho para receber o rascunho da Jornada.",
    };
  }
  if (args.readyToApply) {
    return {
      step: "review",
      label: "Leve o rascunho para o Planejamento",
      reason: draft.message,
    };
  }
  if (applied) {
    return {
      href: PLANNING_HREF,
      label: "Formalizar no Planejamento",
      reason:
        "Rascunho aplicado. Responsáveis, fonte oficial, baseline e metas continuam sendo decisão da liderança no Planejamento.",
    };
  }
  return { step: "review", label: "Revise o rascunho estratégico", reason: draft.message };
}

/**
 * Reconciliação da retomada: `journey_step` é memória de navegação, nunca prova
 * de conclusão. Se ele aponta à frente de uma pendência real, retoma na pendência;
 * se aponta para trás e aquela etapa já está concluída, abre a próxima etapa útil.
 */
export function resolveJourneyResumeStep(
  derived: JourneyDerivedStatus,
  persistedStep: JourneyStep | null | undefined,
): JourneyStep {
  if (!persistedStep || !(JOURNEY_STEPS as readonly string[]).includes(persistedStep)) {
    return derived.resumeStep;
  }
  const rIdx = JOURNEY_STEPS.indexOf(derived.resumeStep);
  const pIdx = JOURNEY_STEPS.indexOf(persistedStep);
  if (pIdx > rIdx) return derived.resumeStep;
  const persisted = derived.steps[pIdx];
  if (persisted?.done) return derived.resumeStep;
  return persistedStep;
}

/* ---------------- wrappers de compatibilidade ---------------- */

function stateToStatusInput(state: JourneyState): JourneyStatusInput {
  const total = state.totalQuestions;
  const answered = state.answered;
  return {
    hasProfile: state.hasProfile,
    maturity: { complete: total > 0 && answered >= total, answered, total },
    diagnosisReviewed: state.diagnosisReviewed ?? false,
    diagnosisSignals: state.diagnosisSignals,
    priorityDimensions: DIMENSIONS.slice(0, state.prioritiesSelected ?? 0),
    pendingObjectiveTemplateIds: Array.from(
      { length: state.acceptedObjectives },
      (_, i) => `pending-${i}`,
    ),
    appliedObjectives: state.appliedObjectives,
    existingObjectives: state.existingObjectives ?? 0,
    hasPlan: state.hasPlan,
    planEditable: state.planEditable ?? state.hasPlan,
    kpiSelections: [],
    templateKpis: [],
  };
}

/**
 * @deprecated F12.1-C2A.2 — use `deriveJourneyStatus`. Wrapper de compatibilidade
 * sem callers em runtime; sintetiza ids de rascunho e não valida indicadores.
 */
export function journeyProgress(state: JourneyState): JourneyProgress {
  const derived = deriveJourneyStatus(stateToStatusInput(state));
  return {
    steps: derived.steps,
    completed: derived.completedSteps.length,
    total: derived.steps.length,
    percent: derived.percent,
    currentStep: derived.currentStep,
  };
}

export type NextAction = JourneyNextAction;

/**
 * @deprecated F12.1-C2A.2 — use `deriveJourneyStatus(...).nextAction`. Wrapper de
 * compatibilidade sem callers em runtime.
 */
export function nextJourneyAction(state: JourneyState): NextAction {
  return deriveJourneyStatus(stateToStatusInput(state)).nextAction;
}

/* ---------------- prioridades (derivadas) ---------------- */

export type PriorityTheme = {
  dimension: Dimension;
  title: string;
  description: string;
  /** sinais e lacunas que sustentam o tema. */
  reasons: string[];
  weight: number;
};

const PRIORITY_TITLE: Record<Dimension, { title: string; description: string }> = {
  finance: {
    title: "Previsibilidade financeira",
    description: "Resultado, custo e caixa acompanhados com números confiáveis.",
  },
  marketing_sales: {
    title: "Disciplina comercial",
    description: "Receita previsível, carteira acompanhada e cliente ouvido.",
  },
  operations: {
    title: "Eficiência operacional",
    description: "Padrão, rotina e evidência para reduzir variação.",
  },
  people: {
    title: "Desenvolvimento de liderança",
    description: "Papéis claros, equipe formada e menor dependência de pessoas-chave.",
  },
  governance: {
    title: "Clareza de gestão",
    description: "Ritual de acompanhamento com decisões registradas.",
  },
};

/** Temas prioritários derivados de maturidade + diagnóstico. Sem narrativa nova. */
export function derivePriorityThemes(
  maturity: MaturityScore,
  diagnosis: DiagnosisSummary,
): PriorityTheme[] {
  return DIMENSIONS.map((dimension) => {
    const reasons: string[] = [];
    let weight = 0;

    // Maturidade incompleta não deriva tema: o retrato ainda não existe.
    if (maturity.complete) {
      const gapIndex = maturity.gaps.indexOf(dimension);
      if (gapIndex >= 0) {
        weight += 3 - gapIndex;
        reasons.push(
          `${DIMENSION_LABEL[dimension]} está entre as dimensões com menor maturidade registrada.`,
        );
      }
    }
    const dim = diagnosis.byDimension.find((d) => d.dimension === dimension);
    if (dim && dim.signals > 0) {
      weight += dim.pressure;
      reasons.push(
        dim.signals === 1
          ? "1 sinal de atenção registrado no diagnóstico."
          : `${dim.signals} sinais de atenção registrados no diagnóstico.`,
      );
    }

    return {
      dimension,
      title: PRIORITY_TITLE[dimension].title,
      description: PRIORITY_TITLE[dimension].description,
      reasons,
      weight: round(weight),
    };
  })
    .filter((t) => t.weight > 0)
    .sort(
      (a, b) =>
        b.weight - a.weight || DIMENSIONS.indexOf(a.dimension) - DIMENSIONS.indexOf(b.dimension),
    );
}

/* ---------------- prioridades escolhidas pela liderança (F12.1-C1) ---------------- */

export type PriorityValidation = {
  valid: boolean;
  status: "too_few" | "ok" | "too_many";
  message: string;
  count: number;
};

/** Escolha humana focada: de 1 a 3 temas prioritários por ciclo. */
export function validatePrioritySelection(selectedDimensions: Dimension[]): PriorityValidation {
  const count = new Set(selectedDimensions).size;
  if (count < PRIORITY_MIN) {
    return {
      valid: false,
      status: "too_few",
      message: `Escolha de ${PRIORITY_MIN} a ${PRIORITY_MAX} temas que a liderança considera prioritários neste ciclo.`,
      count,
    };
  }
  if (count > PRIORITY_MAX) {
    return {
      valid: false,
      status: "too_many",
      message: `Selecione no máximo ${PRIORITY_MAX} prioridades para manter o foco do ciclo.`,
      count,
    };
  }
  return {
    valid: true,
    status: "ok",
    message: `${count} de ${PRIORITY_MAX} prioridades selecionadas.`,
    count,
  };
}
