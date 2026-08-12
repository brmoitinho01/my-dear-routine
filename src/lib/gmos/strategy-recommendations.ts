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

  return templates
    // Prioridade humana nunca contorna o filtro de setor.
    .filter((t) => t.sectorCode === "general" || t.sectorCode === profile.sectorCode)
    .map<Recommendation>((objective) => {
      let score = clamp((objective.baseWeight > 0 ? objective.baseWeight : 1) * 10, 0, 20);

      score +=
        objective.sectorCode === profile.sectorCode && objective.sectorCode !== "general" ? 25 : 10;

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
  "maturity",
  "diagnosis",
  "priorities",
  "recommendations",
  "review",
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export const JOURNEY_STEP_LABEL: Record<JourneyStep, string> = {
  profile: "Perfil da empresa",
  maturity: "Maturidade de gestão",
  diagnosis: "Diagnóstico guiado",
  priorities: "Prioridades",
  recommendations: "Recomendações",
  review: "Preparar planejamento",
};

export type JourneyState = {
  hasProfile: boolean;
  answered: number;
  totalQuestions: number;
  diagnosisSignals: number;
  acceptedObjectives: number;
  appliedObjectives: number;
  /** completude do ciclo F8, quando já existe planejamento. */
  planReady: boolean;
  hasPlan: boolean;
};

export type JourneyProgress = {
  steps: { step: JourneyStep; label: string; done: boolean }[];
  completed: number;
  total: number;
  percent: number;
  currentStep: JourneyStep;
};

export function journeyProgress(state: JourneyState): JourneyProgress {
  const done: Record<JourneyStep, boolean> = {
    profile: state.hasProfile,
    maturity: state.totalQuestions > 0 && state.answered >= state.totalQuestions,
    diagnosis: state.diagnosisSignals > 0,
    priorities: state.diagnosisSignals > 0 || state.acceptedObjectives > 0,
    recommendations: state.acceptedObjectives >= DRAFT_MIN,
    review: state.appliedObjectives > 0,
  };
  const steps = JOURNEY_STEPS.map((step) => ({
    step,
    label: JOURNEY_STEP_LABEL[step],
    done: done[step],
  }));
  const completed = steps.filter((s) => s.done).length;
  const currentStep = steps.find((s) => !s.done)?.step ?? "review";
  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    currentStep,
  };
}

export type NextAction = { step: JourneyStep; label: string };

export function nextJourneyAction(state: JourneyState): NextAction {
  if (!state.hasProfile) return { step: "profile", label: "Complete o perfil da empresa" };
  if (state.totalQuestions > 0 && state.answered < state.totalQuestions) {
    return { step: "maturity", label: "Responda o diagnóstico de maturidade" };
  }
  if (state.diagnosisSignals === 0) {
    return { step: "diagnosis", label: "Registre o diagnóstico guiado" };
  }
  if (state.acceptedObjectives === 0) {
    return { step: "recommendations", label: "Revise as recomendações" };
  }
  if (state.acceptedObjectives < DRAFT_MIN) {
    return { step: "recommendations", label: "Selecione pelo menos 3 objetivos" };
  }
  if (state.acceptedObjectives > DRAFT_MAX) {
    return { step: "recommendations", label: "Priorize: no máximo 7 objetivos" };
  }
  if (state.appliedObjectives === 0) {
    return { step: "review", label: "Leve o rascunho para o planejamento" };
  }
  if (state.hasPlan && !state.planReady) {
    return { step: "review", label: "Complete responsáveis e metas no planejamento" };
  }
  return { step: "review", label: "Jornada concluída: mantenha o ciclo em revisão" };
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

    const gapIndex = maturity.gaps.indexOf(dimension);
    if (gapIndex >= 0) {
      weight += 3 - gapIndex;
      reasons.push(
        `${DIMENSION_LABEL[dimension]} está entre as dimensões com menor maturidade registrada.`,
      );
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
