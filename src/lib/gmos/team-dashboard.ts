// FASE F7-B — camada de dados do painel da equipe (gestor) e do consolidado (owner/admin).
// Reaproveita as consultas de group-dashboard.ts e adiciona os agregados de equipe.
// Não existe service role no frontend: tudo é lido com a sessão do usuário sob RLS.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";
import type { WorkspaceOption } from "./f3";
import {
  criticalKpis,
  fetchGroupDashboard,
  isActionLate,
  isExecutionLate,
  pendingMeasurements,
  summarizeActions,
  summarizeKpis,
  summarizeRoutines,
  type ActionRow,
  type ExecutionRow,
  type GroupDashboardData,
  type GroupFilters,
  type KpiRow,
  type KpiSummary,
  type MeasurementRow,
} from "./group-dashboard";
import { shiftIso, UPCOMING_WINDOW_DAYS } from "./my-work";

export type TeamTemplate = {
  id: string;
  name: string;
  frequency: string;
  status: string;
  ownerUserId: string | null;
  requiresEvidence: boolean;
  businessUnitId: string;
};

export type TeamDashboardData = GroupDashboardData & {
  templates: TeamTemplate[];
};

/** Recorte de leitura por empresa/unidade, sempre dentro do que a RLS retorna. */
export async function fetchTeamDashboard(
  filters: GroupFilters,
  options?: { includeAudit?: boolean; units?: WorkspaceOption[] },
): Promise<TeamDashboardData> {
  const base = await fetchGroupDashboard(filters, options);
  const ids = base.units.map((u) => u.businessUnitId);
  if (ids.length === 0) return { ...base, templates: [] };

  const tplRes = await supabase
    .from("routine_templates")
    .select("id, name, frequency, status, owner_user_id, requires_evidence, business_unit_id")
    .in("business_unit_id", ids)
    .order("name");
  if (tplRes.error) translateError(tplRes.error);

  return {
    ...base,
    templates: (tplRes.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      frequency: t.frequency,
      status: t.status,
      ownerUserId: t.owner_user_id,
      requiresEvidence: t.requires_evidence,
      businessUnitId: t.business_unit_id,
    })),
  };
}

/* ---------------- agregados puros ---------------- */

export type TeamAggregates = {
  routines: {
    today: ExecutionRow[];
    late: ExecutionRow[];
    completed: ExecutionRow[];
    plannedTotal: number;
    adherence: number | null;
    withoutOwner: number;
  };
  actions: {
    late: ActionRow[];
    upcoming: ActionRow[];
    total: number;
    averageProgress: number;
    withoutOwner: number;
  };
  kpis: KpiSummary & {
    total: number;
    attentionList: Array<{ kpi: KpiRow; measurement: MeasurementRow }>;
  };
  measurements: {
    /** Somente medições que ainda não estão validadas. */
    pending: MeasurementRow[];
    pendingCount: number;
    validatedCount: number;
  };
  templatesWithoutOwner: number;
};

export function buildTeamAggregates(
  data: TeamDashboardData,
  today: string,
  options?: { upcomingDays?: number },
): TeamAggregates {
  const upcomingLimit = shiftIso(today, options?.upcomingDays ?? UPCOMING_WINDOW_DAYS);
  const routineSummary = summarizeRoutines(data.executions, today);
  const actionSummary = summarizeActions(data.actions, today);
  const kpiSummary = summarizeKpis(data.kpis, data.measurements);
  const pending = pendingMeasurements(data.measurements);

  return {
    routines: {
      today: data.executions.filter(
        (e) => e.dueDate.slice(0, 10) === today && !["completed", "cancelled"].includes(e.status),
      ),
      late: data.executions.filter((e) => isExecutionLate(e, today)),
      completed: data.executions.filter((e) => e.status === "completed"),
      plannedTotal: routineSummary.planned,
      adherence: routineSummary.adherence,
      withoutOwner: data.executions.filter((e) => !e.ownerUserId).length,
    },
    actions: {
      late: data.actions.filter((a) => isActionLate(a, today)),
      upcoming: data.actions.filter(
        (a) =>
          a.dueDate !== null &&
          !["completed", "cancelled"].includes(a.status) &&
          a.dueDate.slice(0, 10) >= today &&
          a.dueDate.slice(0, 10) <= upcomingLimit,
      ),
      total: actionSummary.total,
      averageProgress: actionSummary.averageProgress,
      withoutOwner: data.actions.filter((a) => !a.ownerUserId).length,
    },
    kpis: {
      ...kpiSummary,
      total: data.kpis.length,
      attentionList: criticalKpis(data.kpis, data.measurements).map(({ kpi, measurement }) => ({
        kpi,
        measurement,
      })),
    },
    measurements: {
      pending,
      pendingCount: pending.length,
      validatedCount: data.measurements.filter((m) => m.status === "validated").length,
    },
    templatesWithoutOwner: data.templates.filter((t) => !t.ownerUserId).length,
  };
}
