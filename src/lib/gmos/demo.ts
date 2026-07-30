// FASE F5 — detecção e leitura do lote demonstrativo.
// O lote é identificado pelo marcador REAL gravado no banco (kpis.source),
// nunca por empresa/slug em hardcode. Todas as consultas passam por RLS.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

export const DEMO_BATCH = "DEMO-RM-2026-V1";
export const DEMO_TITLE = "Cenário demonstrativo · RM Mineração";
export const DEMO_DISCLAIMER =
  "Dados ilustrativos para apresentação. Não representam resultados reais.";

/** Retorna true quando a filial selecionada contém registros do lote demonstrativo. */
export async function fetchIsDemoUnit(businessUnitId: string | null): Promise<boolean> {
  if (!businessUnitId) return false;
  const { count, error } = await supabase
    .from("kpis")
    .select("id", { count: "exact", head: true })
    .eq("business_unit_id", businessUnitId)
    .like("source", `${DEMO_BATCH}%`);
  if (error) translateError(error);
  return (count ?? 0) > 0;
}

/* ---------------- painel executivo ---------------- */

export type KpiHealth = "on_target" | "attention" | "critical" | "no_data";

export type PanelKpi = {
  id: string;
  name: string;
  unit: string | null;
  direction: string;
  frequency: string;
  baseline: number | null;
  target: number | null;
  latestValue: number | null;
  latestPeriod: string | null;
  health: KpiHealth;
  series: { period: string; label: string; value: number }[];
};

export type ExecutivePanel = {
  isDemo: boolean;
  kpis: PanelKpi[];
  onTarget: number;
  attention: number;
  critical: number;
  actionsTotal: number;
  actionsAvgProgress: number | null;
  actionsConcluded: number;
  executionsTotal: number;
  executionsCompleted: number;
  routineAdherence: number | null;
  periodLabel: string | null;
  /** Medições da filial exibida que ainda aguardam validação (excluídas do semáforo). */
  pendingMeasurements: number;
  /** Última competência com medição validada, em rótulo curto (ex.: jun/26). */
  lastValidatedPeriodLabel: string | null;
  kpisWithoutOwner: number;
  actionsWithoutOwner: number;
  planStatus: string | null;
};

const MONTH_LABEL = [
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

function periodLabel(iso: string) {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MONTH_LABEL[Number(m) - 1]}/${y.slice(2)}`;
}

function health(direction: string, value: number | null, target: number | null): KpiHealth {
  if (value === null || target === null) return "no_data";
  if (direction === "lower_better") {
    if (value <= target) return "on_target";
    return value <= target * 1.1 ? "attention" : "critical";
  }
  if (value >= target) return "on_target";
  return value >= target * 0.9 ? "attention" : "critical";
}

/** Monta o painel a partir das tabelas reais (kpis, kpi_measurements, action_plans, routine_executions). */
export async function fetchExecutivePanel(businessUnitId: string): Promise<ExecutivePanel> {
  const [kpiRes, actionRes, execRes, planRes] = await Promise.all([
    supabase
      .from("kpis")
      .select(
        "id, name, unit, direction, frequency, baseline_value, target_value, source, status, owner_user_id",
      )
      .eq("business_unit_id", businessUnitId)
      .order("created_at"),
    supabase
      .from("action_plans")
      .select("id, status, progress, owner_user_id")
      .eq("business_unit_id", businessUnitId),
    supabase.from("routine_executions").select("id, status").eq("business_unit_id", businessUnitId),
    supabase
      .from("strategic_plans")
      .select("status, created_at")
      .eq("business_unit_id", businessUnitId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  for (const r of [kpiRes, actionRes, execRes, planRes]) if (r.error) translateError(r.error);

  const kpiRows = kpiRes.data ?? [];
  const isDemo = kpiRows.some((k) => (k.source ?? "").startsWith(DEMO_BATCH));

  let measurements: {
    kpi_id: string;
    period_start: string;
    value: number | string;
    status: string;
  }[] = [];
  if (kpiRows.length) {
    const mRes = await supabase
      .from("kpi_measurements")
      .select("kpi_id, period_start, value, status")
      .in(
        "kpi_id",
        kpiRows.map((k) => k.id),
      )
      .order("period_start");
    if (mRes.error) translateError(mRes.error);
    measurements = mRes.data ?? [];
  }

  // Somente medições validadas alimentam semáforo, gráficos, período e leitura executiva.
  const validated = measurements.filter((m) => m.status === "validated");
  const pendingMeasurements = measurements.filter((m) => m.status === "pending").length;

  const kpis: PanelKpi[] = kpiRows.map((k) => {
    const series = validated
      .filter((m) => m.kpi_id === k.id)
      .map((m) => ({
        period: m.period_start,
        label: periodLabel(m.period_start),
        value: Number(m.value),
      }));
    const last = series.length ? series[series.length - 1] : null;
    const target = k.target_value === null ? null : Number(k.target_value);
    return {
      id: k.id,
      name: k.name,
      unit: k.unit,
      direction: k.direction,
      frequency: k.frequency,
      baseline: k.baseline_value === null ? null : Number(k.baseline_value),
      target,
      latestValue: last?.value ?? null,
      latestPeriod: last?.period ?? null,
      health: health(k.direction, last?.value ?? null, target),
      series,
    };
  });

  const actions = actionRes.data ?? [];
  const withProgress = actions.filter((a) => a.status !== "cancelled");
  const executions = execRes.data ?? [];
  const completed = executions.filter((e) => e.status === "completed").length;

  const allPeriods = kpis.flatMap((k) => k.series.map((s) => s.period)).sort();
  const lastPeriod = allPeriods.length ? allPeriods[allPeriods.length - 1] : null;

  return {
    isDemo,
    kpis,
    onTarget: kpis.filter((k) => k.health === "on_target").length,
    attention: kpis.filter((k) => k.health === "attention").length,
    critical: kpis.filter((k) => k.health === "critical").length,
    actionsTotal: actions.length,
    actionsAvgProgress: withProgress.length
      ? Math.round(withProgress.reduce((s, a) => s + (a.progress ?? 0), 0) / withProgress.length)
      : null,
    actionsConcluded: actions.filter((a) => a.status === "completed").length,
    executionsTotal: executions.length,
    executionsCompleted: completed,
    routineAdherence: executions.length ? Math.round((completed / executions.length) * 100) : null,
    periodLabel: allPeriods.length
      ? `${periodLabel(allPeriods[0])} – ${periodLabel(allPeriods[allPeriods.length - 1])}`
      : null,
    pendingMeasurements,
    lastValidatedPeriodLabel: lastPeriod ? periodLabel(lastPeriod) : null,
    kpisWithoutOwner: kpiRows.filter((k) => !k.owner_user_id).length,
    actionsWithoutOwner: actions.filter((a) => !a.owner_user_id).length,
    planStatus: planRes.data?.[0]?.status ?? null,
  };
}

/** Nomes preferidos para as tendências; se ausentes, cai para os primeiros KPIs com histórico. */
const TREND_PREFERENCE = [
  "Custo operacional por tonelada",
  "Produção beneficiada",
  "Disponibilidade física dos equipamentos",
];

export function pickTrendKpis(kpis: PanelKpi[], limit = 3): PanelKpi[] {
  const withSeries = kpis.filter((k) => k.series.length >= 2);
  const preferred = TREND_PREFERENCE.map((name) => withSeries.find((k) => k.name === name)).filter(
    (k): k is PanelKpi => Boolean(k),
  );
  const rest = withSeries.filter((k) => !preferred.includes(k));
  return [...preferred, ...rest].slice(0, limit);
}

export const HEALTH_LABEL: Record<KpiHealth, string> = {
  on_target: "No alvo",
  attention: "Em atenção",
  critical: "Crítico",
  no_data: "Sem medição validada",
};
