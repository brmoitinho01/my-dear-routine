// FASE F8.1-B1 — contrato allowlisted para a futura camada de IA (F8.1-B2).
// Este módulo NÃO chama IA e não existe IA simulada aqui: ele apenas monta,
// de forma pura e determinística, o payload exato que a F8.1-B2 receberá.
//
// Invariantes de privacidade (testados):
// - nenhum nome, e-mail ou identificador de usuário;
// - nenhuma informação de permissão/RBAC, papel ou escopo;
// - nenhum metadado de auditoria;
// - uma única unidade de negócio por payload;
// - nenhum texto livre fora dos campos explicitamente allowlisted.
import {
  businessPortraitCoverage,
  businessPortraitReadiness,
  deriveBusinessMetrics,
  normalizeBusinessFacts,
  type BusinessFactsInput,
} from "./business-facts";
import type { Dimension, MaturityScore } from "./strategy-recommendations";

export const RECOMMENDATION_CONTEXT_VERSION = 1;

/** Códigos de fato que podem sair desta camada. Nada fora desta lista é serializado. */
export const ALLOWED_FACT_CODES: readonly string[] = [
  "annual_revenue_current",
  "annual_revenue_previous",
  "gross_margin_pct",
  "ebitda_margin_pct",
  "working_capital_days",
  "receivables_days",
  "active_customers",
  "top1_customer_revenue_pct",
  "top5_customer_revenue_pct",
  "recurring_revenue_pct",
  "qualified_opportunities_month",
  "win_rate_pct",
  "average_ticket",
  "customer_churn_pct",
  "capacity_utilization_pct",
  "on_time_delivery_pct",
  "rework_scrap_pct",
  "downtime_pct",
  "lead_time_days",
  "safety_incidents_12m",
  "headcount",
  "payroll_cost_pct_revenue",
  "turnover_pct",
  "absenteeism_pct",
  "leadership_positions",
  "filled_leadership_positions",
  "monthly_management_meeting",
  "kpis_actively_reviewed",
  "financial_close_days",
  "mining_stripping_ratio",
  "food_service_seat_turnover",
] as const;

export type ContextCompanyProfile = {
  sectorCode: string;
  businessModel: string;
  stage: string;
  sizeBand: string;
  horizonYears: number;
};

export type ContextDirectionChoices = {
  focusGroups: string[];
  valuePropositions: string[];
  competitiveEdges: string[];
  valueCodes: string[];
  ambition: string | null;
  priorityDimension: string | null;
  customFocus: string | null;
  customValueProposition: string | null;
  customCompetitiveEdge: string | null;
};

export type ContextDiagnosisStatement = {
  code: string;
  dimension: string;
  category: string;
};

export type RecommendationContextInput = {
  businessUnitId: string;
  companyProfile: ContextCompanyProfile | null;
  directionChoices: ContextDirectionChoices | null;
  portrait: BusinessFactsInput | null;
  maturity: MaturityScore | null;
  /** Somente sinais que a liderança marcou no diagnóstico. */
  selectedDiagnosisStatements: ContextDiagnosisStatement[];
  priorityDimensions: Dimension[];
  planCounts: { hasPlan: boolean; objectives: number; kpis: number };
};

export type ContextRawFact = {
  code: string;
  dimension: string;
  valueType: string;
  unit: string | null;
  value: number | boolean | string | null;
  confidence: "exact" | "estimated" | "unavailable";
};

export type ContextDerivedFact = {
  code: string;
  value: number;
  unit: string;
  evidence: string[];
  formula: string;
};

export type StrategicRecommendationContext = {
  contextVersion: number;
  businessUnitId: string;
  companyProfile: ContextCompanyProfile | null;
  directionChoices: ContextDirectionChoices | null;
  snapshot: {
    referenceDate: string;
    periodLabel: string | null;
    currencyCode: string;
    reviewStatus: "draft" | "reviewed";
  } | null;
  rawFacts: ContextRawFact[];
  derivedFacts: ContextDerivedFact[];
  portrait: {
    coveragePercent: number;
    reviewedPercent: number;
    estimatedCount: number;
    unavailableCount: number;
    readyForRecommendations: boolean;
    missingCoreGroups: string[];
  } | null;
  maturity: {
    complete: boolean;
    overall: number;
    answered: number;
    total: number;
    byDimension: { dimension: string; score: number }[];
  } | null;
  diagnosis: { selectedStatements: ContextDiagnosisStatement[] };
  priorities: string[];
  plan: { hasPlan: boolean; objectives: number; kpis: number };
  /** Nesta versão do contrato nunca existe benchmark externo confiável. */
  benchmarks: { available: false; note: string };
};

const trim = (v: string | null | undefined, max = 200): string | null => {
  const t = (v ?? "").trim();
  if (!t.length) return null;
  return t.length > max ? t.slice(0, max) : t;
};

const sortStrings = (list: string[]): string[] => [...list].sort((a, b) => a.localeCompare(b));

/**
 * Monta o payload da F8.1-B2. Determinístico: a mesma entrada produz sempre a
 * mesma saída (arrays ordenados, sem data/hora e sem aleatoriedade).
 */
export function buildStrategicRecommendationContext(
  input: RecommendationContextInput,
): StrategicRecommendationContext {
  const portraitInput = input.portrait;

  const rawFacts: ContextRawFact[] = portraitInput
    ? normalizeBusinessFacts(portraitInput.definitions, portraitInput.values)
        .filter((f) => f.answered && ALLOWED_FACT_CODES.includes(f.definition.code))
        .map((f) => ({
          code: f.definition.code,
          dimension: f.definition.dimension,
          valueType: f.definition.valueType,
          unit: f.definition.unit,
          value: f.unavailable ? null : (f.numeric ?? f.boolean ?? f.text ?? null),
          confidence: f.unavailable ? "unavailable" : f.estimated ? "estimated" : "exact",
        }))
        .sort((a, b) => a.code.localeCompare(b.code))
    : [];

  const derivedFacts: ContextDerivedFact[] = portraitInput
    ? deriveBusinessMetrics(portraitInput)
        .map((m) => ({
          code: m.code,
          value: m.value,
          unit: m.unit,
          evidence: sortStrings(m.evidence),
          formula: m.formula,
        }))
        .sort((a, b) => a.code.localeCompare(b.code))
    : [];

  const coverage = portraitInput ? businessPortraitCoverage(portraitInput) : null;
  const readiness = portraitInput ? businessPortraitReadiness(portraitInput) : null;

  const choices = input.directionChoices;

  return {
    contextVersion: RECOMMENDATION_CONTEXT_VERSION,
    businessUnitId: input.businessUnitId,
    companyProfile: input.companyProfile
      ? {
          sectorCode: input.companyProfile.sectorCode,
          businessModel: input.companyProfile.businessModel,
          stage: input.companyProfile.stage,
          sizeBand: input.companyProfile.sizeBand,
          horizonYears: input.companyProfile.horizonYears,
        }
      : null,
    directionChoices: choices
      ? {
          focusGroups: sortStrings(choices.focusGroups ?? []),
          valuePropositions: sortStrings(choices.valuePropositions ?? []),
          competitiveEdges: sortStrings(choices.competitiveEdges ?? []),
          valueCodes: sortStrings(choices.valueCodes ?? []),
          ambition: trim(choices.ambition),
          priorityDimension: trim(choices.priorityDimension, 40),
          customFocus: trim(choices.customFocus),
          customValueProposition: trim(choices.customValueProposition),
          customCompetitiveEdge: trim(choices.customCompetitiveEdge),
        }
      : null,
    snapshot: portraitInput?.snapshot
      ? {
          referenceDate: portraitInput.snapshot.referenceDate,
          periodLabel: portraitInput.snapshot.periodLabel,
          currencyCode: portraitInput.snapshot.currencyCode,
          reviewStatus: portraitInput.snapshot.reviewStatus,
        }
      : null,
    rawFacts,
    derivedFacts,
    portrait:
      coverage && readiness
        ? {
            coveragePercent: coverage.coveragePercent,
            reviewedPercent: coverage.reviewedPercent,
            estimatedCount: coverage.estimatedCount,
            unavailableCount: coverage.unavailableCount,
            readyForRecommendations: readiness.readyForRecommendations,
            missingCoreGroups: readiness.missingCoreCodes,
          }
        : null,
    maturity: input.maturity
      ? {
          complete: input.maturity.complete,
          overall: input.maturity.overall,
          answered: input.maturity.answered,
          total: input.maturity.total,
          byDimension: input.maturity.byDimension
            .map((d) => ({ dimension: d.dimension, score: d.score }))
            .sort((a, b) => a.dimension.localeCompare(b.dimension)),
        }
      : null,
    diagnosis: {
      selectedStatements: [...input.selectedDiagnosisStatements]
        .map((s) => ({ code: s.code, dimension: s.dimension, category: s.category }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    },
    priorities: sortStrings(input.priorityDimensions.map(String)),
    plan: {
      hasPlan: input.planCounts.hasPlan,
      objectives: input.planCounts.objectives,
      kpis: input.planCounts.kpis,
    },
    benchmarks: {
      available: false,
      note: "Sem benchmark externo disponível. Não classifique valores como altos ou baixos.",
    },
  };
}
