// FASE F7 — camada de consultas do Painel do Grupo (proprietário/administrador).
// Somente tabelas existentes e medições com status "validated". Nenhum valor é inventado.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

export type GroupFilters = {
  companyId: string | null;
  businessUnitId: string | null;
  from: string | null;
  to: string | null;
};

export const EMPTY_FILTERS: GroupFilters = {
  companyId: null,
  businessUnitId: null,
  from: null,
  to: null,
};

export type RawCompany = { id: string; name: string; status: string };
export type RawUnit = { id: string; name: string; companyId: string; status: string };
export type RawKpi = {
  id: string;
  name: string;
  businessUnitId: string;
  direction: string;
  unit: string | null;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  status: string;
};
export type RawMeasurement = {
  id: string;
  kpiId: string;
  periodEnd: string;
  value: number;
  status: string;
};
export type RawAction = {
  id: string;
  businessUnitId: string;
  title: string;
  dueDate: string | null;
  status: string;
  progress: number;
};
export type RawExecution = {
  id: string;
  businessUnitId: string;
  dueDate: string;
  status: string;
  templateId: string;
};
export type RawRisk = {
  id: string;
  businessUnitId: string;
  title: string;
  impact: string;
  probability: string;
  status: string;
};
export type RawAudit = {
  id: string;
  eventType: string;
  entityType: string;
  action: string;
  occurredAt: string;
};

export type GroupRaw = {
  companies: RawCompany[];
  units: RawUnit[];
  kpis: RawKpi[];
  measurements: RawMeasurement[];
  actions: RawAction[];
  executions: RawExecution[];
  risks: RawRisk[];
  audit: RawAudit[];
};

export type KpiSituation = "on_target" | "attention" | "critical" | "no_data";

export const KPI_SITUATION_LABEL: Record<KpiSituation, string> = {
  on_target: "No alvo",
  attention: "Atenção",
  critical: "Crítico",
  no_data: "Sem medição validada",
};

export function todayFilterIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Situação do KPI a partir da última medição validada. Função pura. */
export function classifyKpi(kpi: RawKpi, value: number | null): KpiSituation {
  if (value === null) return "no_data";
  if (kpi.direction === "range") {
    const min = kpi.targetMin;
    const max = kpi.targetMax;
    if (min === null || max === null) return "no_data";
    if (value >= min && value <= max) return "on_target";
    const margin = (max - min) * 0.1;
    if (value >= min - margin && value <= max + margin) return "attention";
    return "critical";
  }
  const target = kpi.targetValue;
  if (target === null) return "no_data";
  if (kpi.direction === "lower_better") {
    if (value <= target) return "on_target";
    if (target === 0) return "critical";
    return value <= target * 1.1 ? "attention" : "critical";
  }
  if (value >= target) return "on_target";
  if (target === 0) return "critical";
  return value >= target * 0.9 ? "attention" : "critical";
}

/** Somente medições validadas, a mais recente por KPI. Função pura. */
export function latestValidatedByKpi(measurements: RawMeasurement[]): Map<string, RawMeasurement> {
  const out = new Map<string, RawMeasurement>();
  for (const m of measurements) {
    if (m.status !== "validated") continue;
    const cur = out.get(m.kpiId);
    if (!cur || m.periodEnd > cur.periodEnd) out.set(m.kpiId, m);
  }
  return out;
}

export function isExecutionLate(e: RawExecution, today: string): boolean {
  return ["pending", "in_progress", "blocked"].includes(e.status) && e.dueDate < today;
}
export function isActionOverdue(a: RawAction, today: string): boolean {
  if (!a.dueDate) return false;
  if (["completed", "cancelled"].includes(a.status)) return false;
  return a.dueDate < today;
}

export type AttentionItem = {
  kind: "kpi" | "action" | "routine" | "measurement" | "risk";
  id: string;
  label: string;
  detail: string;
  companyName: string;
  unitName: string;
};

export type CompanyHealth = {
  companyId: string;
  companyName: string;
  units: number;
  kpis: Record<KpiSituation, number>;
  actionsTotal: number;
  actionsLate: number;
  routinesTotal: number;
  routinesDone: number;
  adherence: number | null;
};

export type GroupDashboard = {
  summary: {
    companies: number;
    units: number;
    kpis: Record<KpiSituation, number>;
    actionsTotal: number;
    actionsLate: number;
    actionsDone: number;
    actionsProgress: number | null;
    routinesTotal: number;
    routinesDone: number;
    routinesPending: number;
    routinesLate: number;
    measurementsPending: number;
    risksBySeverity: Record<string, number>;
  };
  companies: CompanyHealth[];
  attention: AttentionItem[];
  audit: RawAudit[];
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function severity(risk: RawRisk): string {
  const rank = (v: string) => (v === "high" ? 3 : v === "medium" ? 2 : 1);
  const score = rank(risk.impact) + rank(risk.probability);
  if (score >= 6) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function emptyKpiCounters(): Record<KpiSituation, number> {
  return { on_target: 0, attention: 0, critical: 0, no_data: 0 };
}

/** Agregação do painel corporativo. Função pura e testável. */
export function aggregateGroupDashboard(raw: GroupRaw, today: string): GroupDashboard {
  const unitById = new Map(raw.units.map((u) => [u.id, u]));
  const companyById = new Map(raw.companies.map((c) => [c.id, c]));
  const latest = latestValidatedByKpi(raw.measurements);

  const summaryKpis = emptyKpiCounters();
  const perCompany = new Map<string, CompanyHealth>();
  const ensure = (companyId: string): CompanyHealth => {
    let c = perCompany.get(companyId);
    if (!c) {
      c = {
        companyId,
        companyName: companyById.get(companyId)?.name ?? "Empresa",
        units: raw.units.filter((u) => u.companyId === companyId).length,
        kpis: emptyKpiCounters(),
        actionsTotal: 0,
        actionsLate: 0,
        routinesTotal: 0,
        routinesDone: 0,
        adherence: null,
      };
      perCompany.set(companyId, c);
    }
    return c;
  };
  for (const c of raw.companies) ensure(c.id);

  const attention: AttentionItem[] = [];
  const ctx = (businessUnitId: string) => {
    const u = unitById.get(businessUnitId);
    return {
      unitName: u?.name ?? "Filial",
      companyName: u ? (companyById.get(u.companyId)?.name ?? "Empresa") : "Empresa",
      companyId: u?.companyId ?? null,
    };
  };

  for (const k of raw.kpis) {
    const m = latest.get(k.id) ?? null;
    const situation = classifyKpi(k, m ? m.value : null);
    summaryKpis[situation] += 1;
    const c = ctx(k.businessUnitId);
    if (c.companyId) ensure(c.companyId).kpis[situation] += 1;
    if (situation === "critical") {
      attention.push({
        kind: "kpi",
        id: k.id,
        label: k.name,
        detail: `Indicador crítico na última medição validada${m ? ` (${m.periodEnd})` : ""}`,
        companyName: c.companyName,
        unitName: c.unitName,
      });
    }
  }

  let actionsLate = 0;
  let actionsDone = 0;
  let progressSum = 0;
  for (const a of raw.actions) {
    const c = ctx(a.businessUnitId);
    if (c.companyId) ensure(c.companyId).actionsTotal += 1;
    progressSum += a.progress ?? 0;
    if (a.status === "completed") actionsDone += 1;
    if (isActionOverdue(a, today)) {
      actionsLate += 1;
      if (c.companyId) ensure(c.companyId).actionsLate += 1;
      attention.push({
        kind: "action",
        id: a.id,
        label: a.title,
        detail: `Plano de ação vencido em ${a.dueDate}`,
        companyName: c.companyName,
        unitName: c.unitName,
      });
    }
  }

  let routinesDone = 0;
  let routinesPending = 0;
  let routinesLate = 0;
  for (const e of raw.executions) {
    const c = ctx(e.businessUnitId);
    if (c.companyId) {
      const ch = ensure(c.companyId);
      ch.routinesTotal += 1;
      if (e.status === "completed") ch.routinesDone += 1;
    }
    if (e.status === "completed") routinesDone += 1;
    else if (["pending", "in_progress", "blocked"].includes(e.status)) routinesPending += 1;
    if (isExecutionLate(e, today)) {
      routinesLate += 1;
      attention.push({
        kind: "routine",
        id: e.id,
        label: "Execução de rotina vencida",
        detail: `Prazo em ${e.dueDate}`,
        companyName: c.companyName,
        unitName: c.unitName,
      });
    }
  }

  const measurementsPending = raw.measurements.filter((m) => m.status === "pending").length;
  for (const m of raw.measurements) {
    if (m.status !== "pending") continue;
    const kpi = raw.kpis.find((k) => k.id === m.kpiId);
    if (!kpi) continue;
    const c = ctx(kpi.businessUnitId);
    attention.push({
      kind: "measurement",
      id: m.id,
      label: kpi.name,
      detail: `Medição de ${m.periodEnd} aguardando validação`,
      companyName: c.companyName,
      unitName: c.unitName,
    });
  }

  const risksBySeverity: Record<string, number> = {};
  for (const r of raw.risks) {
    if (["closed", "cancelled"].includes(r.status)) continue;
    const sev = severity(r);
    risksBySeverity[sev] = (risksBySeverity[sev] ?? 0) + 1;
    if (sev === "critical" || sev === "high") {
      const c = ctx(r.businessUnitId);
      attention.push({
        kind: "risk",
        id: r.id,
        label: r.title,
        detail: sev === "critical" ? "Risco crítico ativo" : "Risco alto ativo",
        companyName: c.companyName,
        unitName: c.unitName,
      });
    }
  }

  const companies = Array.from(perCompany.values()).map((c) => ({
    ...c,
    adherence: c.routinesTotal > 0 ? Math.round((c.routinesDone / c.routinesTotal) * 100) : null,
  }));
  companies.sort((a, b) => a.companyName.localeCompare(b.companyName, "pt-BR"));

  const kindRank: Record<AttentionItem["kind"], number> = {
    kpi: 0,
    risk: 1,
    action: 2,
    routine: 3,
    measurement: 4,
  };
  attention.sort(
    (a, b) =>
      kindRank[a.kind] - kindRank[b.kind] ||
      a.companyName.localeCompare(b.companyName, "pt-BR") ||
      a.label.localeCompare(b.label, "pt-BR"),
  );

  return {
    summary: {
      companies: raw.companies.length,
      units: raw.units.length,
      kpis: summaryKpis,
      actionsTotal: raw.actions.length,
      actionsLate,
      actionsDone,
      actionsProgress: raw.actions.length
        ? Math.round(progressSum / raw.actions.length)
        : null,
      routinesTotal: raw.executions.length,
      routinesDone,
      routinesPending,
      routinesLate,
      measurementsPending,
      risksBySeverity: Object.fromEntries(
        SEVERITY_ORDER.filter((s) => risksBySeverity[s]).map((s) => [s, risksBySeverity[s]!]),
      ),
    },
    companies,
    attention,
    audit: raw.audit,
  };
}

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

/** Descrições neutras de auditoria — nunca expõe payload. */
export function auditLabel(event: RawAudit): string {
  const map: Record<string, string> = {
    create: "Registro criado",
    update: "Registro atualizado",
    revoke: "Acesso revogado",
    provision: "Usuário provisionado",
  };
  return map[event.action] ?? "Evento registrado";
}

export async function fetchGroupRaw(filters: GroupFilters, canReadAudit: boolean): Promise<GroupRaw> {
  const companiesRes = await supabase.from("companies").select("id, name, status").order("name");
  if (companiesRes.error) translateError(companiesRes.error);
  let companies: RawCompany[] = companiesRes.data ?? [];
  if (filters.companyId) companies = companies.filter((c) => c.id === filters.companyId);

  const unitsRes = await supabase
    .from("business_units")
    .select("id, name, company_id, status")
    .order("name");
  if (unitsRes.error) translateError(unitsRes.error);
  let units: RawUnit[] = (unitsRes.data ?? [])
    .map((u) => ({ id: u.id, name: u.name, companyId: u.company_id, status: u.status }))
    .filter((u) => companies.some((c) => c.id === u.companyId));
  if (filters.businessUnitId) units = units.filter((u) => u.id === filters.businessUnitId);

  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0) {
    return {
      companies,
      units,
      kpis: [],
      measurements: [],
      actions: [],
      executions: [],
      risks: [],
      audit: [],
    };
  }

  let actionsQuery = supabase
    .from("action_plans")
    .select("id, business_unit_id, title, due_date, status, progress")
    .in("business_unit_id", unitIds);
  if (filters.from) actionsQuery = actionsQuery.or(`due_date.is.null,due_date.gte.${filters.from}`);
  if (filters.to) actionsQuery = actionsQuery.or(`due_date.is.null,due_date.lte.${filters.to}`);

  let execQuery = supabase
    .from("routine_executions")
    .select("id, business_unit_id, due_date, status, template_id")
    .in("business_unit_id", unitIds);
  if (filters.from) execQuery = execQuery.gte("due_date", filters.from);
  if (filters.to) execQuery = execQuery.lte("due_date", filters.to);

  const [kpiRes, actRes, execRes, riskRes] = await Promise.all([
    supabase
      .from("kpis")
      .select(
        "id, name, business_unit_id, direction, unit, target_value, target_min, target_max, status",
      )
      .in("business_unit_id", unitIds),
    actionsQuery,
    execQuery.limit(2000),
    supabase
      .from("strategic_risks")
      .select("id, business_unit_id, title, impact, probability, status")
      .in("business_unit_id", unitIds),
  ]);
  for (const r of [kpiRes, actRes, execRes, riskRes]) if (r.error) translateError(r.error);

  const kpis: RawKpi[] = (kpiRes.data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    businessUnitId: k.business_unit_id,
    direction: k.direction,
    unit: k.unit,
    targetValue: k.target_value === null ? null : Number(k.target_value),
    targetMin: k.target_min === null ? null : Number(k.target_min),
    targetMax: k.target_max === null ? null : Number(k.target_max),
    status: k.status,
  }));

  let measurements: RawMeasurement[] = [];
  if (kpis.length) {
    let mQuery = supabase
      .from("kpi_measurements")
      .select("id, kpi_id, period_end, value, status")
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      );
    if (filters.from) mQuery = mQuery.gte("period_end", filters.from);
    if (filters.to) mQuery = mQuery.lte("period_end", filters.to);
    const mRes = await mQuery.limit(3000);
    if (mRes.error) translateError(mRes.error);
    measurements = (mRes.data ?? []).map((m) => ({
      id: m.id,
      kpiId: m.kpi_id,
      periodEnd: m.period_end,
      value: Number(m.value),
      status: m.status,
    }));
  }

  let audit: RawAudit[] = [];
  if (canReadAudit) {
    const aRes = await supabase
      .from("audit_events")
      .select("id, event_type, entity_type, action, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(15);
    if (!aRes.error) {
      audit = (aRes.data ?? []).map((a) => ({
        id: a.id,
        eventType: a.event_type,
        entityType: a.entity_type,
        action: a.action,
        occurredAt: a.occurred_at,
      }));
    }
  }

  return {
    companies,
    units,
    kpis,
    measurements,
    actions: (actRes.data ?? []).map((a) => ({
      id: a.id,
      businessUnitId: a.business_unit_id,
      title: a.title,
      dueDate: a.due_date,
      status: a.status,
      progress: a.progress,
    })),
    executions: (execRes.data ?? []).map((e) => ({
      id: e.id,
      businessUnitId: e.business_unit_id,
      dueDate: e.due_date,
      status: e.status,
      templateId: e.template_id,
    })),
    risks: (riskRes.data ?? []).map((r) => ({
      id: r.id,
      businessUnitId: r.business_unit_id,
      title: r.title,
      impact: r.impact,
      probability: r.probability,
      status: r.status,
    })),
    audit,
  };
}