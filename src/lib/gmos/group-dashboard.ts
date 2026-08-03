// FASE F7-D — camada de consultas do Painel do Grupo e do Painel da equipe.
// Somente tabelas existentes e medições com status "validated".
// Toda a visibilidade é decidida pela RLS; os filtros são apenas recorte de leitura.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";
import { fetchWorkspaceOptions, type WorkspaceOption } from "./f3";

export type GroupFilters = {
  companyId: string | null;
  businessUnitId: string | null;
  /** Recorte de período aplicado a prazos de ações e competências de rotinas. */
  from: string | null;
  to: string | null;
};

export const EMPTY_FILTERS: GroupFilters = {
  companyId: null,
  businessUnitId: null,
  from: null,
  to: null,
};

export type KpiRow = {
  id: string;
  name: string;
  unit: string | null;
  direction: string;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  businessUnitId: string;
};

export type MeasurementRow = {
  id: string;
  kpiId: string;
  periodEnd: string;
  value: number;
  status: string;
  businessUnitId: string;
};

export type ActionRow = {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate: string | null;
  businessUnitId: string;
};

export type ExecutionRow = {
  id: string;
  templateId: string;
  status: string;
  dueDate: string;
  competenceDate: string;
  ownerUserId: string | null;
  businessUnitId: string;
};

export type RiskRow = {
  id: string;
  title: string;
  impact: string;
  probability: string;
  status: string;
  businessUnitId: string;
};

export type AuditRow = {
  id: string;
  eventType: string;
  entityType: string;
  action: string;
  occurredAt: string;
};

export type GroupDashboardData = {
  /** Filiais visíveis já recortadas pelos filtros. */
  units: WorkspaceOption[];
  /** Todas as filiais visíveis, para montar os seletores. */
  allUnits: WorkspaceOption[];
  kpis: KpiRow[];
  measurements: MeasurementRow[];
  actions: ActionRow[];
  executions: ExecutionRow[];
  activeTemplates: number;
  risks: RiskRow[];
  audit: AuditRow[];
};

export function applyUnitFilters(
  units: WorkspaceOption[],
  filters: GroupFilters,
): WorkspaceOption[] {
  return units.filter(
    (u) =>
      (!filters.companyId || u.companyId === filters.companyId) &&
      (!filters.businessUnitId || u.businessUnitId === filters.businessUnitId),
  );
}

export async function fetchGroupDashboard(
  filters: GroupFilters,
  options?: { includeAudit?: boolean; units?: WorkspaceOption[] },
): Promise<GroupDashboardData> {
  const allUnits = options?.units ?? (await fetchWorkspaceOptions());
  const units = applyUnitFilters(allUnits, filters);
  const ids = units.map((u) => u.businessUnitId);

  const empty: GroupDashboardData = {
    units,
    allUnits,
    kpis: [],
    measurements: [],
    actions: [],
    executions: [],
    activeTemplates: 0,
    risks: [],
    audit: [],
  };
  if (ids.length === 0) return empty;

  const kpiRes = await supabase
    .from("kpis")
    .select("id, name, unit, direction, target_value, target_min, target_max, business_unit_id")
    .in("business_unit_id", ids)
    .order("name");
  if (kpiRes.error) translateError(kpiRes.error);
  const kpis: KpiRow[] = (kpiRes.data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    unit: k.unit,
    direction: k.direction,
    targetValue: k.target_value === null ? null : Number(k.target_value),
    targetMin: k.target_min === null ? null : Number(k.target_min),
    targetMax: k.target_max === null ? null : Number(k.target_max),
    businessUnitId: k.business_unit_id,
  }));

  let measurementQuery = supabase
    .from("kpi_measurements")
    .select("id, kpi_id, period_end, value, status, business_unit_id")
    .in("business_unit_id", ids)
    .order("period_end", { ascending: false })
    .limit(2000);
  if (filters.from) measurementQuery = measurementQuery.gte("period_end", filters.from);
  if (filters.to) measurementQuery = measurementQuery.lte("period_end", filters.to);

  let actionQuery = supabase
    .from("action_plans")
    .select("id, title, status, progress, due_date, business_unit_id")
    .in("business_unit_id", ids)
    .order("due_date", { ascending: true })
    .limit(1000);
  if (filters.from) actionQuery = actionQuery.or(`due_date.is.null,due_date.gte.${filters.from}`);
  if (filters.to) actionQuery = actionQuery.or(`due_date.is.null,due_date.lte.${filters.to}`);

  let execQuery = supabase
    .from("routine_executions")
    .select("id, template_id, status, due_date, competence_date, owner_user_id, business_unit_id")
    .in("business_unit_id", ids)
    .order("due_date", { ascending: false })
    .limit(2000);
  if (filters.from) execQuery = execQuery.gte("competence_date", filters.from);
  if (filters.to) execQuery = execQuery.lte("competence_date", filters.to);

  const [measurementRes, actionRes, execRes, tplRes, riskRes] = await Promise.all([
    measurementQuery,
    actionQuery,
    execQuery,
    supabase
      .from("routine_templates")
      .select("id", { count: "exact", head: true })
      .in("business_unit_id", ids)
      .eq("status", "active"),
    supabase
      .from("strategic_risks")
      .select("id, title, impact, probability, status, business_unit_id")
      .in("business_unit_id", ids)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  for (const res of [measurementRes, actionRes, execRes, tplRes, riskRes]) {
    if (res.error) translateError(res.error);
  }

  let audit: AuditRow[] = [];
  if (options?.includeAudit) {
    const auditRes = await supabase
      .from("audit_events")
      .select("id, event_type, entity_type, action, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(20);
    // auditoria é opcional: sem permissão audit.read a RLS simplesmente não retorna linhas
    if (!auditRes.error) {
      audit = (auditRes.data ?? []).map((a) => ({
        id: a.id,
        eventType: a.event_type,
        entityType: a.entity_type,
        action: a.action,
        occurredAt: a.occurred_at,
      }));
    }
  }

  return {
    units,
    allUnits,
    kpis,
    measurements: (measurementRes.data ?? []).map((m) => ({
      id: m.id,
      kpiId: m.kpi_id,
      periodEnd: m.period_end,
      value: Number(m.value),
      status: m.status,
      businessUnitId: m.business_unit_id,
    })),
    actions: (actionRes.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      progress: a.progress,
      dueDate: a.due_date,
      businessUnitId: a.business_unit_id,
    })),
    executions: (execRes.data ?? []).map((e) => ({
      id: e.id,
      templateId: e.template_id,
      status: e.status,
      dueDate: e.due_date,
      competenceDate: e.competence_date,
      ownerUserId: e.owner_user_id,
      businessUnitId: e.business_unit_id,
    })),
    activeTemplates: tplRes.count ?? 0,
    risks: (riskRes.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      impact: r.impact,
      probability: r.probability,
      status: r.status,
      businessUnitId: r.business_unit_id,
    })),
    audit,
  };
}

/* ---------------- agregações puras e testáveis ---------------- */

export type KpiHealth = "on_target" | "attention" | "critical" | "no_measurement";

export const KPI_HEALTH_LABEL: Record<KpiHealth, string> = {
  on_target: "No alvo",
  attention: "Atenção",
  critical: "Crítico",
  no_measurement: "Sem medição validada",
};

/** Somente medições "validated" alimentam o semáforo. Sem medição validada ⇒ sem leitura. */
export function latestValidated(
  measurements: MeasurementRow[],
  kpiId: string,
): MeasurementRow | null {
  const valid = measurements
    .filter((m) => m.kpiId === kpiId && m.status === "validated")
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return valid[0] ?? null;
}

export function kpiHealth(kpi: KpiRow, measurement: MeasurementRow | null): KpiHealth {
  if (!measurement) return "no_measurement";
  const v = measurement.value;
  if (kpi.direction === "range") {
    const min = kpi.targetMin;
    const max = kpi.targetMax;
    if (min === null || max === null) return "no_measurement";
    if (v >= min && v <= max) return "on_target";
    const tolerance = Math.abs(max - min) * 0.1;
    if (v >= min - tolerance && v <= max + tolerance) return "attention";
    return "critical";
  }
  const target = kpi.targetValue;
  if (target === null) return "no_measurement";
  if (kpi.direction === "lower_better") {
    if (v <= target) return "on_target";
    if (v <= target * 1.1) return "attention";
    return "critical";
  }
  if (v >= target) return "on_target";
  if (v >= target * 0.9) return "attention";
  return "critical";
}

export type KpiSummary = Record<KpiHealth, number>;

export function summarizeKpis(kpis: KpiRow[], measurements: MeasurementRow[]): KpiSummary {
  const out: KpiSummary = { on_target: 0, attention: 0, critical: 0, no_measurement: 0 };
  for (const kpi of kpis) out[kpiHealth(kpi, latestValidated(measurements, kpi.id))] += 1;
  return out;
}

export function criticalKpis(
  kpis: KpiRow[],
  measurements: MeasurementRow[],
): Array<{ kpi: KpiRow; measurement: MeasurementRow; health: KpiHealth }> {
  return kpis
    .map((kpi) => {
      const measurement = latestValidated(measurements, kpi.id);
      return measurement ? { kpi, measurement, health: kpiHealth(kpi, measurement) } : null;
    })
    .filter(
      (x): x is { kpi: KpiRow; measurement: MeasurementRow; health: KpiHealth } =>
        x !== null && (x.health === "critical" || x.health === "attention"),
    )
    .sort(
      (a, b) =>
        (a.health === "critical" ? 0 : 1) - (b.health === "critical" ? 0 : 1) ||
        a.kpi.name.localeCompare(b.kpi.name, "pt-BR"),
    );
}

export function pendingMeasurements(measurements: MeasurementRow[]): MeasurementRow[] {
  return measurements.filter((m) => m.status !== "validated");
}

export type ActionSummary = {
  total: number;
  late: number;
  completed: number;
  averageProgress: number;
};

export function isActionLate(action: ActionRow, today: string): boolean {
  if (!action.dueDate) return false;
  if (["completed", "cancelled"].includes(action.status)) return false;
  return action.dueDate.slice(0, 10) < today;
}

export function summarizeActions(actions: ActionRow[], today: string): ActionSummary {
  const total = actions.length;
  const completed = actions.filter((a) => a.status === "completed").length;
  const late = actions.filter((a) => isActionLate(a, today)).length;
  const averageProgress = total
    ? Math.round(actions.reduce((sum, a) => sum + (a.progress ?? 0), 0) / total)
    : 0;
  return { total, late, completed, averageProgress };
}

export type RoutineSummary = {
  planned: number;
  completed: number;
  pending: number;
  late: number;
  adherence: number | null;
};

export function isExecutionLate(exec: ExecutionRow, today: string): boolean {
  if (["completed", "cancelled"].includes(exec.status)) return false;
  return exec.dueDate.slice(0, 10) < today;
}

export function summarizeRoutines(executions: ExecutionRow[], today: string): RoutineSummary {
  const planned = executions.length;
  const completed = executions.filter((e) => e.status === "completed").length;
  const pending = executions.filter((e) => ["pending", "in_progress"].includes(e.status)).length;
  const late = executions.filter((e) => isExecutionLate(e, today)).length;
  return {
    planned,
    completed,
    pending,
    late,
    adherence: planned ? Math.round((completed / planned) * 100) : null,
  };
}

export const RISK_SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;
export type RiskSeverity = (typeof RISK_SEVERITY_ORDER)[number];

const LEVEL_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Severidade = impacto × probabilidade, derivada apenas dos campos existentes. */
export function riskSeverity(risk: RiskRow): RiskSeverity {
  const score = (LEVEL_WEIGHT[risk.impact] ?? 1) * (LEVEL_WEIGHT[risk.probability] ?? 1);
  if (score >= 9) return "critical";
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function summarizeRisks(risks: RiskRow[]): Record<RiskSeverity, number> {
  const out: Record<RiskSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of risks.filter((x) => !["closed", "cancelled"].includes(x.status))) {
    out[riskSeverity(r)] += 1;
  }
  return out;
}

export type CompanyHealth = {
  companyId: string;
  companyName: string;
  units: WorkspaceOption[];
  kpis: KpiSummary;
  actions: ActionSummary;
  routines: RoutineSummary;
};

/** Saúde por empresa, sempre determinística e tolerante a empresa sem dados. */
export function healthByCompany(data: GroupDashboardData, today: string): CompanyHealth[] {
  const byCompany = new Map<string, WorkspaceOption[]>();
  for (const u of data.units) {
    byCompany.set(u.companyId, [...(byCompany.get(u.companyId) ?? []), u]);
  }
  return Array.from(byCompany.entries())
    .map(([companyId, units]) => {
      const ids = new Set(units.map((u) => u.businessUnitId));
      const kpis = data.kpis.filter((k) => ids.has(k.businessUnitId));
      const measurements = data.measurements.filter((m) => ids.has(m.businessUnitId));
      return {
        companyId,
        companyName: units[0]!.companyName,
        units,
        kpis: summarizeKpis(kpis, measurements),
        actions: summarizeActions(
          data.actions.filter((a) => ids.has(a.businessUnitId)),
          today,
        ),
        routines: summarizeRoutines(
          data.executions.filter((e) => ids.has(e.businessUnitId)),
          today,
        ),
      } satisfies CompanyHealth;
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "pt-BR"));
}

/** Descrição neutra de evento de auditoria: nunca expõe metadata/payload. */
export function auditLabel(row: AuditRow): string {
  const entity = row.entityType.replace(/^public\./, "").replace(/_/g, " ");
  const action: Record<string, string> = {
    create: "Registro criado",
    update: "Registro atualizado",
    revoke: "Acesso revogado",
    provision: "Usuário provisionado",
  };
  return `${action[row.action] ?? "Evento registrado"} · ${entity}`;
}
