// FASE F8 — camada de dados e regras do assistente de planejamento estratégico.
// A autorização é sempre do banco (RLS + public.has_permission + RPCs f8_*).
// Nada aqui concede acesso: o frontend apenas reflete o que o banco já decidiu.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

/* ---------------- tipos ---------------- */

export type ReviewStatus = "draft" | "in_review" | "approved";

export const REVIEW_STATUS: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
};

/** Identidade estratégica do ciclo (campos aditivos de strategic_plans). */
export type StrategicIdentity = {
  mission: string | null;
  vision: string | null;
  valuesText: string | null;
  strategicNorth: string | null;
  version: number;
  reviewStatus: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
};

export type Diagnostic = {
  id: string;
  planId: string;
  contextSummary: string | null;
  strengths: string | null;
  weaknesses: string | null;
  opportunities: string | null;
  threats: string | null;
  strategicPriorities: string | null;
  assumptions: string | null;
  reviewStatus: string;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
};

export type Pending = {
  code: string;
  /** direction | diagnosis | objectives | kpis */
  section: string;
  message: string;
};

export type Completeness = {
  ready: boolean;
  planId: string | null;
  version: number | null;
  status: string | null;
  reviewStatus: string | null;
  diagnosisReviewStatus: string | null;
  counts: {
    objectives: number;
    objectivesWithoutOwner: number;
    objectivesWithoutKpi: number;
    kpis: number;
    kpisWithoutObjective: number;
    kpisIncomplete: number;
  };
  pendings: Pending[];
};

export const EMPTY_COMPLETENESS: Completeness = {
  ready: false,
  planId: null,
  version: null,
  status: null,
  reviewStatus: null,
  diagnosisReviewStatus: null,
  counts: {
    objectives: 0,
    objectivesWithoutOwner: 0,
    objectivesWithoutKpi: 0,
    kpis: 0,
    kpisWithoutObjective: 0,
    kpisIncomplete: 0,
  },
  pendings: [],
};

/* ---------------- leitura ---------------- */

export async function fetchIdentity(planId: string): Promise<StrategicIdentity | null> {
  const { data, error } = await supabase
    .from("strategic_plans")
    .select(
      "mission, vision, values_text, strategic_north, version, review_status, submitted_at, approved_at, approval_notes",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error) translateError(error);
  if (!data) return null;
  return {
    mission: data.mission,
    vision: data.vision,
    valuesText: data.values_text,
    strategicNorth: data.strategic_north,
    version: data.version ?? 1,
    reviewStatus: data.review_status ?? "draft",
    submittedAt: data.submitted_at,
    approvedAt: data.approved_at,
    approvalNotes: data.approval_notes,
  };
}

export async function fetchDiagnostic(planId: string): Promise<Diagnostic | null> {
  const { data, error } = await supabase
    .from("plan_diagnostics")
    .select(
      "id, plan_id, context_summary, strengths, weaknesses, opportunities, threats, strategic_priorities, assumptions, review_status, submitted_at, approved_at, updated_at",
    )
    .eq("plan_id", planId)
    .maybeSingle();
  if (error) translateError(error);
  if (!data) return null;
  return {
    id: data.id,
    planId: data.plan_id,
    contextSummary: data.context_summary,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    opportunities: data.opportunities,
    threats: data.threats,
    strategicPriorities: data.strategic_priorities,
    assumptions: data.assumptions,
    reviewStatus: data.review_status ?? "draft",
    submittedAt: data.submitted_at,
    approvedAt: data.approved_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchCompleteness(planId: string): Promise<Completeness> {
  const { data, error } = await supabase.rpc("f8_plan_completeness", { p_plan_id: planId });
  if (error) translateError(error);
  return parseCompleteness(data);
}

/** Normaliza o JSONB do banco. As mensagens do banco são a fonte de verdade. */
export function parseCompleteness(raw: unknown): Completeness {
  const o = (raw ?? {}) as Record<string, any>;
  const counts = (o.counts ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
  return {
    ready: o.ready === true,
    planId: o.planId ?? null,
    version: o.version ?? null,
    status: o.status ?? null,
    reviewStatus: o.reviewStatus ?? null,
    diagnosisReviewStatus: o.diagnosisReviewStatus ?? null,
    counts: {
      objectives: num(counts.objectives),
      objectivesWithoutOwner: num(counts.objectivesWithoutOwner),
      objectivesWithoutKpi: num(counts.objectivesWithoutKpi),
      kpis: num(counts.kpis),
      kpisWithoutObjective: num(counts.kpisWithoutObjective),
      kpisIncomplete: num(counts.kpisIncomplete),
    },
    pendings: Array.isArray(o.pendings)
      ? o.pendings.map((p: any) => ({
          code: String(p?.code ?? ""),
          section: String(p?.section ?? ""),
          message: String(p?.message ?? ""),
        }))
      : [],
  };
}

/* ---------------- escrita (RLS) ---------------- */

export type IdentityInput = {
  mission: string;
  vision: string;
  valuesText: string;
  strategicNorth: string;
};

export async function saveIdentity(planId: string, input: IdentityInput): Promise<void> {
  const { error } = await supabase
    .from("strategic_plans")
    .update({
      mission: emptyToNull(input.mission),
      vision: emptyToNull(input.vision),
      values_text: emptyToNull(input.valuesText),
      strategic_north: emptyToNull(input.strategicNorth),
    })
    .eq("id", planId);
  if (error) translateError(error);
}

export type DiagnosticInput = {
  contextSummary: string;
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
  strategicPriorities: string;
  assumptions: string;
};

export async function saveDiagnostic(
  ctx: {
    planId: string;
    organizationId: string;
    businessUnitId: string;
    diagnosticId: string | null;
  },
  input: DiagnosticInput,
): Promise<void> {
  const values = {
    context_summary: emptyToNull(input.contextSummary),
    strengths: emptyToNull(input.strengths),
    weaknesses: emptyToNull(input.weaknesses),
    opportunities: emptyToNull(input.opportunities),
    threats: emptyToNull(input.threats),
    strategic_priorities: emptyToNull(input.strategicPriorities),
    assumptions: emptyToNull(input.assumptions),
  };
  if (ctx.diagnosticId) {
    const { error } = await supabase
      .from("plan_diagnostics")
      .update(values)
      .eq("id", ctx.diagnosticId);
    if (error) translateError(error);
    return;
  }
  const { error } = await supabase.from("plan_diagnostics").insert({
    plan_id: ctx.planId,
    organization_id: ctx.organizationId,
    business_unit_id: ctx.businessUnitId,
    ...values,
  });
  if (error) translateError(error);
}

/* ---------------- workflow (somente RPC) ---------------- */

export async function submitPlanForReview(planId: string): Promise<Completeness> {
  const { data, error } = await supabase.rpc("f8_submit_plan_for_review", { p_plan_id: planId });
  if (error) translateError(error);
  return parseCompleteness(data);
}

export async function approvePlan(planId: string, notes?: string | null): Promise<Completeness> {
  const { data, error } = await supabase.rpc("f8_approve_plan", {
    p_plan_id: planId,
    p_notes: emptyToNull(notes ?? "") ?? undefined,
  });
  if (error) translateError(error);
  return parseCompleteness(data);
}

export async function activatePlan(planId: string): Promise<Completeness> {
  const { data, error } = await supabase.rpc("f8_activate_plan", { p_plan_id: planId });
  if (error) translateError(error);
  return parseCompleteness(data);
}

/* ---------------- regras puras ---------------- */

/** Texto vazio ou apenas com espaços não conta como preenchido. */
export function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function emptyToNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : null;
}

export const STAGE_IDS = ["direction", "diagnosis", "objectives", "kpis", "review"] as const;
export type StageId = (typeof STAGE_IDS)[number];

export const STAGE_LABEL: Record<StageId, string> = {
  direction: "Direcionamento",
  diagnosis: "Diagnóstico",
  objectives: "Objetivos",
  kpis: "Indicadores e metas",
  review: "Revisão e ativação",
};

export type StageState = {
  id: StageId;
  label: string;
  /** número de itens exigidos concluídos */
  done: number;
  total: number;
  complete: boolean;
};

export type StageProgress = {
  stages: StageState[];
  /** 0 a 100, considerando as quatro etapas de conteúdo + a revisão */
  percent: number;
};

export type StageInput = {
  identity: {
    mission?: string | null;
    vision?: string | null;
    valuesText?: string | null;
    strategicNorth?: string | null;
  } | null;
  diagnostic: {
    contextSummary?: string | null;
    strengths?: string | null;
    weaknesses?: string | null;
    opportunities?: string | null;
    threats?: string | null;
    strategicPriorities?: string | null;
  } | null;
  objectives: { status: string; ownerUserId: string | null }[];
  kpis: { status: string; objectiveId: string | null; incomplete: boolean }[];
  reviewStatus: string;
  planStatus: string;
};

/**
 * Progresso visual das cinco etapas. Função pura, sem consulta e sem relógio.
 * Medições nunca participam: elas pertencem à execução, não ao planejamento.
 */
export function stageProgress(input: StageInput): StageProgress {
  const id = input.identity;
  const identityDone = [id?.mission, id?.vision, id?.valuesText, id?.strategicNorth].filter((v) =>
    isFilled(v),
  ).length;

  const dg = input.diagnostic;
  const diagnosisDone = [
    dg?.contextSummary,
    dg?.strengths,
    dg?.weaknesses,
    dg?.opportunities,
    dg?.threats,
    dg?.strategicPriorities,
  ].filter((v) => isFilled(v)).length;

  const activeObjectives = input.objectives.filter((o) => o.status !== "cancelled");
  const activeKpis = input.kpis.filter((k) => k.status !== "archived");
  const objectivesWithKpi = new Set(
    activeKpis.map((k) => k.objectiveId).filter((v): v is string => Boolean(v)),
  );

  const objectiveChecks = [
    activeObjectives.length >= 3 && activeObjectives.length <= 7,
    activeObjectives.length > 0 && activeObjectives.every((o) => Boolean(o.ownerUserId)),
    activeObjectives.length > 0 && objectivesWithKpi.size >= activeObjectives.length,
  ];

  const kpiChecks = [
    activeKpis.length > 0,
    activeKpis.length > 0 && activeKpis.every((k) => Boolean(k.objectiveId)),
    activeKpis.length > 0 && activeKpis.every((k) => !k.incomplete),
  ];

  const reviewDone =
    input.reviewStatus === "approved" ? (input.planStatus === "active" ? 2 : 1) : 0;

  const stages: StageState[] = [
    {
      id: "direction",
      label: STAGE_LABEL.direction,
      done: identityDone,
      total: 4,
      complete: identityDone === 4,
    },
    {
      id: "diagnosis",
      label: STAGE_LABEL.diagnosis,
      done: diagnosisDone,
      total: 6,
      complete: diagnosisDone === 6,
    },
    {
      id: "objectives",
      label: STAGE_LABEL.objectives,
      done: objectiveChecks.filter(Boolean).length,
      total: objectiveChecks.length,
      complete: objectiveChecks.every(Boolean),
    },
    {
      id: "kpis",
      label: STAGE_LABEL.kpis,
      done: kpiChecks.filter(Boolean).length,
      total: kpiChecks.length,
      complete: kpiChecks.every(Boolean),
    },
    {
      id: "review",
      label: STAGE_LABEL.review,
      done: reviewDone,
      total: 2,
      complete: reviewDone === 2,
    },
  ];

  const done = stages.reduce((acc, s) => acc + s.done, 0);
  const total = stages.reduce((acc, s) => acc + s.total, 0);
  return { stages, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export type WorkflowActions = {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canActivate: boolean;
  /** motivo em português quando a ativação não está disponível */
  activateBlockedReason: string | null;
};

/**
 * Ações visíveis por papel/permissão. `canManage` = strategy.manage no escopo,
 * `canApprovePermission` = strategy.approve. A decisão final continua no banco.
 */
export function workflowActions(input: {
  canManage: boolean;
  canApprovePermission: boolean;
  reviewStatus: string;
  planStatus: string;
  ready: boolean;
  /** identidade + diagnóstico completos e ao menos 3 objetivos */
  submittable: boolean;
}): WorkflowActions {
  const isApproved = input.reviewStatus === "approved";
  const isInReview = input.reviewStatus === "in_review";
  const canSubmit = input.canManage && !isApproved && !isInReview && input.submittable;
  const canApprove = input.canApprovePermission && !isApproved && input.ready;
  const canActivate =
    input.canApprovePermission && isApproved && input.ready && input.planStatus !== "active";

  let activateBlockedReason: string | null = null;
  if (!input.canApprovePermission) {
    activateBlockedReason = "Somente perfis com aprovação estratégica podem ativar o ciclo.";
  } else if (input.planStatus === "active") {
    activateBlockedReason = "Ciclo já está ativo.";
  } else if (!isApproved) {
    activateBlockedReason = "O planejamento precisa ser aprovado antes da ativação.";
  } else if (!input.ready) {
    activateBlockedReason = "Existem pendências de completude no planejamento.";
  }

  return {
    canEdit: input.canManage,
    canSubmit,
    canApprove,
    canActivate,
    activateBlockedReason,
  };
}

/** Agrupa as pendências do banco por seção da interface, preservando as mensagens. */
export function pendingsBySection(pendings: Pending[]): Record<string, Pending[]> {
  const out: Record<string, Pending[]> = {
    direction: [],
    diagnosis: [],
    objectives: [],
    kpis: [],
    other: [],
  };
  for (const p of pendings) {
    const key = p.section in out && p.section !== "other" ? p.section : "other";
    out[key]!.push(p);
  }
  return out;
}

/** Submissão permitida: direcionamento e diagnóstico completos + ao menos 3 objetivos. */
export function isSubmittable(pendings: Pending[]): boolean {
  return !pendings.some(
    (p) => p.section === "direction" || p.section === "diagnosis" || p.code === "objectives.min",
  );
}
