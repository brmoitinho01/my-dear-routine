// FASE F7-B — "Meu trabalho": somente itens cujo responsável é o usuário interno atual.
// O id interno vem do auth-context (public.gmos_my_authorization), nunca de e-mail.
// A visibilidade é da RLS; o filtro por owner_user_id apenas recorta o que é meu.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";
import type { RoutineExecution, RoutineTemplate } from "./f2";

export const DONE_EXECUTION_STATUS = ["completed", "cancelled"];
export const DONE_ACTION_STATUS = ["completed", "cancelled"];

/** Janelas de leitura de "Meu trabalho". */
export const UPCOMING_WINDOW_DAYS = 7;
export const RECENTLY_DONE_WINDOW_DAYS = 14;

export type MyExecution = RoutineExecution & {
  businessUnitId: string;
  businessUnitName: string;
};

export type MyAction = {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate: string | null;
  startDate: string | null;
  ownerUserId: string | null;
  businessUnitId: string;
  businessUnitName: string;
};

export type MyWorkData = {
  executions: MyExecution[];
  templates: RoutineTemplate[];
  actions: MyAction[];
};

export function todayIso(now: Date = new Date()): string {
  const tz = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

export function shiftIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------------- classificação temporal (pura e testável) ---------------- */

export type TimeBuckets<T> = {
  late: T[];
  today: T[];
  upcoming: T[];
  recentlyDone: T[];
};

type Datable = { dueDate: string | null; status: string };

export function isLate(item: Datable, today: string, doneStatus: string[]): boolean {
  if (doneStatus.includes(item.status)) return false;
  if (!item.dueDate) return false;
  return item.dueDate.slice(0, 10) < today;
}

/**
 * Atrasadas, de hoje, próximas (próximos `UPCOMING_WINDOW_DAYS` dias)
 * e concluídas recentemente (últimos `RECENTLY_DONE_WINDOW_DAYS` dias).
 */
export function bucketByDue<T extends Datable>(
  items: T[],
  today: string,
  doneStatus: string[],
  options?: { upcomingDays?: number; recentDays?: number },
): TimeBuckets<T> {
  const upcomingLimit = shiftIso(today, options?.upcomingDays ?? UPCOMING_WINDOW_DAYS);
  const recentFloor = shiftIso(today, -(options?.recentDays ?? RECENTLY_DONE_WINDOW_DAYS));
  const out: TimeBuckets<T> = { late: [], today: [], upcoming: [], recentlyDone: [] };

  for (const item of items) {
    const due = item.dueDate?.slice(0, 10) ?? null;
    if (doneStatus.includes(item.status)) {
      if (!due || due >= recentFloor) out.recentlyDone.push(item);
      continue;
    }
    if (!due) {
      out.upcoming.push(item);
      continue;
    }
    if (due < today) out.late.push(item);
    else if (due === today) out.today.push(item);
    else if (due <= upcomingLimit) out.upcoming.push(item);
  }

  const byDue = (a: Datable, b: Datable) =>
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  out.late.sort(byDue);
  out.today.sort(byDue);
  out.upcoming.sort(byDue);
  out.recentlyDone.sort((a, b) => byDue(b, a));
  return out;
}

export type MyWorkSummary = {
  routinesLate: number;
  routinesToday: number;
  routinesUpcoming: number;
  routinesDone: number;
  actionsLate: number;
  actionsOpen: number;
};

export function summarizeMyWork(data: MyWorkData, today: string): MyWorkSummary {
  const r = bucketByDue(data.executions, today, DONE_EXECUTION_STATUS);
  const a = bucketByDue(data.actions, today, DONE_ACTION_STATUS);
  return {
    routinesLate: r.late.length,
    routinesToday: r.today.length,
    routinesUpcoming: r.upcoming.length,
    routinesDone: r.recentlyDone.length,
    actionsLate: a.late.length,
    actionsOpen: data.actions.filter((x) => !DONE_ACTION_STATUS.includes(x.status)).length,
  };
}

/* ---------------- consultas ---------------- */

/**
 * Somente registros com owner_user_id = usuário interno atual.
 * Itens sem responsável NUNCA são atribuídos ao usuário.
 */
export async function fetchMyWork(meUserId: string): Promise<MyWorkData> {
  const [execRes, actionRes] = await Promise.all([
    supabase
      .from("routine_executions")
      .select(
        "id, template_id, owner_user_id, competence_date, due_date, status, completed_at, evidence, notes, business_unit_id, business_units(name)",
      )
      .eq("owner_user_id", meUserId)
      .order("due_date", { ascending: true })
      .limit(400),
    supabase
      .from("action_plans")
      .select(
        "id, title, status, progress, due_date, start_date, owner_user_id, business_unit_id, business_units(name)",
      )
      .eq("owner_user_id", meUserId)
      .order("due_date", { ascending: true })
      .limit(200),
  ]);
  if (execRes.error) translateError(execRes.error);
  if (actionRes.error) translateError(actionRes.error);

  const executions: MyExecution[] = (execRes.data ?? []).map((e) => {
    const unit = e.business_units as { name: string } | null;
    return {
      id: e.id,
      templateId: e.template_id,
      ownerUserId: e.owner_user_id,
      competenceDate: e.competence_date,
      dueDate: e.due_date,
      status: e.status,
      completedAt: e.completed_at,
      evidence: e.evidence,
      notes: e.notes,
      businessUnitId: e.business_unit_id,
      businessUnitName: unit?.name ?? "Filial",
    };
  });

  const templateIds = Array.from(new Set(executions.map((e) => e.templateId)));
  let templates: RoutineTemplate[] = [];
  if (templateIds.length > 0) {
    const tplRes = await supabase
      .from("routine_templates")
      .select(
        "id, name, description, frequency, owner_user_id, start_date, weekday, day_of_month, custom_interval_days, scheduled_time, requires_evidence, status",
      )
      .in("id", templateIds);
    if (tplRes.error) translateError(tplRes.error);
    templates = (tplRes.data ?? []).map((t) => ({
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
  }

  const actions: MyAction[] = (actionRes.data ?? []).map((a) => {
    const unit = a.business_units as { name: string } | null;
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      progress: a.progress,
      dueDate: a.due_date,
      startDate: a.start_date,
      ownerUserId: a.owner_user_id,
      businessUnitId: a.business_unit_id,
      businessUnitName: unit?.name ?? "Filial",
    };
  });

  return { executions, templates, actions };
}
