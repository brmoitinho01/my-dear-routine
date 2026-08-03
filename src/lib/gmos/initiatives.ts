// FASE F9 — Iniciativas estratégicas e derivação rastreável de planos de ação.
// Leituras e escritas passam pelo cliente do navegador e respeitam a RLS.
// Nenhuma iniciativa, responsável ou plano de ação é criado automaticamente.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

/* ---------------- tipos ---------------- */

export type InitiativeStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "archived";

export type InitiativePriority = "low" | "medium" | "high" | "critical";

export type OriginType =
  "initiative" | "objective" | "kpi" | "risk" | "decision" | "standalone_justified";

export type Initiative = {
  id: string;
  organizationId: string;
  businessUnitId: string;
  planId: string;
  objectiveId: string;
  pillarId: string | null;
  kpiId: string | null;
  riskId: string | null;
  title: string;
  description: string | null;
  expectedResult: string | null;
  ownerUserId: string | null;
  sponsorUserId: string | null;
  startDate: string | null;
  dueDate: string | null;
  priority: InitiativePriority;
  status: InitiativeStatus;
  progress: number;
  estimatedCost: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
};

export type InitiativeInput = {
  objectiveId: string;
  pillarId: string | null;
  kpiId: string | null;
  riskId: string | null;
  title: string;
  description: string | null;
  expectedResult: string | null;
  ownerUserId: string | null;
  sponsorUserId: string | null;
  startDate: string | null;
  dueDate: string | null;
  priority: InitiativePriority;
  estimatedCost: number | null;
};

export const INITIATIVE_STATUS: Record<InitiativeStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  active: "Ativa",
  on_hold: "Suspensa",
  completed: "Concluída",
  cancelled: "Cancelada",
  archived: "Arquivada",
};

export const INITIATIVE_PRIORITY: Record<InitiativePriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const ORIGIN_TYPE: Record<OriginType, string> = {
  initiative: "Derivado de iniciativa estratégica",
  objective: "Vinculado a objetivo estratégico",
  kpi: "Vinculado a indicador",
  risk: "Vinculado a risco",
  decision: "Decisão de reunião",
  standalone_justified: "Avulso justificado",
};

/** Status que não representam iniciativa viva no ciclo. */
const DEAD_STATUS: InitiativeStatus[] = ["cancelled", "archived"];

export function isLiveInitiative(i: Pick<Initiative, "status">): boolean {
  return !DEAD_STATUS.includes(i.status);
}

/* ---------------- leitura ---------------- */

const SELECT =
  "id, organization_id, business_unit_id, plan_id, objective_id, pillar_id, kpi_id, risk_id, title, description, expected_result, owner_user_id, sponsor_user_id, start_date, due_date, priority, status, progress, estimated_cost, submitted_at, approved_at, approval_notes";

type Row = Record<string, unknown>;

function mapInitiative(r: Row): Initiative {
  return {
    id: String(r["id"]),
    organizationId: String(r["organization_id"]),
    businessUnitId: String(r["business_unit_id"]),
    planId: String(r["plan_id"]),
    objectiveId: String(r["objective_id"]),
    pillarId: (r["pillar_id"] as string | null) ?? null,
    kpiId: (r["kpi_id"] as string | null) ?? null,
    riskId: (r["risk_id"] as string | null) ?? null,
    title: String(r["title"]),
    description: (r["description"] as string | null) ?? null,
    expectedResult: (r["expected_result"] as string | null) ?? null,
    ownerUserId: (r["owner_user_id"] as string | null) ?? null,
    sponsorUserId: (r["sponsor_user_id"] as string | null) ?? null,
    startDate: (r["start_date"] as string | null) ?? null,
    dueDate: (r["due_date"] as string | null) ?? null,
    priority: r["priority"] as InitiativePriority,
    status: r["status"] as InitiativeStatus,
    progress: Number(r["progress"] ?? 0),
    estimatedCost: r["estimated_cost"] === null ? null : Number(r["estimated_cost"]),
    submittedAt: (r["submitted_at"] as string | null) ?? null,
    approvedAt: (r["approved_at"] as string | null) ?? null,
    approvalNotes: (r["approval_notes"] as string | null) ?? null,
  };
}

export async function fetchInitiativesByPlan(planId: string): Promise<Initiative[]> {
  const res = await supabase
    .from("strategic_initiatives")
    .select(SELECT)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (res.error) translateError(res.error);
  return (res.data ?? []).map((r) => mapInitiative(r as Row));
}

export async function fetchInitiativesByBusinessUnit(
  businessUnitId: string,
): Promise<Initiative[]> {
  const res = await supabase
    .from("strategic_initiatives")
    .select(SELECT)
    .eq("business_unit_id", businessUnitId)
    .order("created_at", { ascending: false });
  if (res.error) translateError(res.error);
  return (res.data ?? []).map((r) => mapInitiative(r as Row));
}

export async function fetchInitiative(id: string): Promise<Initiative | null> {
  const res = await supabase
    .from("strategic_initiatives")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (res.error) translateError(res.error);
  return res.data ? mapInitiative(res.data as Row) : null;
}

/** Planos de ação derivados, por iniciativa. Somente leitura, para a cadeia de origem. */
export type DerivedActionPlan = {
  id: string;
  initiativeId: string | null;
  title: string;
  status: string;
  originType: OriginType | null;
};

export async function fetchDerivedActionPlans(
  businessUnitId: string,
): Promise<DerivedActionPlan[]> {
  const res = await supabase
    .from("action_plans")
    .select("id, initiative_id, title, status, origin_type")
    .eq("business_unit_id", businessUnitId);
  if (res.error) translateError(res.error);
  return (res.data ?? []).map((a) => ({
    id: a.id,
    initiativeId: a.initiative_id,
    title: a.title,
    status: a.status,
    originType: (a.origin_type as OriginType | null) ?? null,
  }));
}

/* ---------------- escrita ---------------- */

function payload(
  organizationId: string,
  businessUnitId: string,
  planId: string,
  i: InitiativeInput,
) {
  return {
    organization_id: organizationId,
    business_unit_id: businessUnitId,
    plan_id: planId,
    objective_id: i.objectiveId,
    pillar_id: i.pillarId,
    kpi_id: i.kpiId,
    risk_id: i.riskId,
    title: i.title.trim(),
    description: i.description,
    expected_result: i.expectedResult,
    owner_user_id: i.ownerUserId,
    sponsor_user_id: i.sponsorUserId,
    start_date: i.startDate,
    due_date: i.dueDate,
    priority: i.priority,
    estimated_cost: i.estimatedCost,
  };
}

export async function createInitiative(
  organizationId: string,
  businessUnitId: string,
  planId: string,
  input: InitiativeInput,
): Promise<void> {
  const { error } = await supabase
    .from("strategic_initiatives")
    .insert(payload(organizationId, businessUnitId, planId, input));
  if (error) translateError(error);
}

export async function updateInitiative(
  id: string,
  organizationId: string,
  businessUnitId: string,
  planId: string,
  input: InitiativeInput,
): Promise<void> {
  const { error } = await supabase
    .from("strategic_initiatives")
    .update(payload(organizationId, businessUnitId, planId, input))
    .eq("id", id);
  if (error) translateError(error);
}

export async function setInitiativeStatus(id: string, status: InitiativeStatus): Promise<void> {
  const { error } = await supabase.from("strategic_initiatives").update({ status }).eq("id", id);
  if (error) translateError(error);
}

/* ---------------- RPCs ---------------- */

export async function submitInitiativeForReview(id: string): Promise<void> {
  const { error } = await supabase.rpc("f9_submit_initiative_for_review", {
    p_initiative_id: id,
  });
  if (error) translateError(error);
}

export async function approveInitiative(id: string, notes?: string | null): Promise<void> {
  const { error } = await supabase.rpc("f9_approve_initiative", {
    p_initiative_id: id,
    p_notes: notes ?? null,
  });
  if (error) translateError(error);
}

export async function activateInitiative(id: string): Promise<void> {
  const { error } = await supabase.rpc("f9_activate_initiative", { p_initiative_id: id });
  if (error) translateError(error);
}

export type DerivationResult = { actionPlanId: string; created: boolean };

export async function deriveActionPlan(
  id: string,
  dueDate?: string | null,
): Promise<DerivationResult> {
  const { data, error } = await supabase.rpc("f9_derive_action_plan", {
    p_initiative_id: id,
    p_due_date: dueDate ?? null,
  });
  if (error) translateError(error);
  const result = (data ?? {}) as { action_plan_id?: string; created?: boolean };
  return { actionPlanId: String(result.action_plan_id ?? ""), created: Boolean(result.created) };
}

/* ---------------- funções puras ---------------- */

export type ReadinessCode =
  "initiative.expected_result" | "initiative.due_date" | "initiative.owner";

export type Readiness = {
  /** Pode ser enviada para revisão / aprovada. */
  reviewReady: boolean;
  /** Pode ser ativada (exige também responsável). */
  activationReady: boolean;
  missing: ReadinessCode[];
};

const READINESS_LABEL: Record<ReadinessCode, string> = {
  "initiative.expected_result": "Resultado esperado não informado",
  "initiative.due_date": "Prazo não informado",
  "initiative.owner": "Responsável não definido",
};

export function readinessLabel(code: ReadinessCode): string {
  return READINESS_LABEL[code];
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

/** Completude da iniciativa: nada é inferido, apenas o que está registrado. */
export function initiativeReadiness(
  i: Pick<Initiative, "expectedResult" | "dueDate" | "ownerUserId">,
): Readiness {
  const missing: ReadinessCode[] = [];
  if (!filled(i.expectedResult)) missing.push("initiative.expected_result");
  if (!filled(i.dueDate)) missing.push("initiative.due_date");
  if (!i.ownerUserId) missing.push("initiative.owner");
  const reviewReady = !missing.some(
    (m) => m === "initiative.expected_result" || m === "initiative.due_date",
  );
  return { reviewReady, activationReady: missing.length === 0, missing };
}

export type InitiativePermissions = {
  canManage: boolean;
  canApprove: boolean;
  canManageActions: boolean;
};

export type WorkflowActions = {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canActivate: boolean;
  canDerive: boolean;
  /** Motivo pt-BR quando a derivação não é possível; null quando é. */
  deriveBlockedReason: string | null;
};

/**
 * Ações de workflow disponíveis para a iniciativa, considerando permissões reais
 * (RLS/has_permission é a autoridade final; isto apenas reflete a decisão).
 */
export function workflowActions(
  initiative: Pick<Initiative, "status" | "expectedResult" | "dueDate" | "ownerUserId">,
  perms: InitiativePermissions,
  alreadyDerived: boolean,
): WorkflowActions {
  const readiness = initiativeReadiness(initiative);
  const live = isLiveInitiative(initiative);
  const canDeriveStatus = initiative.status === "approved" || initiative.status === "active";
  const permittedToDerive = perms.canManage && perms.canManageActions;

  let deriveBlockedReason: string | null = null;
  if (!live) deriveBlockedReason = "Iniciativa cancelada ou arquivada não deriva plano de ação.";
  else if (alreadyDerived)
    deriveBlockedReason = "Esta iniciativa já possui plano de ação derivado.";
  else if (!canDeriveStatus)
    deriveBlockedReason = "Aprove a iniciativa antes de derivar o plano de ação.";
  else if (!permittedToDerive)
    deriveBlockedReason = "Seu perfil não permite derivar planos de ação nesta filial.";

  return {
    canEdit: perms.canManage && live,
    canSubmit: perms.canManage && live && initiative.status === "draft" && readiness.reviewReady,
    canApprove:
      perms.canApprove &&
      live &&
      ["draft", "in_review"].includes(initiative.status) &&
      readiness.reviewReady,
    canActivate:
      perms.canApprove && live && initiative.status === "approved" && readiness.activationReady,
    canDerive: deriveBlockedReason === null,
    deriveBlockedReason,
  };
}

export type OriginChainLink = { kind: string; label: string; value: string };

export type OriginChainSource = {
  originType: OriginType | null;
  originNote?: string | null;
  cycleTitle?: string | null;
  pillarTitle?: string | null;
  objectiveTitle?: string | null;
  kpiName?: string | null;
  riskTitle?: string | null;
  initiativeTitle?: string | null;
};

/**
 * Cadeia de origem visível: Ciclo › Pilar › Objetivo › KPI › Risco › Iniciativa.
 * Só inclui elos realmente conhecidos — nunca finge iniciativa em ação antiga.
 */
export function originChain(source: OriginChainSource): OriginChainLink[] {
  const chain: OriginChainLink[] = [];
  const push = (kind: string, label: string, value: string | null | undefined) => {
    if (filled(value)) chain.push({ kind, label, value: value!.trim() });
  };
  push("cycle", "Ciclo", source.cycleTitle);
  push("pillar", "Pilar", source.pillarTitle);
  push("objective", "Objetivo", source.objectiveTitle);
  push("kpi", "Indicador", source.kpiName);
  push("risk", "Risco", source.riskTitle);
  if (source.originType === "initiative") push("initiative", "Iniciativa", source.initiativeTitle);
  if (source.originType === "standalone_justified")
    push("justification", "Justificativa", source.originNote);
  return chain;
}

export function originLabel(originType: OriginType | null): string {
  return originType ? ORIGIN_TYPE[originType] : "Origem não classificada";
}

/** Criação manual de ação: origem obrigatória e justificativa obrigatória se avulsa. */
export function validateManualOrigin(input: {
  originType: OriginType | null;
  originNote: string | null;
  objectiveId?: string | null;
  kpiId?: string | null;
}): string | null {
  if (!input.originType) return "Selecione a origem do plano de ação.";
  if (input.originType === "initiative")
    return "Planos derivados de iniciativa são criados pela própria iniciativa.";
  if (input.originType === "standalone_justified" && !filled(input.originNote))
    return "Justifique por que este plano de ação não deriva do planejamento.";
  if (input.originType === "objective" && !input.objectiveId)
    return "Selecione o objetivo de origem.";
  if (input.originType === "kpi" && !input.kpiId) return "Selecione o indicador de origem.";
  return null;
}

export type InitiativeFilters = { objectiveId?: string | null; status?: string | null };

export function filterInitiatives(list: Initiative[], f: InitiativeFilters): Initiative[] {
  return list.filter((i) => {
    if (f.objectiveId && i.objectiveId !== f.objectiveId) return false;
    if (f.status && f.status !== "all" && i.status !== f.status) return false;
    return true;
  });
}

export function initiativesByObjective(list: Initiative[], objectiveId: string): Initiative[] {
  return filterInitiatives(list, { objectiveId });
}

export function hasActiveDerivation(
  initiativeId: string,
  plans: Pick<DerivedActionPlan, "initiativeId" | "status">[],
): boolean {
  return plans.some((p) => p.initiativeId === initiativeId && p.status !== "cancelled");
}

export type InitiativeIndicators = {
  byStatus: Record<string, number>;
  withoutOwner: number;
  approvedWithoutActionPlan: number;
  live: number;
};

/** Indicadores leves para os painéis. Cancelada/arquivada não conta como viva. */
export function initiativeIndicators(
  list: Initiative[],
  plans: Pick<DerivedActionPlan, "initiativeId" | "status">[],
): InitiativeIndicators {
  const byStatus: Record<string, number> = {};
  let withoutOwner = 0;
  let approvedWithoutActionPlan = 0;
  let live = 0;
  for (const i of list) {
    byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
    if (!isLiveInitiative(i)) continue;
    live += 1;
    if (!i.ownerUserId) withoutOwner += 1;
    if ((i.status === "approved" || i.status === "active") && !hasActiveDerivation(i.id, plans))
      approvedWithoutActionPlan += 1;
  }
  return { byStatus, withoutOwner, approvedWithoutActionPlan, live };
}
