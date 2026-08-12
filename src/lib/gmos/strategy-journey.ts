// FASE F12 — camada de acesso da Jornada Estratégica.
// Sempre com o client normal do projeto: toda leitura e escrita passa por RLS e
// public.has_permission. Nenhuma chave de serviço, nenhuma decisão de acesso aqui.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";
import {
  DIMENSIONS,
  type Dimension,
  type DiagnosisSelection,
  type DiagnosisStatement,
  type JourneyStep,
  type MaturityQuestion,
  type SectorCode,
  type Stage,
  type SwotCategory,
  type TemplateKpi,
  type TemplateKpiClass,
  type TemplateObjective,
} from "./strategy-recommendations";

export const ASSESSMENT_VERSION = 1;
export const LIBRARY_VERSION = 1;

/* ---------------- tipos ---------------- */

export type BusinessModel = "b2b" | "b2c" | "b2b2c" | "industry" | "services";
export type SizeBand = "micro" | "small" | "medium" | "large";

export const BUSINESS_MODEL_LABEL: Record<BusinessModel, string> = {
  b2b: "Vende para empresas (B2B)",
  b2c: "Vende para o consumidor final (B2C)",
  b2b2c: "Modelo híbrido (B2B2C)",
  industry: "Indústria / produção",
  services: "Serviços",
};

export const SIZE_BAND_LABEL: Record<SizeBand, string> = {
  micro: "Até 9 colaboradores",
  small: "10 a 49 colaboradores",
  medium: "50 a 199 colaboradores",
  large: "200 ou mais colaboradores",
};

export type StrategyProfile = {
  id: string;
  organizationId: string;
  businessUnitId: string;
  sectorCode: SectorCode;
  businessModel: BusinessModel;
  stage: Stage;
  horizonYears: number;
  sizeBand: SizeBand;
  mainChallenge: string | null;
  notes: string | null;
  journeyStep: JourneyStep;
  updatedAt: string | null;
};

export type ProfileInput = {
  sectorCode: SectorCode;
  businessModel: BusinessModel;
  stage: Stage;
  horizonYears: number;
  sizeBand: SizeBand;
  mainChallenge: string;
  notes: string;
};

export type QuestionOption = { value: string; label: string; score: number };

export type AssessmentQuestion = MaturityQuestion & {
  prompt: string;
  helpText: string | null;
  sortOrder: number;
  options: QuestionOption[];
};

export type AssessmentAnswer = {
  questionId: string;
  optionValue: string;
  optionScore: number;
};

export type Decision = {
  id: string;
  templateObjectiveId: string;
  decision: "accepted" | "discarded";
  customTitle: string | null;
  customDescription: string | null;
  appliedObjectiveId: string | null;
  appliedAt: string | null;
};

export type CurrentPlan = {
  id: string;
  organizationId: string;
  businessUnitId: string;
  title: string;
  status: string;
  reviewStatus: string;
  cycleStart: string;
  cycleEnd: string;
};

/* ---------------- helpers ---------------- */

const asDimension = (v: string): Dimension =>
  (DIMENSIONS as readonly string[]).includes(v) ? (v as Dimension) : "governance";

const emptyToNull = (v: string) => {
  const t = v.trim();
  return t.length ? t : null;
};

function parseOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      return {
        value: String(o.value ?? ""),
        label: String(o.label ?? ""),
        score: Number(o.score ?? 0) || 0,
      };
    })
    .filter((o) => o.value.length > 0)
    .sort((a, b) => a.score - b.score);
}

/* ---------------- perfil ---------------- */

export async function fetchStrategyProfile(businessUnitId: string): Promise<StrategyProfile | null> {
  const { data, error } = await supabase
    .from("company_strategy_profiles")
    .select(
      "id, organization_id, business_unit_id, sector_code, business_model, stage, horizon_years, size_band, main_challenge, notes, journey_step, updated_at",
    )
    .eq("business_unit_id", businessUnitId)
    .maybeSingle();
  if (error) translateError(error);
  if (!data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    businessUnitId: data.business_unit_id,
    sectorCode: data.sector_code as SectorCode,
    businessModel: data.business_model as BusinessModel,
    stage: data.stage as Stage,
    horizonYears: data.horizon_years,
    sizeBand: data.size_band as SizeBand,
    mainChallenge: data.main_challenge,
    notes: data.notes,
    journeyStep: data.journey_step as JourneyStep,
    updatedAt: data.updated_at,
  };
}

export async function saveStrategyProfile(
  ctx: { organizationId: string; businessUnitId: string; profileId: string | null },
  input: ProfileInput,
): Promise<void> {
  const values = {
    sector_code: input.sectorCode,
    business_model: input.businessModel,
    stage: input.stage,
    horizon_years: input.horizonYears,
    size_band: input.sizeBand,
    main_challenge: emptyToNull(input.mainChallenge),
    notes: emptyToNull(input.notes),
  };
  if (ctx.profileId) {
    const { error } = await supabase
      .from("company_strategy_profiles")
      .update(values)
      .eq("id", ctx.profileId);
    if (error) translateError(error);
    return;
  }
  const { error } = await supabase.from("company_strategy_profiles").insert({
    organization_id: ctx.organizationId,
    business_unit_id: ctx.businessUnitId,
    ...values,
  });
  if (error) translateError(error);
}

/** Registra a etapa alcançada. Falha silenciosa: é apenas continuidade de navegação. */
export async function saveJourneyStep(profileId: string, step: JourneyStep): Promise<void> {
  const { error } = await supabase
    .from("company_strategy_profiles")
    .update({ journey_step: step })
    .eq("id", profileId);
  if (error) translateError(error);
}

/* ---------------- maturidade ---------------- */

export async function fetchAssessmentQuestions(): Promise<AssessmentQuestion[]> {
  const { data, error } = await supabase
    .from("strategy_assessment_questions")
    .select("id, code, dimension, prompt, help_text, weight, sort_order, options")
    .eq("version", ASSESSMENT_VERSION)
    .eq("status", "active")
    .order("sort_order");
  if (error) translateError(error);
  return (data ?? []).map((q) => {
    const options = parseOptions(q.options);
    return {
      id: q.id,
      code: q.code,
      dimension: asDimension(q.dimension),
      weight: Number(q.weight ?? 1) || 1,
      maxScore: options.reduce((max, o) => Math.max(max, o.score), 0) || 4,
      prompt: q.prompt,
      helpText: q.help_text,
      sortOrder: q.sort_order,
      options,
    };
  });
}

export async function fetchAssessmentAnswers(businessUnitId: string): Promise<AssessmentAnswer[]> {
  const { data, error } = await supabase
    .from("strategy_assessment_answers")
    .select("question_id, option_value, option_score")
    .eq("business_unit_id", businessUnitId);
  if (error) translateError(error);
  return (data ?? []).map((a) => ({
    questionId: a.question_id,
    optionValue: a.option_value,
    optionScore: a.option_score,
  }));
}

export async function saveAssessmentAnswer(
  ctx: { organizationId: string; businessUnitId: string },
  answer: AssessmentAnswer,
): Promise<void> {
  const { error } = await supabase.from("strategy_assessment_answers").upsert(
    {
      organization_id: ctx.organizationId,
      business_unit_id: ctx.businessUnitId,
      question_id: answer.questionId,
      option_value: answer.optionValue,
      option_score: answer.optionScore,
    },
    { onConflict: "business_unit_id,question_id" },
  );
  if (error) translateError(error);
}

/* ---------------- diagnóstico ---------------- */

export async function fetchDiagnosisStatements(
  sectorCode: SectorCode,
): Promise<DiagnosisStatement[]> {
  const { data, error } = await supabase
    .from("strategy_diagnosis_statements")
    .select("id, code, sector_code, dimension, swot_category, statement, weight, sort_order")
    .eq("version", LIBRARY_VERSION)
    .eq("status", "active")
    .in("sector_code", Array.from(new Set(["general", sectorCode])))
    .order("sort_order");
  if (error) translateError(error);
  return (data ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    sectorCode: s.sector_code as SectorCode,
    dimension: asDimension(s.dimension),
    swotCategory: s.swot_category as SwotCategory,
    statement: s.statement,
    weight: Number(s.weight ?? 1) || 1,
    sortOrder: s.sort_order,
  }));
}

export async function fetchDiagnosisSelections(
  businessUnitId: string,
): Promise<DiagnosisSelection[]> {
  const { data, error } = await supabase
    .from("strategy_diagnosis_selections")
    .select("statement_id, intensity")
    .eq("business_unit_id", businessUnitId);
  if (error) translateError(error);
  return (data ?? []).map((s) => ({
    statementId: s.statement_id,
    intensity: s.intensity as DiagnosisSelection["intensity"],
  }));
}

export async function toggleDiagnosisSelection(
  ctx: { organizationId: string; businessUnitId: string },
  statementId: string,
  selected: boolean,
): Promise<void> {
  if (!selected) {
    const { error } = await supabase
      .from("strategy_diagnosis_selections")
      .delete()
      .eq("business_unit_id", ctx.businessUnitId)
      .eq("statement_id", statementId);
    if (error) translateError(error);
    return;
  }
  const { error } = await supabase.from("strategy_diagnosis_selections").upsert(
    {
      organization_id: ctx.organizationId,
      business_unit_id: ctx.businessUnitId,
      statement_id: statementId,
      intensity: "medium",
    },
    { onConflict: "business_unit_id,statement_id" },
  );
  if (error) translateError(error);
}

/* ---------------- biblioteca curada ---------------- */

export async function fetchTemplateObjectives(): Promise<TemplateObjective[]> {
  const { data, error } = await supabase
    .from("strategy_template_objectives")
    .select(
      "id, code, sector_code, dimension, stages, title, description, rationale, base_weight, sort_order",
    )
    .eq("version", LIBRARY_VERSION)
    .eq("status", "active")
    .order("sort_order");
  if (error) translateError(error);
  return (data ?? []).map((t) => ({
    id: t.id,
    code: t.code,
    sectorCode: t.sector_code as SectorCode,
    dimension: asDimension(t.dimension),
    stages: (t.stages ?? []) as Stage[],
    title: t.title,
    description: t.description,
    rationale: t.rationale,
    baseWeight: Number(t.base_weight ?? 1) || 1,
    sortOrder: t.sort_order,
  }));
}

export async function fetchTemplateKpis(): Promise<TemplateKpi[]> {
  const { data, error } = await supabase
    .from("strategy_template_kpis")
    .select(
      "id, template_objective_id, code, name, kpi_class, description, unit, formula, source_hint, direction, frequency, sort_order",
    )
    .eq("status", "active")
    .order("sort_order");
  if (error) translateError(error);
  return (data ?? []).map((k) => ({
    id: k.id,
    templateObjectiveId: k.template_objective_id,
    code: k.code,
    name: k.name,
    kpiClass: k.kpi_class as TemplateKpiClass,
    description: k.description,
    unit: k.unit,
    formula: k.formula,
    sourceHint: k.source_hint,
    direction: k.direction,
    frequency: k.frequency,
    sortOrder: k.sort_order,
  }));
}

/* ---------------- decisões ---------------- */

export async function fetchDecisions(businessUnitId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from("strategy_recommendation_decisions")
    .select(
      "id, template_objective_id, decision, custom_title, custom_description, applied_objective_id, applied_at",
    )
    .eq("business_unit_id", businessUnitId);
  if (error) translateError(error);
  return (data ?? []).map((d) => ({
    id: d.id,
    templateObjectiveId: d.template_objective_id,
    decision: d.decision as Decision["decision"],
    customTitle: d.custom_title,
    customDescription: d.custom_description,
    appliedObjectiveId: d.applied_objective_id,
    appliedAt: d.applied_at,
  }));
}

export type DecisionInput = {
  templateObjectiveId: string;
  decision: "accepted" | "discarded";
  customTitle?: string | null;
  customDescription?: string | null;
  score?: number | null;
  reasons?: string[];
};

export async function saveDecision(
  ctx: { organizationId: string; businessUnitId: string },
  input: DecisionInput,
): Promise<void> {
  const { error } = await supabase.from("strategy_recommendation_decisions").upsert(
    {
      organization_id: ctx.organizationId,
      business_unit_id: ctx.businessUnitId,
      template_objective_id: input.templateObjectiveId,
      decision: input.decision,
      custom_title: input.customTitle ?? null,
      custom_description: input.customDescription ?? null,
      score: input.score ?? null,
      reasons: input.reasons ?? [],
    },
    { onConflict: "business_unit_id,template_objective_id" },
  );
  if (error) translateError(error);
}

/* ---------------- ciclo vigente e aplicação ---------------- */

/** Ciclo elegível da unidade: prioriza rascunho/em revisão; ativo entra como referência. */
export async function fetchCurrentPlan(businessUnitId: string): Promise<CurrentPlan | null> {
  const { data, error } = await supabase
    .from("strategic_plans")
    .select(
      "id, organization_id, business_unit_id, title, status, review_status, cycle_start, cycle_end",
    )
    .eq("business_unit_id", businessUnitId)
    .order("cycle_start", { ascending: false });
  if (error) translateError(error);
  const rows = (data ?? []).map((p) => ({
    id: p.id,
    organizationId: p.organization_id,
    businessUnitId: p.business_unit_id,
    title: p.title,
    status: p.status,
    reviewStatus: p.review_status ?? "draft",
    cycleStart: p.cycle_start,
    cycleEnd: p.cycle_end,
  }));
  return rows.find((p) => p.reviewStatus !== "approved") ?? rows[0] ?? null;
}

export type ApplyResult = {
  ok: boolean;
  error: string | null;
  message: string;
  objectivesCreated: number;
  kpisCreated: number;
};

/**
 * Única porta de aplicação do rascunho no planejamento (F8).
 * A validação de permissão, escopo, ciclo elegível e faixa 3–7 é do banco.
 */
export async function applyStrategyDraft(planId: string): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc("f12_apply_strategy_draft", { p_plan_id: planId });
  if (error) translateError(error);
  const o = (data ?? {}) as Record<string, unknown>;
  return {
    ok: o.ok === true,
    error: typeof o.error === "string" ? o.error : null,
    message:
      typeof o.message === "string" ? o.message : "Não foi possível aplicar o rascunho estratégico.",
    objectivesCreated: Number(o.objectivesCreated ?? 0) || 0,
    kpisCreated: Number(o.kpisCreated ?? 0) || 0,
  };
}
