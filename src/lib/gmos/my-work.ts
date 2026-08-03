// FASE F7 — "Meu trabalho": rotinas e ações atribuídas ao usuário autenticado.
// Somente dados reais; a RLS garante que apenas registros próprios/permitidos retornam.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

export type MyExecution = {
  id: string;
  businessUnitId: string;
  businessUnitName: string;
  templateId: string;
  templateName: string;
  frequency: string;
  requiresEvidence: boolean;
  competenceDate: string;
  dueDate: string;
  status: string;
  completedAt: string | null;
  evidence: string | null;
  notes: string | null;
};

export type MyAction = {
  id: string;
  businessUnitId: string;
  businessUnitName: string;
  title: string;
  why: string | null;
  how: string | null;
  dueDate: string | null;
  status: string;
  progress: number;
};

export type MyWork = { executions: MyExecution[]; actions: MyAction[] };

const OPEN_EXEC = ["pending", "in_progress", "blocked"];

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type ExecutionGroups = {
  late: MyExecution[];
  today: MyExecution[];
  upcoming: MyExecution[];
  done: MyExecution[];
};

/** Classificação determinística de atraso/hoje/próximas/concluídas. Função pura. */
export function groupExecutions(items: MyExecution[], today = todayIso()): ExecutionGroups {
  const groups: ExecutionGroups = { late: [], today: [], upcoming: [], done: [] };
  for (const e of items) {
    if (!OPEN_EXEC.includes(e.status)) {
      groups.done.push(e);
      continue;
    }
    if (e.dueDate < today) groups.late.push(e);
    else if (e.dueDate === today) groups.today.push(e);
    else groups.upcoming.push(e);
  }
  const byDue = (a: MyExecution, b: MyExecution) =>
    a.dueDate.localeCompare(b.dueDate) || a.templateName.localeCompare(b.templateName, "pt-BR");
  groups.late.sort(byDue);
  groups.today.sort(byDue);
  groups.upcoming.sort(byDue);
  groups.done.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  groups.done = groups.done.slice(0, 10);
  return groups;
}

export function isActionLate(a: MyAction, today = todayIso()): boolean {
  if (!a.dueDate) return false;
  if (["completed", "cancelled"].includes(a.status)) return false;
  return a.dueDate < today;
}

export async function fetchMyWork(meUserId: string): Promise<MyWork> {
  const [execRes, actRes, unitsRes] = await Promise.all([
    supabase
      .from("routine_executions")
      .select(
        "id, business_unit_id, template_id, competence_date, due_date, status, completed_at, evidence, notes, routine_templates(name, frequency, requires_evidence)",
      )
      .eq("owner_user_id", meUserId)
      .order("due_date", { ascending: true })
      .limit(300),
    supabase
      .from("action_plans")
      .select("id, business_unit_id, title, why, how, due_date, status, progress")
      .eq("owner_user_id", meUserId)
      .order("due_date", { ascending: true })
      .limit(200),
    supabase.from("business_units").select("id, name"),
  ]);
  for (const r of [execRes, actRes, unitsRes]) if (r.error) translateError(r.error);

  const unitName = new Map((unitsRes.data ?? []).map((u) => [u.id, u.name]));

  const executions: MyExecution[] = (execRes.data ?? []).map((e) => {
    const tpl = e.routine_templates as {
      name?: string;
      frequency?: string;
      requires_evidence?: boolean;
    } | null;
    return {
      id: e.id,
      businessUnitId: e.business_unit_id,
      businessUnitName: unitName.get(e.business_unit_id) ?? "Filial",
      templateId: e.template_id,
      templateName: tpl?.name ?? "Rotina",
      frequency: tpl?.frequency ?? "custom",
      requiresEvidence: Boolean(tpl?.requires_evidence),
      competenceDate: e.competence_date,
      dueDate: e.due_date,
      status: e.status,
      completedAt: e.completed_at,
      evidence: e.evidence,
      notes: e.notes,
    };
  });

  const actions: MyAction[] = (actRes.data ?? []).map((a) => ({
    id: a.id,
    businessUnitId: a.business_unit_id,
    businessUnitName: unitName.get(a.business_unit_id) ?? "Filial",
    title: a.title,
    why: a.why,
    how: a.how,
    dueDate: a.due_date,
    status: a.status,
    progress: a.progress,
  }));

  return { executions, actions };
}

/** Registro de execução própria: status, observação e evidência em texto/URL. */
export async function registerExecution(
  executionId: string,
  meUserId: string,
  values: { status: "completed" | "blocked"; evidence?: string | null; notes?: string | null },
) {
  const patch: {
    status: string;
    evidence: string | null;
    notes: string | null;
    completed_at?: string;
    completed_by?: string;
  } = {
    status: values.status,
    evidence: values.evidence?.trim() ? values.evidence.trim() : null,
    notes: values.notes?.trim() ? values.notes.trim() : null,
  };
  if (values.status === "completed") {
    patch.completed_at = new Date().toISOString();
    patch.completed_by = meUserId;
  }
  const { error } = await supabase.from("routine_executions").update(patch).eq("id", executionId);
  if (error) translateError(error);
}