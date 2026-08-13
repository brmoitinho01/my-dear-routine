// FASE F8.1-C — regras PURAS do Painel executivo de KPIs.
// Nenhuma heurística inventada: sem tolerância, sem benchmark, sem "quase meta".
// Situação da meta e situação da validação são conceitos separados e independentes.

export type ExecutiveKpiStatus = "on_target" | "off_target" | "no_target" | "no_measurement";

export const EXECUTIVE_KPI_STATUS_LABEL: Record<ExecutiveKpiStatus, string> = {
  on_target: "Na meta",
  off_target: "Fora da meta",
  no_target: "Sem meta",
  no_measurement: "Sem medição",
};

export type MeasurementValidation = "pending" | "validated" | "rejected";

export const MEASUREMENT_VALIDATION_LABEL: Record<string, string> = {
  pending: "Medição pendente de validação",
  validated: "Medição validada",
  rejected: "Medição rejeitada",
};

/** Contrato mínimo do KPI executivo, sempre derivado das tabelas oficiais. */
export type ExecutiveKpi = {
  companyId: string;
  companyName: string;
  businessUnitId: string;
  businessUnitName: string;
  planId: string | null;
  planTitle: string | null;
  kpiId: string;
  kpiName: string;
  unit: string | null;
  frequency: string;
  direction: string;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  kpiStatus: string;
  latestValue: number | null;
  latestPeriodStart: string | null;
  latestPeriodEnd: string | null;
  latestMeasurementStatus: string | null;
};

/**
 * Situação factual contra a meta. A validação da medição NÃO altera esta conta:
 * uma medição pendente é exibida com o mesmo cálculo, apenas sinalizada na UI.
 */
export function deriveExecutiveKpiStatus(kpi: {
  direction: string;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  latestValue: number | null;
}): ExecutiveKpiStatus {
  const v = kpi.latestValue;
  if (v === null || v === undefined || Number.isNaN(v)) return "no_measurement";
  if (kpi.direction === "range") {
    if (kpi.targetMin === null || kpi.targetMax === null) return "no_target";
    return v >= kpi.targetMin && v <= kpi.targetMax ? "on_target" : "off_target";
  }
  if (kpi.targetValue === null) return "no_target";
  if (kpi.direction === "lower_better") return v <= kpi.targetValue ? "on_target" : "off_target";
  return v >= kpi.targetValue ? "on_target" : "off_target";
}

export type ExecutiveKpiSummary = {
  total: number;
  measured: number;
  onTarget: number;
  offTarget: number;
  noTarget: number;
  noMeasurement: number;
  pendingValidation: number;
  /** % na meta sobre KPIs com meta e medição; null quando o denominador não faz sentido. */
  onTargetPercent: number | null;
  /** Competência máxima visível (period_end). Não afirma que tudo está atualizado. */
  latestPeriodEnd: string | null;
};

export function summarizeExecutiveKpis(kpis: ExecutiveKpi[]): ExecutiveKpiSummary {
  let onTarget = 0;
  let offTarget = 0;
  let noTarget = 0;
  let noMeasurement = 0;
  let pendingValidation = 0;
  let latestPeriodEnd: string | null = null;

  for (const kpi of kpis) {
    const status = deriveExecutiveKpiStatus(kpi);
    if (status === "on_target") onTarget += 1;
    else if (status === "off_target") offTarget += 1;
    else if (status === "no_target") noTarget += 1;
    else noMeasurement += 1;
    if (kpi.latestMeasurementStatus === "pending") pendingValidation += 1;
    if (kpi.latestPeriodEnd && (!latestPeriodEnd || kpi.latestPeriodEnd > latestPeriodEnd)) {
      latestPeriodEnd = kpi.latestPeriodEnd;
    }
  }

  const comparable = onTarget + offTarget;
  return {
    total: kpis.length,
    measured: kpis.length - noMeasurement,
    onTarget,
    offTarget,
    noTarget,
    noMeasurement,
    pendingValidation,
    onTargetPercent: comparable > 0 ? Math.round((onTarget / comparable) * 100) : null,
    latestPeriodEnd,
  };
}

export type ExecutiveUnitGroup = {
  businessUnitId: string;
  businessUnitName: string;
  kpis: ExecutiveKpi[];
  summary: ExecutiveKpiSummary;
};

export type ExecutiveCompanyGroup = {
  companyId: string;
  companyName: string;
  units: ExecutiveUnitGroup[];
  summary: ExecutiveKpiSummary;
};

/** Unidade visível mesmo sem KPI: a lacuna de gestão precisa ficar aparente. */
export type ExecutiveScopeUnit = {
  companyId: string;
  companyName: string;
  businessUnitId: string;
  businessUnitName: string;
};

/**
 * Agrupamento determinístico: empresa e unidade ordenadas por nome (pt-BR),
 * KPIs por nome. Unidades sem KPI permanecem representadas com lista vazia.
 */
export function groupExecutiveKpisByCompany(
  kpis: ExecutiveKpi[],
  units: ExecutiveScopeUnit[] = [],
): ExecutiveCompanyGroup[] {
  const unitMap = new Map<string, ExecutiveScopeUnit>();
  for (const u of units) unitMap.set(u.businessUnitId, u);
  for (const k of kpis) {
    if (!unitMap.has(k.businessUnitId)) {
      unitMap.set(k.businessUnitId, {
        companyId: k.companyId,
        companyName: k.companyName,
        businessUnitId: k.businessUnitId,
        businessUnitName: k.businessUnitName,
      });
    }
  }

  const byCompany = new Map<string, { name: string; units: ExecutiveScopeUnit[] }>();
  for (const u of unitMap.values()) {
    const entry = byCompany.get(u.companyId) ?? { name: u.companyName, units: [] };
    entry.units.push(u);
    byCompany.set(u.companyId, entry);
  }

  const cmp = (a: string, b: string) => a.localeCompare(b, "pt-BR");

  return Array.from(byCompany.entries())
    .map(([companyId, entry]) => {
      const unitGroups: ExecutiveUnitGroup[] = entry.units
        .map((u) => {
          const own = kpis
            .filter((k) => k.businessUnitId === u.businessUnitId)
            .sort((a, b) => cmp(a.kpiName, b.kpiName));
          return {
            businessUnitId: u.businessUnitId,
            businessUnitName: u.businessUnitName,
            kpis: own,
            summary: summarizeExecutiveKpis(own),
          };
        })
        .sort((a, b) => cmp(a.businessUnitName, b.businessUnitName));
      const companyKpis = unitGroups.flatMap((u) => u.kpis);
      return {
        companyId,
        companyName: entry.name,
        units: unitGroups,
        summary: summarizeExecutiveKpis(companyKpis),
      } satisfies ExecutiveCompanyGroup;
    })
    .sort((a, b) => cmp(a.companyName, b.companyName));
}

function fmtDecimal(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Formata valor + unidade sem inventar casas decimais. Zero é valor válido. */
export function formatExecutiveKpiValue(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const n = fmtDecimal(value);
  if (!unit) return n;
  if (unit === "%") return `${n}%`;
  if (unit === "R$" || unit.toUpperCase() === "BRL") return `R$ ${n}`;
  return `${n} ${unit}`;
}

/** Meta legível: valor único ou faixa. Retorna "Sem meta" quando incompleta. */
export function formatExecutiveKpiTarget(kpi: {
  direction: string;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  unit: string | null;
}): string {
  if (kpi.direction === "range") {
    if (kpi.targetMin === null || kpi.targetMax === null) return "Sem meta";
    return `${formatExecutiveKpiValue(kpi.targetMin, kpi.unit)} a ${formatExecutiveKpiValue(kpi.targetMax, kpi.unit)}`;
  }
  if (kpi.targetValue === null) return "Sem meta";
  const prefix = kpi.direction === "lower_better" ? "≤ " : "≥ ";
  return `${prefix}${formatExecutiveKpiValue(kpi.targetValue, kpi.unit)}`;
}

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Competência curta: "jun/2026". Sem data ⇒ "Sem medição". */
export function formatCompetence(periodEnd: string | null | undefined): string {
  if (!periodEnd) return "Sem medição";
  const [y, m] = periodEnd.slice(0, 10).split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return periodEnd.slice(0, 10);
  return `${MONTHS[idx]}/${y}`;
}

export type ExecutiveKpiFilters = {
  companyId: string | null;
  status: ExecutiveKpiStatus | "all";
  validation: MeasurementValidation | "all";
};

export const EMPTY_EXECUTIVE_FILTERS: ExecutiveKpiFilters = {
  companyId: null,
  status: "all",
  validation: "all",
};

export function filterExecutiveKpis(
  kpis: ExecutiveKpi[],
  filters: ExecutiveKpiFilters,
): ExecutiveKpi[] {
  return kpis.filter((k) => {
    if (filters.companyId && k.companyId !== filters.companyId) return false;
    if (filters.status !== "all" && deriveExecutiveKpiStatus(k) !== filters.status) return false;
    if (filters.validation !== "all" && k.latestMeasurementStatus !== filters.validation) {
      return false;
    }
    return true;
  });
}

/**
 * Última medição determinística: `period_end DESC`, empate por `created_at DESC`,
 * empate final pelo id para nunca depender da ordem de chegada.
 */
export function pickLatestMeasurement<
  T extends { periodEnd: string; createdAt: string; id: string },
>(measurements: T[]): T | null {
  const sorted = [...measurements].sort(
    (a, b) =>
      b.periodEnd.localeCompare(a.periodEnd) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
  return sorted[0] ?? null;
}