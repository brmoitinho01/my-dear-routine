// FASE F2 — camada de dados: planejamento, KPIs, planos de ação e rotinas.
// Todas as consultas passam pelo cliente do navegador e respeitam a RLS.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

// O contexto de empresa/filial vem de @/lib/gmos/f3 (Workspace) — sem slug fixo.
export type { Workspace } from "./f3";

/* ---------------- planejamento ---------------- */

export type Plan = {
  id: string;
  title: string;
  description: string | null;
  cycleStart: string;
  cycleEnd: string;
  status: string;
};
export type Pillar = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  status: string;
};
export type Objective = {
  id: string;
  pillarId: string;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  status: string;
  progress: number;
};
export type Kpi = {
  id: string;
  pillarId: string | null;
  objectiveId: string | null;
  name: string;
  unit: string | null;
  formula: string | null;
  source: string | null;
  frequency: string;
  direction: string;
  baselineValue: number | null;
  targetValue: number | null;
  ownerUserId: string | null;
  status: string;
};
export type Measurement = {
  id: string;
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  sourceEvidence: string | null;
  notes: string | null;
  status: string;
  validatedAt: string | null;
};
export type Risk = {
  id: string;
  objectiveId: string | null;
  title: string;
  description: string | null;
  impact: string;
  probability: string;
  contingency: string | null;
  status: string;
};

export type PlanningData = {
  plan: Plan | null;
  pillars: Pillar[];
  objectives: Objective[];
  kpis: Kpi[];
  measurements: Measurement[];
  risks: Risk[];
};

export function isKpiIncomplete(k: Kpi) {
  return !k.formula?.trim() || !k.source?.trim() || !k.ownerUserId;
}

export async function fetchPlanning(businessUnitId: string): Promise<PlanningData> {
  const planRes = await supabase
    .from("strategic_plans")
    .select("id, title, description, cycle_start, cycle_end, status")
    .eq("business_unit_id", businessUnitId)
    .order("cycle_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planRes.error) translateError(planRes.error);

  const p = planRes.data;
  if (!p) return { plan: null, pillars: [], objectives: [], kpis: [], measurements: [], risks: [] };

  const [pillarsRes, objRes, kpiRes, riskRes] = await Promise.all([
    supabase
      .from("strategic_pillars")
      .select("id, title, description, sort_order, status")
      .eq("plan_id", p.id)
      .order("sort_order"),
    supabase
      .from("strategic_objectives")
      .select("id, pillar_id, title, description, owner_user_id, due_date, status, progress")
      .eq("plan_id", p.id)
      .order("created_at"),
    supabase
      .from("kpis")
      .select(
        "id, pillar_id, objective_id, name, unit, formula, source, frequency, direction, baseline_value, target_value, owner_user_id, status",
      )
      .eq("plan_id", p.id)
      .order("created_at"),
    supabase
      .from("strategic_risks")
      .select("id, objective_id, title, description, impact, probability, contingency, status")
      .eq("plan_id", p.id)
      .order("created_at"),
  ]);
  for (const r of [pillarsRes, objRes, kpiRes, riskRes]) if (r.error) translateError(r.error);

  const kpis = (kpiRes.data ?? []).map((k) => ({
    id: k.id,
    pillarId: k.pillar_id,
    objectiveId: k.objective_id,
    name: k.name,
    unit: k.unit,
    formula: k.formula,
    source: k.source,
    frequency: k.frequency,
    direction: k.direction,
    baselineValue: k.baseline_value,
    targetValue: k.target_value,
    ownerUserId: k.owner_user_id,
    status: k.status,
  }));

  let measurements: Measurement[] = [];
  if (kpis.length) {
    const mRes = await supabase
      .from("kpi_measurements")
      .select(
        "id, kpi_id, period_start, period_end, value, source_evidence, notes, status, validated_at",
      )
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      )
      .order("period_start", { ascending: false });
    if (mRes.error) translateError(mRes.error);
    measurements = (mRes.data ?? []).map((m) => ({
      id: m.id,
      kpiId: m.kpi_id,
      periodStart: m.period_start,
      periodEnd: m.period_end,
      value: Number(m.value),
      sourceEvidence: m.source_evidence,
      notes: m.notes,
      status: m.status,
      validatedAt: m.validated_at,
    }));
  }

  return {
    plan: {
      id: p.id,
      title: p.title,
      description: p.description,
      cycleStart: p.cycle_start,
      cycleEnd: p.cycle_end,
      status: p.status,
    },
    pillars: (pillarsRes.data ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      description: x.description,
      sortOrder: x.sort_order,
      status: x.status,
    })),
    objectives: (objRes.data ?? []).map((o) => ({
      id: o.id,
      pillarId: o.pillar_id,
      title: o.title,
      description: o.description,
      ownerUserId: o.owner_user_id,
      dueDate: o.due_date,
      status: o.status,
      progress: o.progress,
    })),
    kpis,
    measurements,
    risks: (riskRes.data ?? []).map((r) => ({
      id: r.id,
      objectiveId: r.objective_id,
      title: r.title,
      description: r.description,
      impact: r.impact,
      probability: r.probability,
      contingency: r.contingency,
      status: r.status,
    })),
  };
}

/* ---------------- planos de ação ---------------- */

export type ActionPlan = {
  id: string;
  objectiveId: string | null;
  kpiId: string | null;
  title: string;
  why: string | null;
  how: string | null;
  wherePlace: string | null;
  ownerUserId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  expectedResult: string | null;
  status: string;
  progress: number;
};

export async function fetchActionPlans(businessUnitId: string): Promise<ActionPlan[]> {
  const res = await supabase
    .from("action_plans")
    .select(
      "id, objective_id, kpi_id, title, why, how, where_place, owner_user_id, start_date, due_date, estimated_cost, actual_cost, expected_result, status, progress",
    )
    .eq("business_unit_id", businessUnitId)
    .order("created_at", { ascending: false });
  if (res.error) translateError(res.error);
  return (res.data ?? []).map((a) => ({
    id: a.id,
    objectiveId: a.objective_id,
    kpiId: a.kpi_id,
    title: a.title,
    why: a.why,
    how: a.how,
    wherePlace: a.where_place,
    ownerUserId: a.owner_user_id,
    startDate: a.start_date,
    dueDate: a.due_date,
    estimatedCost: a.estimated_cost === null ? null : Number(a.estimated_cost),
    actualCost: a.actual_cost === null ? null : Number(a.actual_cost),
    expectedResult: a.expected_result,
    status: a.status,
    progress: a.progress,
  }));
}

export function isLate(a: { dueDate: string | null; status: string }) {
  if (!a.dueDate) return false;
  if (["completed", "cancelled"].includes(a.status)) return false;
  return new Date(a.dueDate + "T23:59:59") < new Date();
}

/* ---------------- rotinas ---------------- */

export type RoutineTemplate = {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  ownerUserId: string | null;
  startDate: string | null;
  weekday: number | null;
  dayOfMonth: number | null;
  customIntervalDays: number | null;
  scheduledTime: string | null;
  requiresEvidence: boolean;
  status: string;
};

export type RoutineExecution = {
  id: string;
  templateId: string;
  competenceDate: string;
  dueDate: string;
  status: string;
  completedAt: string | null;
  evidence: string | null;
  notes: string | null;
};

export async function fetchRoutines(businessUnitId: string) {
  const tplRes = await supabase
    .from("routine_templates")
    .select(
      "id, name, description, frequency, owner_user_id, start_date, weekday, day_of_month, custom_interval_days, scheduled_time, requires_evidence, status",
    )
    .eq("business_unit_id", businessUnitId)
    .order("created_at");
  if (tplRes.error) translateError(tplRes.error);

  const execRes = await supabase
    .from("routine_executions")
    .select("id, template_id, competence_date, due_date, status, completed_at, evidence, notes")
    .eq("business_unit_id", businessUnitId)
    .order("competence_date", { ascending: false })
    .limit(200);
  if (execRes.error) translateError(execRes.error);

  const templates: RoutineTemplate[] = (tplRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    frequency: t.frequency,
    ownerUserId: t.owner_user_id,
    startDate: t.start_date,
    weekday: t.weekday,
    dayOfMonth: t.day_of_month,
    customIntervalDays: t.custom_interval_days,
    scheduledTime: t.scheduled_time,
    requiresEvidence: t.requires_evidence,
    status: t.status,
  }));

  const executions: RoutineExecution[] = (execRes.data ?? []).map((e) => ({
    id: e.id,
    templateId: e.template_id,
    competenceDate: e.competence_date,
    dueDate: e.due_date,
    status: e.status,
    completedAt: e.completed_at,
    evidence: e.evidence,
    notes: e.notes,
  }));

  return { templates, executions };
}

export async function generateExecutions(templateId: string): Promise<number> {
  const { data, error } = await supabase.rpc("f2_generate_routine_executions", {
    p_template_id: templateId,
  });
  if (error) translateError(error);
  return Number(data ?? 0);
}

/* ---------------- escritas genéricas ---------------- */

type TableName =
  | "strategic_plans"
  | "strategic_pillars"
  | "strategic_objectives"
  | "strategic_risks"
  | "kpis"
  | "kpi_measurements"
  | "action_plans"
  | "routine_templates"
  | "routine_executions";

export async function insertRow(table: TableName, values: Record<string, unknown>) {
  const { error } = await (supabase.from(table) as any).insert(values);
  if (error) translateError(error);
}

export async function updateRow(table: TableName, id: string, values: Record<string, unknown>) {
  const { error } = await (supabase.from(table) as any).update(values).eq("id", id);
  if (error) translateError(error);
}

/* ---------------- rótulos e formatação ---------------- */

export const PLAN_STATUS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  closed: "Encerrado",
};
export const OBJECTIVE_STATUS: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  at_risk: "Em risco",
  completed: "Concluído",
  cancelled: "Cancelado",
};
export const KPI_STATUS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};
export const MEASUREMENT_STATUS: Record<string, string> = {
  pending: "Pendente",
  validated: "Validada",
  rejected: "Rejeitada",
};
export const RISK_STATUS: Record<string, string> = {
  open: "Aberto",
  mitigating: "Em mitigação",
  closed: "Encerrado",
  cancelled: "Cancelado",
};
export const ACTION_STATUS: Record<string, string> = {
  draft: "Rascunho",
  planned: "Planejado",
  in_progress: "Em andamento",
  blocked: "Bloqueado",
  completed: "Concluído",
  cancelled: "Cancelado",
};
export const ROUTINE_STATUS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};
export const EXECUTION_STATUS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  blocked: "Bloqueada",
  missed: "Não realizada",
  cancelled: "Cancelada",
};
export const FREQUENCY: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  custom: "Personalizada",
};
export const DIRECTION: Record<string, string> = {
  higher_better: "Maior é melhor",
  lower_better: "Menor é melhor",
  range: "Faixa ideal",
};
export const LEVEL: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto" };
export const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export function fmtNumber(n: number | null | undefined, unit?: string | null) {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}
export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Rótulo para responsável ausente — nunca inventa usuário, apenas sinaliza a pendência. */
export const OWNER_PENDING_LABEL = "Responsável a definir na homologação";
export function ownerLabel(ownerUserId: string | null | undefined) {
  return ownerUserId ? "Definido" : OWNER_PENDING_LABEL;
}

/** Texto de apoio para planos em rascunho, sem alterar o status real. */
export const DRAFT_PLAN_NOTE = "Planejamento demonstrativo em validação";
