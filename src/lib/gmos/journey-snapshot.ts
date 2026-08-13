// FASE F12.1-C2B — resumo compartilhado da Jornada Estratégica (Home + Jornada).
// Camada PURA: nenhuma consulta, nenhuma decisão escondida em fetch. Os fatos
// oficiais do F8 (`ready`, `issues`, status, reviewStatus) vêm da RPC
// `f8_plan_completeness` e são apenas propagados — o F8 não fornece percentual,
// então NÃO existe percentual de completude oficial aqui.
import type { BusinessFactsInput } from "./business-facts";
import { businessPortraitReadiness } from "./business-facts";
import {
  calculateMaturityScore,
  deriveJourneyStatus,
  deriveOfficialPlanAction,
  type Dimension,
  type JourneyDerivedStatus,
  type KpiSelection,
  type MaturityAnswer,
  type MaturityQuestion,
  type BusinessPortraitFacts,
  type MaturityScore,
  type OfficialPlanAction,
  type OfficialPlanFacts,
  type TemplateKpi,
} from "./strategy-recommendations";

export type JourneySnapshotInput = {
  hasProfile: boolean;
  /** Retrato do negócio (F8.1-B1). Null quando ainda não existe snapshot. */
  businessPortrait: BusinessFactsInput | null;
  /** Revisão do diagnóstico da Jornada (F12) — não confundir com o diagnóstico do Planejamento (F8). */
  diagnosisReviewedAt: string | null;
  questions: MaturityQuestion[];
  answers: MaturityAnswer[];
  diagnosisSignals: number;
  priorityDimensions: Dimension[];
  pendingObjectiveTemplateIds: string[];
  appliedObjectives: number;
  appliedKpis: number;
  existingObjectives: number;
  hasPlan: boolean;
  planEditable: boolean;
  kpiSelections: KpiSelection[];
  templateKpis: TemplateKpi[];
  /** Fatos da RPC oficial. Null = sem plano ou completude não consultada. */
  completeness: OfficialPlanFacts | null;
  /** True quando existe plano mas a validação formal falhou ao carregar. */
  completenessUnavailable?: boolean;
};

export type JourneyCtaTarget = "/jornada-estrategica" | "/planejamento";

export type JourneySummary = {
  maturity: MaturityScore;
  /** Fatos do Retrato do negócio, já reduzidos ao contrato da máquina de estado. */
  portrait: BusinessPortraitFacts | null;
  portraitCoveragePercent: number | null;
  derived: JourneyDerivedStatus;
  /** Ação do workflow oficial do plano, quando há completude conhecida. */
  officialAction: OfficialPlanAction | null;
  hasPlan: boolean;
  completeness: OfficialPlanFacts | null;
  completenessUnavailable: boolean;
  cta: { label: string; to: JourneyCtaTarget };
};

/** Única composição do resumo. `ready` nunca é derivado de `issues.length`. */
export function summarizeJourneySnapshot(input: JourneySnapshotInput): JourneySummary {
  const maturity = calculateMaturityScore(input.questions, input.answers);
  const completeness = input.completeness ?? null;

  const readiness = input.businessPortrait
    ? businessPortraitReadiness(input.businessPortrait)
    : null;
  const portrait: BusinessPortraitFacts | null = readiness
    ? {
        hasSnapshot: readiness.hasSnapshot,
        coreAnswered: readiness.missingCoreCodes.length === 0,
        reviewed: readiness.reviewed,
        coveragePercent: readiness.coveragePercent,
        missingCoreLabels: readiness.missingCoreLabels,
      }
    : null;

  const derived = deriveJourneyStatus({
    hasProfile: input.hasProfile,
    businessPortrait: portrait,
    maturity,
    diagnosisReviewed: Boolean(input.diagnosisReviewedAt),
    diagnosisSignals: input.diagnosisSignals,
    priorityDimensions: input.priorityDimensions,
    pendingObjectiveTemplateIds: input.pendingObjectiveTemplateIds,
    appliedObjectives: input.appliedObjectives,
    appliedKpis: input.appliedKpis,
    existingObjectives: input.existingObjectives,
    hasPlan: input.hasPlan,
    planEditable: input.planEditable,
    kpiSelections: input.kpiSelections,
    templateKpis: input.templateKpis,
    // O F8 não devolve percentual: o contrato permanece null por definição.
    officialPlanCompleteness: null,
    officialPlanReady: completeness ? completeness.ready : null,
  });

  const officialAction = deriveOfficialPlanAction(completeness);

  let cta: JourneySummary["cta"];
  if (derived.phase === "complete") {
    cta = { label: "Ver Jornada", to: "/jornada-estrategica" };
  } else if (derived.nextAction.href) {
    cta = { label: officialAction?.label ?? derived.nextAction.label, to: "/planejamento" };
  } else {
    cta = { label: "Continuar Jornada", to: "/jornada-estrategica" };
  }

  return {
    maturity,
    portrait,
    portraitCoveragePercent: portrait ? portrait.coveragePercent : null,
    derived,
    officialAction,
    hasPlan: input.hasPlan,
    completeness,
    completenessUnavailable: input.completenessUnavailable ?? false,
    cta,
  };
}

/** Linha executiva da maturidade: provisória enquanto o questionário não fecha. */
export function maturityLine(maturity: MaturityScore, bandLabel: string): string {
  return maturity.complete
    ? `Maturidade: ${bandLabel} · ${maturity.overall}/100`
    : `Maturidade: resultado provisório · ${maturity.answered}/${maturity.total} respostas`;
}

/** Validação formal do Planejamento (F8) em uma linha. Fonte: `completeness.ready`. */
export function officialPlanLine(summary: JourneySummary): string | null {
  if (!summary.hasPlan) return null;
  if (summary.completenessUnavailable || !summary.completeness) {
    return "Validação do Planejamento indisponível";
  }
  if (summary.completeness.ready) return "Planejamento: sem pendências de completude";
  const n = summary.completeness.issues.length;
  return `Planejamento: ${n} pendência(s)`;
}

/**
 * Linha executiva do Retrato do negócio. `coveragePercent` é sempre apresentado
 * como "dados disponíveis" — nunca como qualidade da empresa.
 */
export function businessPortraitLine(summary: JourneySummary): string {
  const p = summary.portrait;
  if (!p || !p.hasSnapshot) return "Retrato do negócio: não iniciado";
  if (!p.coreAnswered) {
    const n = p.missingCoreLabels?.length ?? 0;
    return `Retrato do negócio: ${n} item(ns) essencial(is) pendente(s)`;
  }
  if (!p.reviewed) return "Retrato do negócio: revisão necessária";
  return `Retrato do negócio: revisado · ${p.coveragePercent}% de dados disponíveis`;
}
