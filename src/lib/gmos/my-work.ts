// FASE F7-C — "Meu trabalho": itens realmente atribuídos ao usuário atual.
// A visibilidade vem da RLS (routine_executions_select_own / action_plans_select_own).
// Nada aqui concede acesso: o filtro por owner_user_id apenas evita tráfego desnecessário.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

export type MyRoutineItem = {
  id: string;
  templateId: string;
  templateName: string;
  frequency: string;
  requiresEvidence: boolean;
  competenceDate: string;
  dueDate: string;
  status: string;
  evidence: string | null;
  notes: string | null;
  businessUnitId: string;
  businessUnitName: string;
};

export type MyActionItem = {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate: string | null;
  startDate: string | null;
  businessUnitId: string;
  businessUnitName: string;
};

export type MyWorkData = {
  routines: MyRoutineItem[];
  actions: MyActionItem[];
};

export const DONE_EXECUTION_STATUS = ["completed", "cancelled"];
export const DONE_ACTION_STATUS = ["completed", "cancelled"];

export type WorkBuckets<T> = {
  late: T[];
  today: T[];
  upcoming: T[];
  done: T[];
};

/** Classificação determinística por prazo. Função pura e testável. */
export function bucketByDue<T extends { dueDate: string | null; status: string }>(
  items: T[],
  today: string,
  doneStatus: string[],
): WorkBuckets<T> {
  const out: WorkBuckets<T> = { late: [], today: [], upcoming: [], done: [] };
  for (const item of items) {
    if (doneStatus.includes(item.status)) {
      out.done.push(item);
      continue;
    }
    const due = item.dueDate?.slice(0, 10) ?? null;
    if (!due) {
      out.upcoming.push(item);
      continue;
    }
    if (due < today) out.late.push(item);
    else if (due === today) out.today.push(item);
    else out.upcoming.push(item);
  }
  const byDue = (a: { dueDate: string | null }, b: { dueDate: string | null }) =>
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  out.late.sort(byDue);
  out.today.sort(byDue);
  out.upcoming.sort(byDue);
  out.done.sort((a, b) => byDue(b, a));
  return out;
}

export function todayIso(now: Date = new Date()): string {
  const tz = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

/** Rotinas e ações atribuídas ao usuário interno informado. */
export async function fetchMyWork(meUserId: string): Promise<MyWorkData> {
  const [execRes, actionRes] = await Promise.all([
    supabase
      .from("routine_executions")
      .select(
        "id, template_id, competence_date, due_date, status, evidence, notes, business_unit_id, routine_templates(name, frequency, requires_evidence), business_units(name)",
      )
      .eq("owner_user_id", meUserId)
      .order("due_date", { ascending: true })
      .limit(400),
    supabase
      .from("action_plans")
      .select("id, title, status, progress, due_date, start_date, business_unit_id, business_units(name)")
      .eq("owner_user_id", meUserId)
      .order("due_date", { ascending: true })
      .limit(200),
  ]);
  if (execRes.error) translateError(execRes.error);
  if (actionRes.error) translateError(actionRes.error);

  const routines: MyRoutineItem[] = (execRes.data ?? []).map((e) => {
    const tpl = e.routine_templates as {
      name: string;
      frequency: string;
      requires_evidence: boolean;
    } | null;
    const unit = e.business_units as { name: string } | null;
    return {
      id: e.id,
      templateId: e.template_id,
      templateName: tpl?.name ?? "Rotina",
      frequency: tpl?.frequency ?? "custom",
      requiresEvidence: Boolean(tpl?.requires_evidence),
      competenceDate: e.competence_date,
      dueDate: e.due_date,
      status: e.status,
      evidence: e.evidence,
      notes: e.notes,
      businessUnitId: e.business_unit_id,
      businessUnitName: unit?.name ?? "Filial",
    };
  });

  const actions: MyActionItem[] = (actionRes.data ?? []).map((a) => {
    const unit = a.business_units as { name: string } | null;
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      progress: a.progress,
      dueDate: a.due_date,
      startDate: a.start_date,
      businessUnitId: a.business_unit_id,
      businessUnitName: unit?.name ?? "Filial",
    };
  });

  return { routines, actions };
}

/** Registro de execução própria. A RLS valida routine.execute_own e a titularidade. */
export async function recordMyExecution(input: {
  executionId: string;
  status: "completed" | "blocked" | "in_progress";
  evidence: string | null;
  notes: string | null;
  meUserId: string;
}): Promise<void> {
  const done = input.status === "completed";
  const patch = {
    status: input.status,
    evidence: input.evidence,
    notes: input.notes,
    completed_at: done ? new Date().toISOString() : null,
    completed_by: done ? input.meUserId : null,
  };
  const { error } = await supabase
    .from("routine_executions")
    .update(patch)
    .eq("id", input.executionId);
  if (error) translateError(error);
}
